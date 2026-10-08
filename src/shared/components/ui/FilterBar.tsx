import type { ReactNode } from 'react'
import { cx } from '@shared/utils/cx'
import { Icon } from './Icon'

/**
 * Barra de filtros unica (Actividades, Minuta, Ingestas, Errores). Antes habia tres variantes:
 * una fila con scroll horizontal, dos filas, y una que envolvia. Esta envuelve en el celular y
 * deja la busqueda al final.
 */
export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        'shrink-0 flex flex-wrap items-center gap-1.5 px-3 sm:px-5 py-2 border-b border-border bg-panel',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Separa grupos dentro de la barra; empuja lo que sigue a la derecha si `grow`. */
export function FilterSpacer({ grow = false }: { grow?: boolean }) {
  return grow ? <div className="flex-1" /> : <div className="w-px h-5 bg-border mx-1" />
}

/** Un filtro activo, que se quita con la x (idea 7 de la propuesta). */
export function FilterChip({
  label,
  value,
  onRemove,
}: {
  label: string
  value: ReactNode
  onRemove: () => void
}) {
  return (
    <span className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1 rounded-full border border-border-strong bg-panel text-xs text-fg-muted">
      <span className="font-medium text-fg">{label}</span>
      <span className="truncate max-w-[160px]">{value}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Quitar filtro ${label}`}
        className="p-0.5 rounded-full text-fg-faint hover:text-fg hover:bg-surface"
      >
        <Icon name="x" size={13} />
      </button>
    </span>
  )
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Buscar…',
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={cx('relative min-w-[160px] w-full sm:w-56', className)}>
      <Icon
        name="search"
        size={14}
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-faint pointer-events-none"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full h-8 rounded-full border border-border-strong bg-field pl-8 pr-7 text-base sm:text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Limpiar búsqueda"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-fg-faint hover:text-fg"
        >
          <Icon name="x" size={13} />
        </button>
      )}
    </div>
  )
}
