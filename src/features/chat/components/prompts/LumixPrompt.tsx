import type { ReactNode } from 'react'
import { Icon } from '@shared/components/ui/Icon'
import { LumixFirma } from '@features/chat/components/LumixLine'

interface Props {
  /** La pregunta, tal como la escribio Lumix. */
  question: string
  /** Contexto extra bajo la pregunta (ej. las actividades de un lote). */
  detail?: ReactNode
  /** Opciones como botones en fila; la sugerencia de Lumix va primero y marcada. */
  children?: ReactNode
  /** Lo que se decidio. Si viene, la pregunta se reduce a una linea gris. */
  resolution?: string | null
  /** Quien decidio (el dueño de la conversacion: es el unico que puede cerrarla). */
  decidedBy?: string
  /**
   * La pregunta es de otra conversacion (el admin lee el chat de todo el equipo).
   *
   * Se muestra, pero no se puede responder: solo su dueño puede cerrarla, y la base lo
   * exige. Sin esto el admin podia resolver la alerta de otra persona, crear la actividad a
   * su nombre y dejar la alerta abierta igual, porque la marca era rechazada.
   */
  ajena?: boolean
}

/**
 * Pregunta de Lumix dentro del registro, no en una ventana: borde punteado (falta algo) y las
 * opciones a mano. Antes eran 10 ventanas distintas que tapaban el chat; ahora la pregunta
 * queda donde se origino y, una vez resuelta, deja constancia en una sola linea.
 *
 * Resuelta = el usuario ya decidio. Deja de tener botones: desde la migracion 031 estos
 * mensajes se guardan de verdad, y si siguieran activos se podria responder la misma
 * pregunta otra vez despues de recargar y crear la actividad dos veces.
 */
export function LumixPrompt({ question, detail, children, resolution, decidedBy, ajena }: Props) {
  if (resolution) {
    return (
      <p className="flex items-start gap-1.5 text-xs text-fg-faint" title={question}>
        <Icon name="check" size={14} className="text-success mt-px" />
        <span className="min-w-0">
          {resolution}
          {decidedBy && <span> · {decidedBy}</span>}
        </span>
      </p>
    )
  }

  return (
    <div
      role="group"
      aria-label="Pregunta de Lumix"
      className="rounded-md border border-dashed border-border-strong px-3 py-2"
    >
      <LumixFirma text={question} className="text-fg" />
      {detail && <div className="mt-1.5">{detail}</div>}
      {ajena ? (
        <p className="mt-1.5 text-xs text-fg-faint">Pendiente de su responsable</p>
      ) : (
        children && <div className="mt-2 flex flex-wrap items-center gap-1.5">{children}</div>
      )}
    </div>
  )
}
