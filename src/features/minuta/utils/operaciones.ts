// Operaciones de la Minuta (y Proyectos) sin React: las usan la hoja (useMinuta) y el agente
// del chat. Antes vivian dentro del hook, y el chat no podia hacer lo mismo sin duplicarlas.

import { activitiesService } from '@infrastructure/supabase/activities.service'
import { minutesService } from '@infrastructure/supabase/minutes.service'
import { notificationsService } from '@infrastructure/supabase/notifications.service'
import { addBusinessDays, formatDateLocal } from '@shared/utils/date'
import type { Activity, MinuteItem } from '@shared/types'

/** Dias habiles de entrega cuando se asigna sin fecha. */
export const DIAS_ENTREGA_POR_DEFECTO = 6

/**
 * Patch de un cambio de plazo con trazabilidad. La PRIMERA asignacion no cuenta como cambio;
 * el contador solo sube cuando ya habia una fecha previa. null si no cambia nada.
 */
export function patchDePlazo(
  item: MinuteItem,
  nuevo: string | null,
): Pick<MinuteItem, 'plazo' | 'plazo_change_count' | 'plazo_history'> | null {
  if ((item.plazo ?? null) === (nuevo ?? null)) return null
  const history = [...(item.plazo_history ?? [])]
  if (nuevo) history.push({ date: nuevo, at: new Date().toISOString() })
  return {
    plazo: nuevo,
    plazo_change_count: (item.plazo_change_count ?? 0) + (item.plazo ? 1 : 0),
    plazo_history: history,
  }
}

/**
 * El plazo tambien es la entrega de los compromisos que nacieron del tema. Sin esto, Compromisos
 * seguia mostrando la fecha vieja aunque el equipo ya la hubiera renegociado en la Minuta -y la
 * marcaba vencida sin estarlo-. Las completadas no se tocan: su cierre es historia.
 * Devuelve cuantas actividades movio.
 */
export async function moverEntregasDelTema(
  item: MinuteItem,
  nuevo: string,
  actividadesPorId: Record<string, Activity>,
): Promise<number> {
  const dueDateISO = new Date(nuevo + 'T00:00:00').toISOString()
  const pendientes = item.linked_activity_ids
    .map((id) => actividadesPorId[id])
    .filter((a): a is Activity => !!a && a.status !== 'completado')
  await Promise.all(pendientes.map((a) => activitiesService.update(a.id, { due_date: dueDateISO })))
  return pendientes.length
}

/** Tema raiz (sube por parent_item_id). */
export function raizDe(item: MinuteItem, items: MinuteItem[]): MinuteItem {
  let raiz = item
  while (raiz.parent_item_id) {
    const padre = items.find((i) => i.id === raiz.parent_item_id)
    if (!padre) break
    raiz = padre
  }
  return raiz
}

/**
 * Crea una actividad por responsable, las vincula al tema (estado sincronizado) y avisa a cada
 * persona. Devuelve los ids creados.
 */
export async function crearActividadesDeTema(opts: {
  item: MinuteItem
  /** Todos los temas de la hoja: para encontrar el proyecto raiz. */
  items: MinuteItem[]
  responsibleIds: string[]
  priority: number
  dueDate: string | null
  /** Solo Proyectos: inicio y termino elegidos al asignar quedan en el item (Cronograma). */
  fechaInicio?: string | null
  userId: string
  teamId: string
}): Promise<string[]> {
  const { item } = opts
  const due = opts.dueDate
    ? new Date(opts.dueDate + 'T00:00:00').toISOString()
    : addBusinessDays(new Date(), DIAS_ENTREGA_POR_DEFECTO).toISOString()

  // Desde Proyectos el origen es el proyecto raiz, no la minuta (antes decia siempre "Minuta
  // semanal", aunque la actividad viniera de una subtarea de un proyecto).
  const raiz = raizDe(item, opts.items)
  const esProyecto = item.tipo === 'proyecto'
  const origen = esProyecto ? `Proyecto: ${raiz.tema}` : 'Minuta semanal'

  const newIds: string[] = []
  for (const rid of opts.responsibleIds) {
    const activity = await activitiesService.create({
      title: item.tema,
      description:
        item.comentarios ||
        (esProyecto ? `Proyecto ${raiz.tema}: ${item.tema}` : `Foco de reunion: ${item.tema}`),
      responsible_id: rid,
      priority: opts.priority,
      status: 'pendiente',
      due_date: due,
      dependencies: [],
      observations: `Origen: ${origen}`,
      team_id: opts.teamId,
      created_by: opts.userId,
    })
    newIds.push(activity.id)
    if (rid !== opts.userId) {
      try {
        await notificationsService.send(rid, {
          title: esProyecto ? 'Nueva actividad (Proyecto)' : 'Nueva actividad (Minuta)',
          body: `"${item.tema}"${esProyecto && raiz.id !== item.id ? ` (${raiz.tema})` : ''} - Entrega: ${formatDateLocal(due)}`,
          type: 'deadline_soon',
          metadata: { activity_id: activity.id },
        })
      } catch (err) {
        console.error('Notify failed:', err)
      }
    }
  }

  // responsables_text (nombre libre de un tema cargado desde planilla) se limpia en la RPC al
  // asignar de verdad: si no, responsablesLabel() lo seguia sumando y mostraba un nombre viejo
  // junto al responsable real (caso real: "Felipe Quintanilla" colgado tras reasignar).
  await minutesService.vincularActividades(
    item.id,
    newIds,
    opts.responsibleIds,
    opts.fechaInicio !== undefined ? { inicio: opts.fechaInicio, plazo: opts.dueDate } : undefined,
  )
  return newIds
}
