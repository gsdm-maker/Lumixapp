import { forwardRef, type ReactNode } from 'react'
import { Avatar } from '@shared/components/ui/Avatar'
import { LumixIcon } from '@shared/components/ui/LumixIcon'
import { Icon } from '@shared/components/ui/Icon'
import { cx } from '@shared/utils/cx'
import { hora } from '@features/chat/components/log/registro'

const CATEGORIA: Record<string, string> = {
  actividad: 'actividad',
  error: 'error',
  reunion: 'reunión',
  recordatorio: 'recordatorio',
  nota: 'nota',
  consulta: 'consulta',
}

interface Props {
  /** Id del mensaje: ChatPage busca la linea por data-msg-id para saltar a ella. */
  msgId?: string
  timestamp: string
  /** Nombre del autor. Sin autor la linea es solo de Lumix (no hay mensaje de origen cargado). */
  author?: string
  /** Foto o emoji del autor (profiles.avatar_url). */
  avatarSrc?: string | null
  /** Sigue a un mensaje de la misma persona hace poco: sin avatar ni nombre (agrupado). */
  continuation?: boolean
  category?: string | null
  /** Mensaje propio: un tinte del acento muy suave, no una burbuja de color. */
  own?: boolean
  optimistic?: boolean
  /** Recien llegado: entra con una animacion corta (el historial al cargar no se anima). */
  fresh?: boolean
  quoted?: ReactNode
  content?: string
  onReply?: () => void
  /** Lo que Lumix hizo con este mensaje, colgado debajo. */
  children?: ReactNode
}

/**
 * Una linea del chat: avatar, autor y texto, con lo que Lumix hizo colgado debajo.
 *
 * Mantiene la idea del registro de trabajo (quien dijo que y que salio) con los gestos de una
 * mensajeria moderna: avatares, mensajes seguidos agrupados, acciones flotantes al pasar el
 * mouse y una entrada suave de lo nuevo.
 */
export const MessageLine = forwardRef<HTMLDivElement, Props>(function MessageLine(
  {
    msgId,
    timestamp,
    author,
    avatarSrc,
    continuation,
    category,
    own,
    optimistic,
    fresh,
    quoted,
    content,
    onReply,
    children,
  },
  ref,
) {
  const lumixSolo = !author
  return (
    <div
      ref={ref}
      data-msg-id={msgId}
      className={cx(
        'group relative grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 mx-1.5 sm:mx-2 px-2 sm:px-3 rounded-xl transition-colors duration-500',
        continuation ? 'pt-0.5 pb-1' : 'pt-2.5 pb-1.5 mt-1',
        own ? 'bg-accent-soft/40 hover:bg-accent-soft/60' : 'hover:bg-surface-soft',
        fresh && 'animate-aparecer',
      )}
    >
      {/* Columna izquierda: avatar al comenzar un grupo; en los mensajes siguientes, la hora
          aparece al pasar el mouse (como en Slack). */}
      <div className="pt-0.5">
        {continuation ? (
          <time
            dateTime={timestamp}
            className="block text-right text-2xs leading-5 text-fg-faint tabular-nums opacity-0 group-hover:opacity-100"
          >
            {hora(timestamp)}
          </time>
        ) : lumixSolo ? (
          <LumixIcon size="md" className="!w-8 !h-8 rounded-lg" />
        ) : (
          <Avatar name={author} src={avatarSrc} size="sm" className="!w-8 !h-8" />
        )}
      </div>

      <div className="min-w-0">
        {/* Una linea solo de Lumix no lleva encabezado: el avatar y la firma ya lo dicen. */}
        {!continuation && author && (
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-sm font-semibold text-fg truncate">{author}</span>
            <time dateTime={timestamp} className="text-xs text-fg-faint tabular-nums">
              {hora(timestamp)}
            </time>
            {category && (
              <span className="text-xs text-fg-faint">· {CATEGORIA[category] ?? category}</span>
            )}
            {optimistic && <span className="text-xs text-fg-faint">· enviando…</span>}
          </div>
        )}
        {quoted && <div className="mt-1">{quoted}</div>}
        {content && (
          <p
            className={cx(
              'text-sm text-fg-body leading-relaxed whitespace-pre-wrap break-words',
              !continuation && 'mt-0.5',
              optimistic && 'opacity-60',
            )}
          >
            {content}
          </p>
        )}
        {children && (
          <div
            className={cx(
              'space-y-2',
              !lumixSolo && 'mt-2',
              lumixSolo && 'pt-1 [&_.firma-marca]:hidden',
            )}
          >
            {children}
          </div>
        )}
      </div>

      {/* Acciones flotantes: aparecen sobre el borde al pasar el mouse. En tactil quedan
          siempre visibles, chicas, porque ahi no hay hover. */}
      {onReply && !optimistic && (
        <div className="absolute right-2 top-1 md:-top-3 flex items-center rounded-lg border border-border-strong bg-panel shadow-sm md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={onReply}
            aria-label="Responder"
            title="Responder"
            className="inline-flex items-center gap-1.5 h-7 px-2 rounded-lg text-xs text-fg-muted hover:text-fg hover:bg-surface"
          >
            <Icon name="reply" size={14} />
            <span className="hidden md:inline">Responder</span>
          </button>
        </div>
      )}
    </div>
  )
})
