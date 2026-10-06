// Referencia compacta al mensaje que se responde. Se usa en dos lugares: arriba del campo
// mientras escribes la respuesta, y en la linea del mensaje una vez enviada.
//
// El texto viene de la copia guardada al responder, no del mensaje original: el chat carga
// los ultimos 50 mensajes y el original puede quedar fuera de esa ventana.

import type { ReplyTarget } from '@features/chat/types'
import { Icon } from '@shared/components/ui/Icon'
import { IconButton } from '@shared/components/ui/Button'
import { cx } from '@shared/utils/cx'

type Props = {
  reply: ReplyTarget
  /** Saltar al mensaje original. Solo se ofrece si sigue cargado en el hilo. */
  onJump?: () => void
  /** Cancelar la respuesta (solo en el preview sobre el input). */
  onCancel?: () => void
}

export function QuotedMessage({ reply, onJump, onCancel }: Props) {
  const text = reply.text.length > 120 ? `${reply.text.slice(0, 120)}…` : reply.text
  // "Tu" se guarda sin tilde en la copia (viene asi desde antes); se corrige solo al mostrar.
  const author = reply.author === 'Tu' ? 'Tú' : reply.author

  return (
    <div className="flex items-center gap-1 min-w-0">
      <button
        type="button"
        onClick={onJump}
        disabled={!onJump}
        title={onJump ? 'Ir al mensaje original' : undefined}
        className={cx(
          'flex-1 min-w-0 flex items-center gap-1.5 border-l-2 border-border-strong pl-2 py-0.5 text-left text-xs',
          onJump ? 'cursor-pointer hover:border-accent' : 'cursor-default',
        )}
      >
        <Icon name="reply" size={14} className="text-fg-faint" />
        <span className="font-medium text-fg-muted shrink-0">{author}</span>
        <span className="text-fg-faint truncate">{text}</span>
      </button>
      {onCancel && <IconButton icon="x" label="Cancelar respuesta" size="xs" onClick={onCancel} />}
    </div>
  )
}
