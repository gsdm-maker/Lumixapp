import type { Activity, MinuteEstado, MinuteItem } from '@shared/types'

/**
 * Estado efectivo de un tema de minuta: si tiene actividades vinculadas, se deriva de ellas
 * (sincronizado con lo que pasa en Actividades) en vez de confiar en el campo `estado` crudo,
 * que puede quedar desactualizado.
 *
 * Antes vivia solo en useMinuta.ts; se extrajo aca porque el chat (buildTeamData) necesita el
 * MISMO calculo para responder preguntas sobre la minuta sin reimplementarlo aparte.
 */
export function deriveEstado(item: MinuteItem, byId: Record<string, Activity>): MinuteEstado {
  const acts = item.linked_activity_ids.map((id) => byId[id]).filter(Boolean)
  if (acts.length === 0) return item.estado
  if (acts.every((a) => a.status === 'completado')) return 'resuelto'
  if (acts.some((a) => a.status !== 'pendiente')) return 'en_desarrollo'
  return 'pendiente'
}

/**
 * Actividades que cuentan como "compromiso": nacieron de un tema de Minuta o de un item de
 * Proyectos (aparecen en `linked_activity_ids` de algun item que se pase en `minuteItems`) y su
 * entrega cae dentro de la ventana [desde, hasta]. Lo creado como actividad propia por el chat
 * no tiene item y queda fuera.
 *
 * No filtra por visibilidad de rol: cada consumidor (la pagina Compromisos, el chat) aplica
 * su propia regla de "que puede ver quien" por separado, igual que ya hacia useCompromisos.ts.
 */
export function compromisosEnVentana(
  activities: Activity[],
  minuteItems: Pick<MinuteItem, 'linked_activity_ids'>[],
  desde: Date,
  hasta: Date,
): Activity[] {
  const deMinuta = new Set(minuteItems.flatMap((t) => t.linked_activity_ids))
  return activities.filter((a) => {
    if (!deMinuta.has(a.id)) return false
    const d = new Date(a.due_date)
    return d >= desde && d <= hasta
  })
}

/**
 * Compromisos vencidos y no cerrados, de CUALQUIER semana: nacieron de un tema de minuta o de
 * un proyecto, su
 * entrega ya paso (antes de hoy) y siguen sin completarse.
 *
 * Existe porque la ventana semanal de compromisosEnVentana los esconde: lo que vencia la
 * semana pasada y nadie movio ni cumplio desaparecia de la semana actual, y solo se veia
 * retrocediendo con ‹. Lo no cumplido se "perdia" solo y el % de la semana salia limpio.
 *
 * Mismo criterio de "vencido" que compromisoStats (dia de entrega < hoy, a medianoche), para
 * que la pantalla y el chat cuenten igual. Orden: el mas antiguo primero.
 */
export function compromisosVencidosAbiertos(
  activities: Activity[],
  minuteItems: Pick<MinuteItem, 'linked_activity_ids'>[],
): Activity[] {
  const deMinuta = new Set(minuteItems.flatMap((t) => t.linked_activity_ids))
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  return activities
    .filter((a) => {
      if (!deMinuta.has(a.id) || a.status === 'completado') return false
      const vence = new Date(a.due_date)
      vence.setHours(0, 0, 0, 0)
      return vence < hoy
    })
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
}

export interface CompromisoStats {
  total: number
  cumplidos: number
  vencidos: number
  porcentaje: number | null
  /** El 90% es la referencia de EOS para un equipo sano, no un invento. */
  meta: number
}

/** Resumen numerico sobre una lista de compromisos YA filtrada (ver compromisosEnVentana). */
export function compromisoStats(compromisos: Activity[]): CompromisoStats {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const total = compromisos.length
  const cumplidos = compromisos.filter((a) => a.status === 'completado').length
  const vencidos = compromisos.filter((a) => {
    if (a.status === 'completado') return false
    const vence = new Date(a.due_date)
    vence.setHours(0, 0, 0, 0)
    return vence < hoy
  }).length
  return {
    total,
    cumplidos,
    vencidos,
    porcentaje: total ? Math.round((cumplidos / total) * 100) : null,
    meta: 90,
  }
}
