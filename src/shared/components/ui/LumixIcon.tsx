import { cx } from '@shared/utils/cx'

interface LumixIconProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE = { sm: 'w-6 h-6', md: 'w-8 h-8', lg: 'w-11 h-11' }

/**
 * Logo de Lumix: el bot de siempre, en version plana sobre el color de acento (antes era un
 * degradado indigo-violeta). Cambia solo con el acento elegido.
 */
export function LumixIcon({ size = 'md', className }: LumixIconProps) {
  return (
    <span
      role="img"
      aria-label="Lumix"
      className={cx(
        'inline-flex items-center justify-center rounded-md bg-accent-fill shrink-0',
        SIZE[size],
        className,
      )}
    >
      <svg
        className="w-[62%] h-[62%] text-on-accent"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="6" width="18" height="13" rx="3" />
        <line x1="12" y1="3" x2="12" y2="6" />
        <circle cx="8.5" cy="11.5" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="15.5" cy="11.5" r="1.2" fill="currentColor" stroke="none" />
        <path d="M9 15.5 Q12 17.8 15 15.5" />
      </svg>
    </span>
  )
}
