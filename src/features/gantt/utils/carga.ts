// Lectura de la carga de trabajo en Planificacion: estado semanal por persona y nivel de
// calor de cada celda persona x dia.
//
// El color es semantico y sale de tokens (acento -> ambar -> rojo), asi el mapa de calor
// cambia con el tema y el acento sin tocar esta pantalla.

import type { StatusInfo } from '@shared/utils/estados'
import type { Activity } from '@shared/types'

/** Horas semanales de referencia (mismo numero que useGantt usa para el % de carga). */
export const HORAS_SEMANA = 42
/** Capacidad de un dia habil: la semana de referencia repartida en 5 dias. */
export const CAPACIDAD_DIA = HORAS_SEMANA / 5
/** Horas que se asumen cuando una actividad no tiene estimacion (mismo default que useGantt). */
export const HORAS_DEFAULT = 3

export const OPCIONES_HORAS = [1, 2, 3, 4, 5, 8, 12] as const

export const horasDe = (a: Activity) => a.estimated_hours ?? HORAS_DEFAULT

export const horasDia = (acts: Activity[]) => acts.reduce((s, a) => s + horasDe(a), 0)

/** Estado semanal segun el % de carga. Mismos umbrales que antes (70 / 90 / 100). */
export function estadoCarga(pct: number): StatusInfo {
  if (pct > 100) return { label: 'Crítico', tone: 'danger' }
  if (pct >= 90) return { label: 'Saturado', tone: 'danger' }
  if (pct >= 70) return { label: 'Advertencia', tone: 'waiting' }
  return { label: 'Normal', tone: 'idle' }
}

/**
 * Nivel de calor de una celda (0 a 4) segun las horas del dia contra la capacidad diaria:
 * hasta la mitad es tenue, hasta lleno es acento, pasado es ambar y muy pasado es rojo.
 */
export function nivelCalor(horas: number): 0 | 1 | 2 | 3 | 4 {
  if (horas <= 0) return 0
  const r = horas / CAPACIDAD_DIA
  if (r <= 0.5) return 1
  if (r <= 1) return 2
  if (r <= 1.3) return 3
  return 4
}

export const CALOR_CLASE: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'text-fg-faint',
  1: 'bg-accent/10 text-fg',
  2: 'bg-accent/25 text-fg',
  3: 'bg-warning/25 text-fg font-semibold',
  4: 'bg-danger/30 text-fg font-semibold',
}

/** Formato de horas en espanol: "3 h", "8,4 h". */
export const fmtHoras = (h: number) =>
  `${h.toLocaleString('es-CL', { maximumFractionDigits: 1 })} h`

/** YYYY-MM-DD de hoy en hora LOCAL (toISOString daria el dia UTC, que de noche ya es mañana). */
export function hoyYMD(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
