// Niveles de carga de la Planificacion (dia y semana) y su color. Los usan el calendario, las
// personas con su % de saturacion y el panel del chat (mismos cortes en todos lados).

import type { GanttRow } from '@features/gantt/hooks/useGantt'
import { HORAS_SEMANA } from './carga'

import type { NivelCarga } from '@shared/utils/nivelCarga'

export type Nivel = NivelCarga

/** Nivel de carga de un dia contra su capacidad (mismos cortes que el mapa de calor). */
export function nivelDia(horas: number, capacidad: number): Nivel {
  if (horas < capacidad * 0.5) return 'libre'
  if (horas <= capacidad) return 'normal'
  if (horas <= capacidad * 1.3) return 'alta'
  return 'saturado'
}

/** Nivel de la semana segun el % de saturacion (mismos cortes que el estado de carga). */
export function nivelSemana(pct: number): Nivel {
  if (pct < 50) return 'libre'
  if (pct < 70) return 'normal'
  if (pct < 90) return 'alta'
  return 'saturado'
}

export const PILL_NIVEL: Record<Nivel, string> = {
  libre: 'bg-success-soft text-success',
  normal: 'bg-accent-soft text-accent',
  alta: 'bg-warning-soft text-warning',
  saturado: 'bg-danger-soft text-danger',
}
/** % de saturacion de la semana para el equipo visible (horas / capacidad de todos). */
export function saturacionEquipo(rows: GanttRow[]): number {
  const horas = rows.reduce((s, r) => s + r.totalHours, 0)
  return rows.length ? Math.round((horas / (HORAS_SEMANA * rows.length)) * 100) : 0
}
