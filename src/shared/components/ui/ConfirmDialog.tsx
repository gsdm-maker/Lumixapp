import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Modal } from './Modal'
import { Button } from './Button'

interface ConfirmOptions {
  title: string
  /** Que pasa exactamente: nombrar lo que se borra y lo que arrastra. */
  message?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** 'danger' para lo irreversible (boton rojo). */
  tone?: 'danger' | 'default'
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

/**
 * Confirmacion unica de la app (antes habia 5 variantes, con los botones en distinto orden).
 *
 *   const confirm = useConfirm()
 *   if (!(await confirm({ title: 'Eliminar actividad', message: '...', tone: 'danger' }))) return
 *
 * Regla (docs/design-system.md): confirmar SOLO lo irreversible. Lo reversible se hace al tiro
 * y ofrece "Deshacer" en un aviso (toast.success(msg, { action })).
 */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm debe usarse dentro de ConfirmProvider')
  return ctx
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<(v: boolean) => void>(() => {})

  const confirm = useCallback<ConfirmFn>((options) => {
    setPending(options)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const cerrar = (valor: boolean) => {
    resolver.current(valor)
    setPending(null)
  }

  const value = useMemo(() => confirm, [confirm])

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal
        open={!!pending}
        onClose={() => cerrar(false)}
        title={pending?.title}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => cerrar(false)}>
              {pending?.cancelLabel ?? 'Cancelar'}
            </Button>
            <Button
              variant={pending?.tone === 'danger' ? 'danger' : 'primary'}
              onClick={() => cerrar(true)}
            >
              {pending?.confirmLabel ?? 'Confirmar'}
            </Button>
          </>
        }
      >
        {pending?.message && <div className="text-sm text-fg-muted">{pending.message}</div>}
      </Modal>
    </ConfirmContext.Provider>
  )
}
