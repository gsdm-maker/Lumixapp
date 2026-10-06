import type { ReactNode } from 'react'
import { cx } from '@shared/utils/cx'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const PADDING = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-5' }

/**
 * Contenedor con borde para separar un bloque de la pagina. Sin sombra ni desenfoque: la
 * jerarquia sale del borde y del fondo. Usarlo con criterio: no todo bloque necesita ser una
 * tarjeta (ver docs/design-system.md, "Bordes, no tarjetas").
 */
export function Card({ children, className, padding = 'md' }: CardProps) {
  return (
    <div className={cx('rounded-lg border border-border bg-panel', PADDING[padding], className)}>
      {children}
    </div>
  )
}
