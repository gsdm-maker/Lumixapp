import type { KeyboardEvent, ReactNode } from 'react'
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
  // Patron radiogroup de WAI-ARIA: una sola parada de Tab (la opcion elegida) y las flechas
  // mueven y eligen.
  const habilitadas = options.filter((o) => !o.disabled)
  const alTeclear = (e: KeyboardEvent<HTMLDivElement>) => {
    const paso = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    if (!paso || habilitadas.length === 0) return
    e.preventDefault()
    const i = habilitadas.findIndex((o) => o.value === value)
    const siguiente = habilitadas[(i + paso + habilitadas.length) % habilitadas.length]
    onChange(siguiente.value)
    const botones = e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')
    botones[options.indexOf(siguiente)]?.focus()
  }
  const hayElegida = options.some((o) => o.value === value)

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={alTeclear}
      className={cx(
        // Pista gris con la opcion activa como una pastilla blanca con sombra (Tabs de shadcn/ui).
        'inline-flex shrink-0 gap-0.5 rounded-full bg-surface p-[3px]',
        className,
      )}
    >
      {options.map((o) => {
        const activo = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={activo}
            tabIndex={activo || (!hayElegida && o === habilitadas[0]) ? 0 : -1}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cx(
              'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-medium transition-[background-color,color,box-shadow] duration-150 disabled:opacity-40',
              size === 'sm' ? 'h-[26px] px-2.5 text-xs' : 'h-8 px-3 text-sm',
              activo ? 'bg-panel text-fg shadow-sm' : 'text-fg-muted hover:text-fg',
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
