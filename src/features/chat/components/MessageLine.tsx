import { forwardRef, type ReactNode } from 'react'
import { IconButton } from '@shared/components/ui/Button'
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
  timestamp: string
  /** Nombre del autor. Sin autor la linea es solo de Lumix (no hay mensaje de origen cargado). */
  author?: string
  category?: string | null
  /** Mensaje propio: fondo apenas hundido, no una burbuja de color. */
  own?: boolean
  optimistic?: boolean
  quoted?: ReactNode
  content?: string
  onReply?: () => void
  /** Lo que Lumix hizo con este mensaje, colgado debajo. */
  children?: ReactNode
}

/**
 * Una linea del registro de trabajo: hora a la izquierda (escritorio), autor y texto. Reemplaza
 * a la burbuja de WhatsApp: se lee como un acta (quien dijo que, a que hora, y que salio).
 */
export const MessageLine = forwardRef<HTMLDivElement, Props>(function MessageLine(
  { timestamp, author, category, own, optimistic, quoted, content, onReply, children },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cx(
        'group grid grid-cols-1 sm:grid-cols-[3rem_minmax(0,1fr)] gap-x-3 px-3 sm:px-4 py-2 transition-colors duration-500',
        own && 'bg-surface-soft',
      )}
    >
      <time
        dateTime={timestamp}
        className="hidden sm:block pt-0.5 text-right text-xs text-fg-faint tabular-nums"
      >
        {hora(timestamp)}
      </time>
      <div className="min-w-0">
        {author && (
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-sm font-semibold text-fg truncate">{author}</span>
            {category && (
              <span className="text-xs text-fg-faint">{CATEGORIA[category] ?? category}</span>
            )}
            <time dateTime={timestamp} className="sm:hidden text-xs text-fg-faint tabular-nums">
              {hora(timestamp)}
            </time>
            {optimistic && <span className="text-xs text-fg-faint">enviando…</span>}
            {/* En tactil queda siempre visible: ahi no hay hover que valga. */}
            {onReply && !optimistic && (
              <IconButton
                icon="reply"
                label="Responder"
                size="xs"
                onClick={onReply}
                className="ml-auto -my-1 shrink-0 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
              />
            )}
          </div>
        )}
        {quoted && <div className="mt-0.5">{quoted}</div>}
        {content && (
          <p
            className={cx(
              'text-sm text-fg-body leading-relaxed whitespace-pre-wrap break-words',
              optimistic && 'opacity-70',
            )}
          >
            {content}
          </p>
        )}
        {children && <div className={cx('space-y-1.5', author && 'mt-1.5')}>{children}</div>}
      </div>
    </div>
  )
})
