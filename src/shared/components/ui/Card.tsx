import type { ReactNode } from 'react'
import { cx } from '@shared/utils/cx'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const PADDING = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-5' }

/**
 * Contenedor con borde y una sombra minima (estilo shadcn/ui) para separar un bloque de la
 * pagina. Usarlo con criterio: no todo bloque necesita ser una tarjeta (ver
 * docs/design-system.md).
 */
export function Card({ children, className, padding = 'md' }: CardProps) {
  return <div className={cx('lamina', PADDING[padding], className)}>{children}</div>
}
