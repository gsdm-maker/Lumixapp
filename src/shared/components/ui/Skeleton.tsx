import { cx } from '@shared/utils/cx'

// Placeholder de carga (evita el "salto" y el spinner vacio). El pulso respeta
// prefers-reduced-motion: sin animacion queda como un bloque gris quieto.
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={cx('motion-safe:animate-pulse rounded-md bg-surface-2', className)} />
}

// Lista de filas skeleton para tablas/listas.
export function SkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-1" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 w-20 hidden sm:block" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  )
}
