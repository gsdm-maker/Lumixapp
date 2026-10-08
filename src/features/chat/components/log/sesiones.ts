import type { ChatMessage } from '@features/chat/types'
import { esLumix, esResultadoDeTrabajo, tipoDe } from './registro'

/** Una conversacion del historial: un tramo del chat (por dia o desde "Nueva conversacion"). */
export interface Sesion {
  /** Primer mensaje del tramo: al tocar la sesion se salta ahi. */
  id: string
  titulo: string
  cuando: string
  acciones: number
}

// Una pausa larga tambien abre una conversacion nueva: volver despues de almuerzo es otro tema.
const PAUSA_MS = 3 * 60 * 60 * 1000
const MAX_TITULO = 48

/** Marca de "Nueva conversacion" (un mensaje de Lumix con este tipo). */
export const esNuevaConversacion = (m: ChatMessage) => tipoDe(m) === 'nueva_conversacion'

/**
 * Historial de conversaciones (panel derecho del chat). El chat de cada persona es un solo
 * registro; aca se corta en tramos -por dia, por pausa larga o donde la persona pidio "Nueva
 * conversacion"- y cada tramo se titula con lo primero que escribio. Lo mas nuevo primero.
 * Solo cubre los mensajes cargados en el chat.
 */
export function sesionesDe(messages: ChatMessage[], max = 8): Sesion[] {
  const sesiones: (Sesion & { ultimo: number })[] = []
  for (const m of messages) {
    const t = new Date(m.created_at).getTime()
    const actual = sesiones[sesiones.length - 1]
    const corta =
      !actual ||
      esNuevaConversacion(m) ||
      new Date(actual.cuando).toDateString() !== new Date(m.created_at).toDateString() ||
      t - actual.ultimo > PAUSA_MS
    if (corta) {
      sesiones.push({ id: m.id, titulo: '', cuando: m.created_at, acciones: 0, ultimo: t })
      if (esNuevaConversacion(m)) continue
    }
    const s = sesiones[sesiones.length - 1]
    s.ultimo = t
    if (!esLumix(m) && !s.titulo && m.content.trim()) {
      const texto = m.content.trim().replace(/\s+/g, ' ')
      s.titulo = texto.length > MAX_TITULO ? `${texto.slice(0, MAX_TITULO - 1)}…` : texto
    }
    if (esLumix(m) && esResultadoDeTrabajo(m)) s.acciones++
  }
  return sesiones
    .filter((s) => s.titulo || s.acciones)
    .map(({ ultimo: _ultimo, ...s }) => ({ ...s, titulo: s.titulo || 'Conversación con Lumix' }))
    .reverse()
    .slice(0, max)
}
