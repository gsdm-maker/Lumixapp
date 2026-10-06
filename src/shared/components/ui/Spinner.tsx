import { cx } from '@shared/utils/cx'

/** Indicador de carga. Hereda el color del texto (usar text-fg-faint, text-on-accent, etc.). */
export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      style={{ width: size, height: size }}
      className={cx(
        'inline-block shrink-0 rounded-full border-2 border-current border-t-transparent animate-spin',
        className,
      )}
    />
  )
}

/** Carga de una pantalla o panel completo: spinner centrado con texto opcional. */
export function LoadingState({ label, className }: { label?: string; className?: string }) {
  return (
    <div
      className={cx(
        'flex flex-col items-center justify-center gap-2 py-12 text-fg-faint',
        className,
      )}
    >
      <Spinner size={20} />
      {label && <p className="text-xs">{label}</p>}
    </div>
  )
}
