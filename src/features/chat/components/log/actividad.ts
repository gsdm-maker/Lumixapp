import type { ActivityStatus } from '@shared/types'
import type { StatusInfo } from '@shared/utils/estados'
import { ACTIVITY_STATUS, estadoActividad } from '@shared/utils/estados'

export function toYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Atajos de fecha comunes a la tarjeta y al listado. */
export function atajosFecha(): { label: string; value: string }[] {
  const hoy = new Date()
  const manana = new Date()
  manana.setDate(hoy.getDate() + 1)
  const semana = new Date()
  semana.setDate(hoy.getDate() + 7)
  return [
    { label: 'Hoy', value: toYMD(hoy) },
    { label: 'Mañana', value: toYMD(manana) },
    { label: '+1 semana', value: toYMD(semana) },
  ]
}

/**
 * Estado legible de una actividad del chat. El listado guardaba el valor crudo y se veia
 * "en_proceso" en pantalla; un valor fuera del mapa (dato viejo) se muestra tal cual pero
 * con el mismo dibujo.
 */
export function estadoDe(status: string, dueDate?: string | null): StatusInfo {
  return status in ACTIVITY_STATUS
    ? estadoActividad(status as ActivityStatus, dueDate)
    : { label: status, tone: 'idle' }
}
