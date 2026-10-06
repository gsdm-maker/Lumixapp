import { useEffect, useMemo, useState } from 'react'
import { activitiesService } from '@infrastructure/supabase/activities.service'
import type { Activity } from '@shared/types'
import type { ChatMessage } from '@features/chat/types'

/**
 * Estado ACTUAL de las actividades que aparecen como tarjeta en el chat.
 *
 * Las tarjetas guardan una foto de la actividad del momento en que se creo (estado, fecha,
 * prioridad). Sin esto, una actividad creada la semana pasada y ya completada seguia
 * dibujandose "Pendiente" con fecha pasada, o sea como "Vencido" y con el boton Completar.
 * Se consulta una vez por cada conjunto de ids visible (los ultimos 50 mensajes).
 */
export function useActividadesVivas(messages: ChatMessage[]) {
  const ids = useMemo(() => {
    const set = new Set<string>()
    for (const m of messages) {
      const meta = (m.metadata ?? {}) as Record<string, unknown>
      const id = meta.activity_id ?? meta.activityId
      if (typeof id === 'string') set.add(id)
    }
    return [...set].sort()
  }, [messages])

  // La clave cambia cuando cambia el conjunto de ids o llega un mensaje nuevo (una accion sobre
  // una tarjeta siempre deja un mensaje de Lumix): asi el estado se refresca tras actuar.
  const clave = `${ids.join(',')}|${messages.length}`
  const [estado, setEstado] = useState<{ clave: string; vivas: Map<string, Activity> } | null>(null)

  useEffect(() => {
    if (ids.length === 0) return
    let cancelado = false
    activitiesService
      .getByIds(ids)
      .then((acts) => {
        if (!cancelado) setEstado({ clave, vivas: new Map(acts.map((a) => [a.id, a])) })
      })
      .catch(() => {
        /* sin conexion: las tarjetas quedan con la foto guardada */
      })
    return () => {
      cancelado = true
    }
    // `clave` resume ids + cantidad de mensajes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])

  return {
    vivas: estado?.vivas ?? null,
    /** true cuando ya se sabe que actividades existen (para distinguir "borrada" de "cargando"). */
    listo: estado !== null,
  }
}
