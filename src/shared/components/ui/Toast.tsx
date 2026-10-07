import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { Toaster, toast as sonner } from 'sonner'
import { useTheme } from '@core/theme/ThemeContext'
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

/**
 * Avisos con sonner (el de shadcn/ui): se apilan, entran con animacion y se pueden descartar
 * deslizando. La API (useToast().success(msg, { action })) es la misma de antes, asi que
 * ninguna pantalla cambia.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { theme } = useTheme()

  const api = useMemo<ToastApi>(() => {
    const show = (message: string, type: ToastType = 'info', o: ToastOptions = {}) => {
      const opciones = {
        duration: o.duration ?? (o.action ? 6000 : 3500),
        action: o.action ? { label: o.action.label, onClick: o.action.onClick } : undefined,
      }
      if (type === 'success') sonner.success(message, opciones)
      else if (type === 'error') sonner.error(message, opciones)
      else sonner(message, opciones)
    }
    return {
      show,
      success: (m, o) => show(m, 'success', o),
      error: (m, o) => show(m, 'error', o),
      info: (m, o) => show(m, 'info', o),
    }
  }, [])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Toaster
        theme={theme}
        position="bottom-center"
        // Sobre la barra inferior en el celular; en escritorio, abajo con margen normal.
        offset={{ bottom: 20 }}
        mobileOffset={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
        visibleToasts={3}
        icons={{
          success: <Icon name="circleCheck" size={16} className="text-success" />,
          error: <Icon name="alert" size={16} className="text-danger" />,
          info: <Icon name="info" size={16} className="text-fg-faint" />,
        }}
        toastOptions={{
          classNames: {
            toast:
              '!bg-panel !text-fg !border !border-border-strong !rounded-xl !shadow-lg !font-sans !text-sm !gap-2.5',
            actionButton:
              '!bg-transparent !text-accent !font-medium !text-sm hover:!bg-accent-soft !rounded-md',
          },
        }}
      />
    </ToastContext.Provider>
  )
}
