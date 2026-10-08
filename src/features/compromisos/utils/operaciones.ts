// Operaciones de Compromisos sin React: las usan la hoja (useCompromisos) y el agente del chat.

import { activitiesService } from '@infrastructure/supabase/activities.service'
import { minutesService } from '@infrastructure/supabase/minutes.service'
import { patchDePlazo } from '@features/minuta/utils/operaciones'
import type { Activity, MinuteItem } from '@shared/types'

/**
 * Tema que trajo esta actividad a Compromisos (el que la tiene en linked_activity_ids). Si viene
 * de un proyecto se prefiere ese item: llevarla a la minuta crea un segundo tema con el mismo
 * vinculo, y el origen real sigue siendo el proyecto.
 */
export function temaDeActividad(temas: MinuteItem[], activityId: string): MinuteItem | undefined {
  return (
    temas.find((t) => t.tipo === 'proyecto' && t.linked_activity_ids.includes(activityId)) ??
    temas.find((t) => t.linked_activity_ids.includes(activityId))
  )
}

/**
 * Mueve la entrega una semana (regla de EOS: lo no cumplido se arrastra o se discute) y
 * sincroniza el plazo del tema que la origino. Sin esto la Minuta mostraba el plazo viejo (bug
 * real: "en minuta plazo no cuadra con lo que se ve en compromisos").
 * Devuelve la fecha nueva y el tema actualizado (si habia), para reflejarlos en pantalla.
 */
export async function moverActividadUnaSemana(
  a: Activity,
  temas: MinuteItem[],
): Promise<{ dueDate: string; tema?: MinuteItem }> {
  const nueva = new Date(a.due_date)
  nueva.setDate(nueva.getDate() + 7)
  const dueDate = nueva.toISOString()
  await activitiesService.update(a.id, { due_date: dueDate })
  const tema = temaDeActividad(temas, a.id)
  if (!tema) return { dueDate }
  const patch = patchDePlazo(tema, dueDate.split('T')[0])
  if (!patch) return { dueDate, tema }
  await minutesService.update(tema.id, patch)
  return { dueDate, tema: { ...tema, ...patch } }
}

/**
 * Baja el compromiso a la minuta como tema a discutir ("Definir en reunion"). Es la valvula de
 * escape: si algo no se hizo por un bloqueo de fondo, moverlo otra vez no resuelve nada. La
 * actividad queda vinculada para no perder el hilo.
 */
export async function llevarActividadAMinuta(
  a: Activity,
  opts: { teamId: string; userId: string },
): Promise<void> {
  const existentes = await minutesService.getByTeam(opts.teamId, 'minuta')
  await minutesService.create({
    team_id: opts.teamId,
    tipo: 'minuta',
    orden: existentes.length,
    tema: a.title,
    para_todos: false,
    responsables: a.responsible_id ? [a.responsible_id] : [],
    responsables_text: '',
    estado: 'definir',
    plazo: a.due_date.split('T')[0],
    // En blanco a proposito: antes llevaba un texto fijo que quedaba dando vueltas; la persona
    // escribe su propia nota real.
    comentarios: '',
    linked_activity_ids: [a.id],
    created_by: opts.userId,
  })
}

/** Ya hay un tema "Definir en reunion" esperando conversacion para esta actividad. */
export function yaEnMinuta(temas: MinuteItem[], activityId: string): boolean {
  return temas.some(
    (t) =>
      t.tipo === 'minuta' && t.estado === 'definir' && t.linked_activity_ids.includes(activityId),
  )
}

/**
 * Cambia la entrega de una actividad a una fecha (YYYY-MM-DD) y, si nacio de un tema de minuta o
 * proyecto, sincroniza tambien su plazo (con historial). La usan el agente del chat y la
 * sugerencia de "equilibrar la semana".
 */
export async function cambiarEntrega(
  a: Activity,
  fecha: string,
  temas: MinuteItem[],
): Promise<void> {
  await activitiesService.update(a.id, { due_date: new Date(fecha + 'T00:00:00').toISOString() })
  const tema = temaDeActividad(temas, a.id)
  const patch = tema ? patchDePlazo(tema, fecha) : null
  if (tema && patch) await minutesService.update(tema.id, patch)
}
