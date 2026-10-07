import { cx } from '@shared/utils/cx'
import { TAG, colorDe } from '@shared/utils/colores'

interface AvatarProps {
  name: string
  src?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE = {
  xs: 'w-5 h-5 text-2xs tracking-tighter',
  sm: 'w-7 h-7 text-2xs',
  md: 'w-9 h-9 text-xs',
  lg: 'w-12 h-12 text-sm',
}

function iniciales(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/**
 * Avatar: la foto, o las iniciales sobre un tono pastel propio de cada persona (siempre el
 * mismo, sale del nombre). Ayuda a reconocer quien escribio de un vistazo; pastel y no los
 * colores fuertes de antes, que competian con los de estado.
 *
 * Compatibilidad: las personas que eligieron un emoji como avatar lo tienen guardado en `src`
 * (texto corto, no URL); se muestra tal cual.
 */
export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  if (src && /^(https?:|data:|\/)/.test(src)) {
    return (
      <img
        src={src}
        alt={name}
        className={cx(
          'rounded-full object-cover shrink-0 border border-border',
          SIZE[size],
          className,
        )}
      />
    )
  }
  const tono = colorDe(name)
  return (
    <span
      title={name}
      aria-label={name}
      role="img"
      className={cx(
        'inline-flex items-center justify-center rounded-full shrink-0 font-semibold select-none',
        // Con emoji como avatar el fondo queda neutro: el emoji ya trae su color.
        src ? 'bg-surface border border-border-strong' : [TAG[tono].soft, TAG[tono].text].join(' '),
        SIZE[size],
        className,
      )}
    >
      {src ? <span className="leading-none">{src}</span> : iniciales(name)}
    </span>
  )
}
