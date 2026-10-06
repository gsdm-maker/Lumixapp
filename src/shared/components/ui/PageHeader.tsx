import type { ReactNode } from 'react'
import { cx } from '@shared/utils/cx'

interface PageHeaderProps {
  title: ReactNode
  /** Contexto en gris al lado del titulo: equipo, total, semana. */
  meta?: ReactNode
  /** Botones a la derecha. La accion principal va al final. */
  actions?: ReactNode
  /** Contenido bajo la fila del titulo (selector de vistas, resumen). */
  children?: ReactNode
  /** Elemento a la izquierda del titulo (ej. boton volver). */
  leading?: ReactNode
  className?: string
}

/**
 * Encabezado de pagina unico (antes cada una de las 16 pantallas armaba el suyo, con alturas y
 * tamanos distintos). Titulo compacto: la jerarquia sale del peso, no del tamano.
 */
export function PageHeader({
  title,
  meta,
  actions,
  children,
  leading,
  className,
}: PageHeaderProps) {
  return (
    <header className={cx('shrink-0 border-b border-border bg-panel', className)}>
      <div className="flex items-center gap-3 min-h-12 px-3 sm:px-5 py-2">
        {leading}
        <div className="flex items-baseline gap-2 min-w-0 flex-1">
          <h1 className="text-lg font-semibold text-fg truncate">{title}</h1>
          {meta && <span className="text-xs text-fg-faint truncate hidden sm:inline">{meta}</span>}
        </div>
        {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
      </div>
      {children && <div className="px-3 sm:px-5 pb-2.5">{children}</div>}
    </header>
  )
}
