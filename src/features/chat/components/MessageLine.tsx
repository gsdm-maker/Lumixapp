import { forwardRef, type ReactNode } from 'react'
import { Avatar } from '@shared/components/ui/Avatar'
import { Nucleo } from '@shared/components/ui/Nucleo'
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
  /** Mensaje propio: burbuja de tinta a la derecha. */
  own?: boolean
  optimistic?: boolean
  /** Recien llegado: entra con una animacion corta (el historial al cargar no se anima). */
  fresh?: boolean
  quoted?: ReactNode
  content?: string
  onReply?: () => void
  /** Lo que Lumix hizo con este mensaje: va en su propia burbuja, con el nucleo. */
  children?: ReactNode
}

/**
 * Una entrada del chat (rediseno Orbita): el mensaje de la persona en burbuja -propio a la
 * derecha en tinta, ajeno a la izquierda con su avatar- y lo que Lumix hizo con el, en una
 * burbuja propia con el nucleo. Sigue siendo un registro de trabajo (quien dijo que y que salio)
 * con los gestos de una mensajeria: agrupar seguidos, responder al pasar el mouse, entrada suave.
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
        'group relative px-3 sm:px-5 rounded-2xl transition-colors duration-500',
        continuation ? 'pt-1' : 'pt-3',
        fresh && 'animate-aparecer',
      )}
    >
      {!lumixSolo && (
        <div className={cx('flex gap-2.5', own ? 'justify-end' : 'justify-start')}>
          {!own && (
            <div className="w-8 shrink-0 pt-5">
              {!continuation && (
                <Avatar name={author} src={avatarSrc} size="sm" className="!w-8 !h-8" />
              )}
            </div>
          )}
          <div
            className={cx(
              'min-w-0 max-w-[min(36rem,85%)] flex flex-col',
              own ? 'items-end' : 'items-start',
            )}
          >
            {!continuation && (
              <div className="flex items-baseline gap-2 min-w-0 px-1 mb-1">
                {!own && <span className="text-xs font-semibold text-fg truncate">{author}</span>}
                <time dateTime={timestamp} className="text-2xs text-fg-faint tabular-nums">
                  {hora(timestamp)}
                </time>
                {category && (
                  <span className="text-2xs text-fg-faint">
                    · {CATEGORIA[category] ?? category}
                  </span>
                )}
                {optimistic && <span className="text-2xs text-fg-faint">· enviando…</span>}
              </div>
            )}
            {quoted && <div className="mb-1 w-full">{quoted}</div>}
            {content && (
              <p
                className={cx(
                  'px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-xs',
                  own
                    ? 'bg-fg text-shell rounded-[20px] rounded-br-md'
                    : 'bg-panel text-fg-body border border-border rounded-[20px] rounded-bl-md',
                  optimistic && 'opacity-60',
                )}
              >
                {content}
              </p>
            )}
          </div>
        </div>
      )}

      {children && (
        <div className={cx('flex gap-2.5 max-w-[42rem]', !lumixSolo && 'mt-2')}>
          <div className="w-8 shrink-0 grid place-items-start justify-center pt-1">
            <Nucleo size={24} />
          </div>
          {/* La burbuja de Lumix ya muestra el nucleo: la firma no repite "Lumix" ni su icono. */}
          <div className="min-w-0 flex-1 space-y-2 rounded-[20px] rounded-tl-md border border-border bg-panel px-4 py-3 shadow-xs [&_.firma-marca]:hidden [&_.firma-nombre]:hidden">
            {children}
          </div>
        </div>
      )}

      {/* Acciones flotantes: aparecen al pasar el mouse. En tactil quedan siempre visibles,
          chicas, porque ahi no hay hover. */}
      {onReply && !optimistic && (
        <div
          className={cx(
            'absolute top-1 md:top-0 flex items-center rounded-full border border-border bg-panel shadow-sm md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity',
            own ? 'left-3 sm:left-5' : 'right-3 sm:right-5',
          )}
        >
          <button
            type="button"
            onClick={onReply}
            aria-label="Responder"
            title="Responder"
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs text-fg-muted hover:text-fg hover:bg-surface"
          >
            <Icon name="reply" size={14} />
            <span className="hidden md:inline">Responder</span>
          </button>
        </div>
      )}
    </div>
  )
})
