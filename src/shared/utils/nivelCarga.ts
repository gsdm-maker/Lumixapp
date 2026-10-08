/** Nivel de carga de un dia o una semana. */
export type NivelCarga = 'libre' | 'normal' | 'alta' | 'saturado'

// Un solo nombre por nivel en toda la app (panel del chat, Planificacion).
export const TEXTO_NIVEL: Record<NivelCarga, string> = {
  libre: 'libre',
  normal: 'normal',
  alta: 'alta',
  saturado: 'saturado',
}
