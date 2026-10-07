import type { ReactNode } from 'react'
import { cx } from '@shared/utils/cx'
import type { StatusTone } from '@shared/utils/estados'

// Forma del punto por tono: el estado se lee por la forma ademas del color (daltonismo).
const DOT: Record<StatusTone, string> = {
  idle: 'border-[1.5px] border-fg-faint',
  progress:
    'border-[1.5px] border-current bg-[linear-gradient(90deg,currentColor_50%,transparent_50%)]',
  waiting: 'border-[1.5px] border-warning border-dashed',
  blocked: 'bg-blocked rounded-[2px]',
  danger: 'bg-danger',
  done: 'bg-success',
  muted: 'border-[1.5px] border-dashed border-fg-faint',
  discuss: 'border-[1.5px] border-warning bg-warning-soft',
}

// Etiqueta con fondo suave del color del estado (mas color, al estilo Todoist), sin perder el
// punto: el estado se sigue leyendo por la forma, no solo por el color.
const PILL: Record<StatusTone, string> = {
  idle: 'bg-surface text-fg-muted',
  progress: 'bg-tag-blue-soft text-tag-blue',
  waiting: 'bg-warning-soft text-warning',
  blocked: 'bg-blocked-soft text-blocked',
  danger: 'bg-danger-soft text-danger',
  done: 'bg-success-soft text-success',
  muted: 'bg-surface text-fg-faint line-through',
  discuss: 'bg-tag-amber-soft text-tag-amber',
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
 * Estado de cualquier cosa de Lumix: etiqueta suave con punto + texto. Usar con los mapas de
 * @shared/utils/estados:  <StatusLabel {...ACTIVITY_STATUS[a.status]} />
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
        'inline-flex items-center gap-1.5 h-5 pl-1.5 pr-2 rounded-full text-xs font-medium whitespace-nowrap',
        PILL[tone],
        className,
      )}
    >
      <StatusDot tone={tone} />
      {children ?? label}
    </span>
  )
}
