import type {
  ActivityStatus,
  ErrorSeverity,
  ErrorStatus,
  EstadoIngesta,
  MinuteEstado,
} from '@shared/types'
import { getDaysRemainingLocal } from '@shared/utils/date'

// CODIGO UNICO DE ESTADOS (docs/design-system.md, "Estado: un solo codigo").
//
// Antes habia seis mapas de colores repartidos por las pantallas, y el mismo estado se veia
// distinto segun donde se mirara ("pendiente" ambar en Actividades, gris en el chat). Ahora cada
// estado tiene UNA etiqueta y UN tono, y <StatusLabel> lo dibuja siempre igual: punto + texto.
//
// El tono es semantico, no un color: la paleta real vive en index.css (y cambia con el tema).

export type StatusTone =
  | 'idle' // todavia no empieza
  | 'progress' // en curso
  | 'waiting' // detenido esperando a alguien (no es un bloqueo duro)
  | 'blocked' // bloqueado
  | 'danger' // vencido, error abierto, no resuelto
  | 'done' // terminado
  | 'muted' // cancelado, cerrado: ya no importa
  | 'discuss' // hay que conversarlo en la reunion

export interface StatusInfo {
  label: string
  tone: StatusTone
}

export const ACTIVITY_STATUS: Record<ActivityStatus, StatusInfo> = {
  pendiente: { label: 'Pendiente', tone: 'idle' },
  en_proceso: { label: 'En proceso', tone: 'progress' },
  bloqueado: { label: 'Bloqueado', tone: 'blocked' },
  falta_informacion: { label: 'Falta información', tone: 'waiting' },
  esperando_aprobacion: { label: 'Esperando aprobación', tone: 'waiting' },
  completado: { label: 'Completado', tone: 'done' },
}

export const MINUTE_ESTADO: Record<MinuteEstado, StatusInfo> = {
  pendiente: { label: 'Pendiente', tone: 'idle' },
  en_desarrollo: { label: 'En desarrollo', tone: 'progress' },
  resuelto: { label: 'Resuelto', tone: 'done' },
  definir: { label: 'Definir en reunión', tone: 'discuss' },
}

export const INGESTA_ESTADO: Record<EstadoIngesta, StatusInfo> = {
  no_iniciado: { label: 'No iniciado', tone: 'idle' },
  en_proceso: { label: 'En proceso', tone: 'progress' },
  completado: { label: 'Completado', tone: 'done' },
  no_resuelto: { label: 'No resuelto', tone: 'danger' },
  cancelado: { label: 'Cancelado', tone: 'muted' },
}

export const ERROR_STATUS: Record<ErrorStatus, StatusInfo> = {
  abierto: { label: 'Abierto', tone: 'danger' },
  en_revision: { label: 'En proceso', tone: 'progress' },
  resuelto: { label: 'Resuelto', tone: 'done' },
  cerrado: { label: 'Cerrado', tone: 'muted' },
}

export const ERROR_SEVERITY: Record<ErrorSeverity, { label: string; tone: StatusTone }> = {
  baja: { label: 'Baja', tone: 'idle' },
  media: { label: 'Media', tone: 'waiting' },
  alta: { label: 'Alta', tone: 'danger' },
  critica: { label: 'Crítica', tone: 'danger' },
}

/**
 * Estado a mostrar de una actividad: si ya vencio y no esta cerrada, manda "Vencido" (es lo que
 * hay que ver primero), salvo que este bloqueada, que es mas informativo.
 */
export function estadoActividad(status: ActivityStatus, dueDate?: string | null): StatusInfo {
  if (status !== 'completado' && status !== 'bloqueado' && dueDate && vencida(dueDate)) {
    return { label: 'Vencido', tone: 'danger' }
  }
  return ACTIVITY_STATUS[status]
}

/** true si el dia de entrega ya paso (antes de hoy, en hora local). */
export function vencida(dueDate: string): boolean {
  return getDaysRemainingLocal(dueDate) < 0
}

/** Prioridad de actividades y proyectos: 1 alta, 2 media, 3 baja. */
export const PRIORITY_LABEL: Record<number, string> = { 1: 'Alta', 2: 'Media', 3: 'Baja' }
