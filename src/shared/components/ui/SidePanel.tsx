import { useId, type ReactNode } from 'react'
import { cx } from '@shared/utils/cx'
import { useOverlay } from '@shared/hooks/useOverlay'
import { IconButton } from './Button'

interface SidePanelProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  /** Linea chica sobre el titulo (contexto: proyecto padre, equipo...). */
  eyebrow?: ReactNode
  children: ReactNode
  /** Acciones fijas al pie del panel. */
  footer?: ReactNode
  width?: 'md' | 'lg'
}

const WIDTH = { md: 'sm:w-[400px]', lg: 'sm:w-[480px]' }

/**
 * Margen para que una lista deje espacio al panel abierto en escritorio (ancho `md`). Vive aca
 * para que el ancho del panel y el hueco de la lista no se desincronicen.
 */
export const SIDE_PANEL_OFFSET = 'lg:pr-[400px]'

/**
 * Panel de detalle a la derecha (idea 8 y 13 de la propuesta UI/UX).
 *
 * En pantallas anchas NO oscurece ni bloquea la lista de atras: se puede seguir clickeando
 * otras filas y el panel cambia de contenido, que es la gracia frente a un modal. En el
 * celular ocupa la pantalla completa, como una hoja.
 */
export function SidePanel({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  width = 'md',
}: SidePanelProps) {
  const ref = useOverlay(open, onClose, { lockScroll: false })
  const titleId = useId()

  if (!open) return null

  return (
    <>
      {/* Fondo solo en movil: en escritorio la lista de atras sigue usable. */}
      <div
        className="fixed inset-0 z-40 bg-black/40 sm:hidden animate-in fade-in-0 duration-200"
        onClick={onClose}
      />
      <aside
        ref={ref}
        role="dialog"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cx(
          'fixed z-40 inset-0 sm:inset-auto sm:top-0 sm:bottom-0 sm:right-0 w-full flex flex-col',
          // Orbita: flota separado del borde, con esquinas de tarjeta (en el celular, pantalla completa).
          'bg-panel border-border shadow-lg outline-none sm:m-2 sm:rounded-3xl sm:border overflow-hidden',
          // Entra deslizandose desde la derecha (estilo "sheet" de shadcn/ui).
          'animate-in slide-in-from-right duration-300 ease-out',
          WIDTH[width],
        )}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex items-start gap-3 px-5 pt-4 pb-3 border-b border-border">
          <div className="flex-1 min-w-0">
            {eyebrow && <div className="text-xs text-fg-faint mb-1 truncate">{eyebrow}</div>}
            {title &&
              (typeof title === 'string' ? (
                <h2 id={titleId} className="text-lg font-semibold text-fg leading-snug">
                  {title}
                </h2>
              ) : (
                // Titulo editable (EditableText es un <div>): no puede ir dentro de un <h2>.
                <div
                  id={titleId}
                  role="heading"
                  aria-level={2}
                  className="text-lg font-semibold text-fg leading-snug"
                >
                  {title}
                </div>
              ))}
          </div>
          <IconButton
            icon="x"
            label="Cerrar panel"
            onClick={onClose}
            className="-mr-2 -mt-1"
            data-overlay-close
          />
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div
            className="flex flex-wrap items-center gap-2 px-5 py-3 border-t border-border"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
          >
            {footer}
          </div>
        )}
      </aside>
    </>
  )
}
