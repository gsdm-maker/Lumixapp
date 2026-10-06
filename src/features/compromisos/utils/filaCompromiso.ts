import { ACTIVITY_STATUS, type StatusInfo } from '@shared/utils/estados'
import type { Compromiso } from '@features/compromisos/hooks/useCompromisos'

// Lecturas de un compromiso que comparten la tabla y la linea de resumen.

/**
 * Semanas que lleva abierto un compromiso, de 0 a 3 (3 = "tres o mas"). Cuenta la semana
 * vencida en curso y tambien las veces que se movio la fecha: uno que se arrastro dos veces y
 * hoy esta al dia igual lleva dos semanas dando vueltas, y eso es lo que la regla mira.
 */
export function semanasAbierto(c: Compromiso): number {
  if (c.status === 'completado') return 0
  const porAtraso = Math.ceil(c.diasVencida / 7)
  return Math.min(3, Math.max(porAtraso, c.plazo_change_count ?? 0))
}

/** Estado de la fila en el vocabulario de la reunion: a tiempo / fuera de plazo / vencida. */
export function estadoCompromiso(c: Compromiso): StatusInfo {
  if (c.status === 'completado')
    return c.aTiempo
      ? { label: 'A tiempo', tone: 'done' }
      : { label: 'Fuera de plazo', tone: 'waiting' }
  if (c.diasVencida > 0) return { label: `Vencida hace ${c.diasVencida} d`, tone: 'danger' }
  return ACTIVITY_STATUS[c.status]
}

/** La misma escala para el equipo, el grupo y la persona: tiene que significar lo mismo. */
export function tonoAvance(pct: number | null, meta: number) {
  if (pct === null) return 'default' as const
  return pct >= meta ? ('success' as const) : pct >= 60 ? ('warning' as const) : ('danger' as const)
}
