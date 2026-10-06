import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { cx } from '@shared/utils/cx'
import { Icon } from './Icon'

type ToastType = 'success' | 'error' | 'info'

interface ToastAction {
  label: string
  onClick: () => void
}

interface ToastOptions {
  /** Boton dentro del aviso, ej. { label: 'Deshacer', onClick }. */
  action?: ToastAction
  /** Milisegundos. Por defecto 3.5s, 6s si trae accion (hay que alcanzar a usarla). */
  duration?: number
}

interface ToastItem extends ToastOptions {
  id: number
  type: ToastType
  message: string
}

interface ToastApi {
  show: (message: string, type?: ToastType, options?: ToastOptions) => void
  success: (message: string, options?: ToastOptions) => void
  error: (message: string, options?: ToastOptions) => void
  info: (message: string, options?: ToastOptions) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider')
  return ctx
}

let counter = 0

const MARCA: Record<ToastType, { icon: 'check' | 'alert' | 'info'; color: string }> = {
  success: { icon: 'check', color: 'text-success' },
  error: { icon: 'alert', color: 'text-danger' },
  info: { icon: 'info', color: 'text-fg-faint' },
}

/**
 * Avisos sutiles abajo al centro. Superficie neutra con un icono de color: el aviso confirma,
 * no grita. Sobre la barra inferior en el celular.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const show = useCallback(
    (message: string, type: ToastType = 'info', options: ToastOptions = {}) => {
      const id = ++counter
      setToasts((prev) => [...prev.slice(-2), { id, type, message, ...options }])
      setTimeout(() => remove(id), options.duration ?? (options.action ? 6000 : 3500))
    },
    [remove],
  )

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (m, o) => show(m, 'success', o),
      error: (m, o) => show(m, 'error', o),
      info: (m, o) => show(m, 'info', o),
    }),
    [show],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="fixed z-[100] left-1/2 -translate-x-1/2 bottom-20 md:bottom-5 flex flex-col gap-2 items-center pointer-events-none w-full max-w-sm px-4"
        style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto w-full flex items-center gap-2.5 pl-3 pr-2 py-2 rounded-lg bg-panel border border-border-strong shadow-lg text-sm text-fg"
          >
            <Icon name={MARCA[t.type].icon} size={16} className={MARCA[t.type].color} />
            <span className="flex-1 min-w-0">{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action!.onClick()
                  remove(t.id)
                }}
                className="px-2 h-7 rounded-md text-sm font-medium text-accent hover:bg-accent-soft"
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              aria-label="Cerrar aviso"
              onClick={() => remove(t.id)}
              className={cx(
                'p-1 rounded text-fg-faint hover:text-fg',
                t.action && 'hidden sm:block',
              )}
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
