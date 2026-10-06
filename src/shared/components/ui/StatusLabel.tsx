import type { ReactNode } from 'react'
import { cx } from '@shared/utils/cx'
import type { StatusTone } from '@shared/utils/estados'

// Forma del punto por tono: el estado se lee por la forma ademas del color (daltonismo).
const DOT: Record<StatusTone, string> = {
  idle: 'border-[1.5px] border-fg-faint',
  progress:
    'border-[1.5px] border-accent bg-[linear-gradient(90deg,currentColor_50%,transparent_50%)] text-accent',
  waiting: 'border-[1.5px] border-warning border-dashed',
  blocked: 'bg-blocked rounded-[2px]',
  danger: 'bg-danger',
  done: 'bg-success',
  muted: 'border-[1.5px] border-dashed border-fg-faint',
  discuss: 'border-[1.5px] border-warning bg-warning-soft',
}

const TEXT: Record<StatusTone, string> = {
  idle: 'text-fg-muted',
  progress: 'text-fg',
  waiting: 'text-warning',
  blocked: 'text-blocked',
  danger: 'text-danger font-medium',
  done: 'text-fg-faint',
  muted: 'text-fg-faint line-through',
  discuss: 'text-warning',
}

/** Punto de estado solo (para listas muy densas, con el texto en un tooltip). */
export function StatusDot({ tone, className }: { tone: StatusTone; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx('inline-block w-2 h-2 rounded-full shrink-0', DOT[tone], className)}
    />
  )
}

/**
 * Estado de cualquier cosa de Lumix: punto + texto, sin pildora de color. Usar con los mapas
 * de @shared/utils/estados:  <StatusLabel {...ACTIVITY_STATUS[a.status]} />
 */
export function StatusLabel({
  tone,
  label,
  className,
  children,
}: {
  tone: StatusTone
  label?: string
  className?: string
  children?: ReactNode
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 text-xs whitespace-nowrap',
        TEXT[tone],
        className,
      )}
    >
      <StatusDot tone={tone} />
      {children ?? label}
    </span>
  )
}
