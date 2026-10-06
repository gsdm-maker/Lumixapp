import { useId, type ReactNode } from 'react'
import { cx } from '@shared/utils/cx'
import { useOverlay } from '@shared/hooks/useOverlay'
import { IconButton } from './Button'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  /** Una linea bajo el titulo para dar contexto. */
  description?: ReactNode
  children: ReactNode
  /** Botonera fija al pie: Cancelar a la izquierda, accion principal a la derecha. */
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** false = tocar fuera no cierra (decisiones que no deben perderse por un toque). */
  dismissible?: boolean
}

const SIZE = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' }

/**
 * Dialogo centrado. Para decisiones y formularios cortos; para editar el detalle de algo que
 * esta en una lista usar <SidePanel>, que no tapa la lista.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  dismissible = true,
}: ModalProps) {
  const ref = useOverlay(open, onClose)
  const titleId = useId()

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/40"
      onMouseDown={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cx(
          'w-full flex flex-col bg-panel border border-border-strong shadow-xl outline-none',
          'max-h-[90dvh] rounded-t-xl sm:rounded-lg',
          SIZE[size],
        )}
      >
        {title && (
          <div className="flex items-start gap-3 px-5 pt-4 pb-3 border-b border-border">
            <div className="flex-1 min-w-0">
              <h2 id={titleId} className="text-lg font-semibold text-fg">
                {title}
              </h2>
              {description && <p className="text-xs text-fg-faint mt-0.5">{description}</p>}
            </div>
            <IconButton
              icon="x"
              label="Cerrar"
              onClick={onClose}
              className="-mr-2 -mt-1"
              data-overlay-close
            />
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div
            className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
