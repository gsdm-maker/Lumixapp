import type { ReactNode } from 'react'
import { cx } from '@shared/utils/cx'

export interface SegmentOption<T extends string> {
  value: T
  label: ReactNode
  /** Numero chico al lado del texto (ej. cuantas actividades hay en ese filtro). */
  count?: number
  disabled?: boolean
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Texto para lectores de pantalla: que se esta eligiendo. */
  label: string
  size?: 'sm' | 'md'
  className?: string
}

/**
 * Selector de una opcion entre pocas (filtros de estado, vistas Lista/Tablero/Cronograma, tema).
 * Un solo estilo de "opcion activa" en toda la app: fondo de tinta, texto claro. Antes habia
 * cuatro.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'sm',
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx(
        'inline-flex shrink-0 rounded-md border border-border-strong bg-panel overflow-hidden',
        className,
      )}
    >
      {options.map((o, i) => {
        const activo = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={activo}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cx(
              'inline-flex items-center gap-1.5 whitespace-nowrap font-medium transition-colors disabled:opacity-40',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-sm',
              i > 0 && 'border-l border-border-strong',
              activo ? 'bg-fg text-panel' : 'text-fg-muted hover:bg-surface hover:text-fg',
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={cx('tabular-nums', activo ? 'opacity-70' : 'text-fg-faint')}>
                {o.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
