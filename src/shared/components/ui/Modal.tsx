import type { ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { cx } from '@shared/utils/cx'
import { useCapaEnPila } from '@shared/hooks/useOverlay'
import { Icon } from './Icon'

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

const SIZE = { sm: 'sm:max-w-sm', md: 'sm:max-w-md', lg: 'sm:max-w-lg', xl: 'sm:max-w-2xl' }

/**
 * Dialogo centrado sobre Radix (la base de shadcn/ui): foco atrapado, Escape, bloqueo de scroll
 * y lectores de pantalla resueltos, con animacion corta de entrada y salida. En el celular sube
 * desde abajo como una hoja.
 *
 * Para decisiones y formularios cortos; para editar el detalle de algo de una lista usar
 * <SidePanel>, que no tapa la lista.
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
  useCapaEnPila(open)

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content
          // Sin descripcion, se le avisa a Radix que no hay (si no, advierte en consola).
          {...(description ? {} : { 'aria-describedby': undefined })}
          onInteractOutside={(e) => {
            if (!dismissible) e.preventDefault()
          }}
          className={cx(
            'fixed z-50 flex flex-col w-full bg-panel border border-border shadow-lg outline-none overflow-hidden',
            'max-h-[90dvh] bottom-0 left-0 rounded-t-3xl',
            'sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
            'data-[state=open]:slide-in-from-bottom-6 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95 duration-200',
            SIZE[size],
          )}
        >
          {title ? (
            <div className="flex items-start gap-3 px-5 pt-4 pb-3 border-b border-border">
              <div className="flex-1 min-w-0">
                <Dialog.Title className="text-lg font-semibold text-fg tracking-tight">
                  {title}
                </Dialog.Title>
                {description && (
                  <Dialog.Description className="text-xs text-fg-faint mt-0.5">
                    {description}
                  </Dialog.Description>
                )}
              </div>
              <Dialog.Close
                aria-label="Cerrar"
                className="-mr-2 -mt-1 inline-flex items-center justify-center w-8 h-8 rounded-full text-fg-faint hover:text-fg hover:bg-surface transition-colors"
              >
                <Icon name="x" size={16} />
              </Dialog.Close>
            </div>
          ) : (
            // Radix exige un titulo para lectores de pantalla aunque no se muestre.
            <Dialog.Title className="sr-only">Diálogo</Dialog.Title>
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
