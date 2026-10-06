import type { ReactNode } from 'react'
import { LumixIcon } from '@shared/components/ui/LumixIcon'

/**
 * Marco comun de las pantallas de acceso (ingresar, crear cuenta, cambio de clave). Antes
 * cada una fijaba bg-slate-950 a mano e ignoraba el tema claro; ahora todo sale de los tokens.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-shell p-4">
      <main className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-6">
          <LumixIcon size="lg" />
          <h1 className="text-2xl font-semibold text-fg mt-4">{title}</h1>
          <p className="text-sm text-fg-muted mt-1">{subtitle}</p>
        </div>
        <div className="rounded-lg border border-border bg-panel p-5">{children}</div>
        {footer && <div className="text-xs text-fg-faint text-center mt-5">{footer}</div>}
      </main>
    </div>
  )
}

/** Mensaje de error o de exito de un formulario de acceso. */
export function AuthMessage({
  tone,
  children,
}: {
  tone: 'error' | 'success'
  children: ReactNode
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={
        tone === 'error'
          ? 'mb-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger'
          : 'mb-4 rounded-md bg-success-soft px-3 py-2 text-sm text-success'
      }
    >
      {children}
    </div>
  )
}
