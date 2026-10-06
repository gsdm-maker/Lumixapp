import type { ReactNode } from 'react'
import { cx } from '@shared/utils/cx'
import { Icon, type IconName } from './Icon'

interface EmptyStateProps {
  icon?: IconName
  title: string
  /** Que hacer para que deje de estar vacio. */
  description?: ReactNode
  action?: ReactNode
  className?: string
}

/** Estado vacio unico: icono chico, una frase, y como seguir. Sin ilustraciones. */
export function EmptyState({
  icon = 'list',
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cx('flex flex-col items-center text-center gap-2 py-14 px-6', className)}>
      <Icon name={icon} size={22} className="text-fg-faint" />
      <p className="text-sm font-medium text-fg">{title}</p>
      {description && <p className="text-xs text-fg-faint max-w-xs">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
