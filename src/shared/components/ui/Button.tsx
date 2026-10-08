import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cx } from '@shared/utils/cx'
import { Icon, type IconName } from './Icon'
import { Spinner } from './Spinner'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Icono a la izquierda del texto. */
  icon?: IconName
  /** Muestra un spinner y desactiva el boton. */
  loading?: boolean
  children?: ReactNode
}

// Compactos a proposito (brief: "keep them compact"). Orbita: pastillas; la accion principal se
// distingue por el degradado del acento (relleno-orbita, index.css), no por el tamano.
const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-accent-fill relleno-orbita text-on-accent hover:brightness-110 border border-transparent shadow-md shadow-accent-fill/30',
  secondary: 'bg-panel text-fg border border-border-strong shadow-xs hover:bg-surface',
  ghost: 'text-fg-muted border border-transparent hover:bg-surface hover:text-fg',
  danger: 'bg-danger-fill text-on-accent hover:brightness-110 border border-transparent',
}

const SIZE: Record<ButtonSize, string> = {
  xs: 'h-7 px-2 text-xs gap-1',
  sm: 'h-8 px-2.5 text-sm gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
  lg: 'h-10 px-4 text-sm gap-2',
}

const ICON_SIZE: Record<ButtonSize, number> = { xs: 14, sm: 15, md: 16, lg: 16 }

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    icon,
    loading = false,
    className,
    children,
    disabled,
    type = 'button',
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center rounded-full font-semibold whitespace-nowrap transition-[background-color,border-color,filter,color,transform] duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <Spinner size={ICON_SIZE[size]} />
      ) : (
        icon && <Icon name={icon} size={ICON_SIZE[size]} />
      )}
      {children}
    </button>
  )
})

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: IconName
  /** Obligatorio: es lo unico que lee un lector de pantalla. Tambien se usa de tooltip. */
  label: string
  size?: 'xs' | 'sm' | 'md'
  variant?: 'ghost' | 'secondary'
}

const ICON_BTN: Record<'xs' | 'sm' | 'md', string> = { xs: 'w-7 h-7', sm: 'w-8 h-8', md: 'w-9 h-9' }

/** Boton solo-icono. Siempre lleva `label` (accesibilidad + tooltip nativo). */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, size = 'sm', variant = 'ghost', className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex items-center justify-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        variant === 'ghost'
          ? 'text-fg-faint hover:text-fg hover:bg-surface'
          : 'text-fg-muted bg-panel border border-border-strong hover:text-fg hover:bg-surface',
        ICON_BTN[size],
        className,
      )}
      {...props}
    >
      <Icon name={icon} size={size === 'xs' ? 14 : 16} />
    </button>
  )
})
