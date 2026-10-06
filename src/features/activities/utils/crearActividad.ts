import { activitiesService } from '@infrastructure/supabase/activities.service'
import { notificationsService } from '@infrastructure/supabase/notifications.service'
import { minutesService } from '@infrastructure/supabase/minutes.service'
import { formatDateLocal } from '@shared/utils/date'
import type { Activity } from '@shared/types'

export interface NuevaActividad {
  teamId: string
  memberId: string
  title: string
  description: string
  priority: number
  dueISO: string
  addToMinuta: boolean
  parentId?: string
  observations?: string
}

/**
 * Crea una actividad asignada a un miembro y, opcionalmente, un tema vinculado en la minuta de
 * ese equipo (estado sincronizado). Notifica al responsable.
 *
 * Fuera del componente porque la usan tres flujos distintos (asignar, subtarea y delegar) que
 * ahora viven en archivos separados; antes era una funcion interna de la pagina.
 */
export async function crearActividad(o: NuevaActividad, createdBy: string): Promise<Activity> {
  const act = await activitiesService.create({
    title: o.title,
    description: o.description,
    responsible_id: o.memberId,
    priority: o.priority,
    status: 'pendiente',
    due_date: o.dueISO,
    dependencies: [],
    observations: o.observations ?? '',
    team_id: o.teamId,
    created_by: createdBy,
    parent_activity_id: o.parentId ?? null,
  })
  try {
    await notificationsService.send(o.memberId, {
      title: o.parentId ? 'Actividad delegada' : 'Nueva actividad asignada',
      body: `"${o.title}" - Entrega: ${formatDateLocal(o.dueISO)}`,
      type: 'deadline_soon',
      metadata: { activity_id: act.id },
    })
  } catch {
    /* ignore */
  }
  if (o.addToMinuta) {
    try {
      await minutesService.create({
        team_id: o.teamId,
        tipo: 'minuta',
        orden: 0,
        tema: o.title,
        para_todos: false,
        responsables: [o.memberId],
        responsables_text: '',
        estado: 'en_desarrollo',
        plazo: o.dueISO.split('T')[0],
        comentarios: '',
        linked_activity_ids: [act.id],
        created_by: createdBy,
      })
    } catch {
      /* ignore */
    }
  }
  return act
}
