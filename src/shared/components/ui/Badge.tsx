import type { ReactNode } from 'react'
import { cx } from '@shared/utils/cx'

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'blocked'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  className?: string
}

// Etiqueta chica para conteos y marcas puntuales ("Invitado", "3 vencidas"). Para el ESTADO de
// una actividad/tema usar <StatusLabel>, que es el codigo unico de estados de la app.
const VARIANT: Record<BadgeVariant, string> = {
  default: 'bg-surface text-fg-muted',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-accent-soft text-accent',
  blocked: 'bg-blocked-soft text-blocked',
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-sm px-1.5 h-5 text-xs font-medium whitespace-nowrap',
        VARIANT[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
