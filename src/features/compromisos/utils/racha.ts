import { semanaDe } from '@features/compromisos/hooks/useCompromisos'
import { compromisoStats, compromisosEnVentana } from '@shared/utils/compromisos'
import type { Activity, MinuteItem } from '@shared/types'

/** Umbral de la racha: semanas seguidas con al menos este % de compromisos cumplidos. */
export const UMBRAL_RACHA = 80
const MAX_SEMANAS = 26

/**
 * Semanas seguidas (hacia atras desde la anterior) con el % de compromisos sobre el umbral. La
 * semana en curso no cuenta: todavia no termina. Una semana sin compromisos corta la racha.
 */
export function rachaCompromisos(actividades: Activity[], temas: MinuteItem[]): number {
  let racha = 0
  for (let offset = -1; offset >= -MAX_SEMANAS; offset--) {
    const { desde, hasta } = semanaDe(offset)
    const { porcentaje } = compromisoStats(compromisosEnVentana(actividades, temas, desde, hasta))
    if (porcentaje === null || porcentaje < UMBRAL_RACHA) break
    racha++
  }
  return racha
}
