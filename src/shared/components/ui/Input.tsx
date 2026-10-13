import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cx } from '@shared/utils/cx'
import { Icon, type IconName } from './Icon'

// text-base (16px) en movil, text-sm desde sm: Safari/iOS hace zoom automatico al enfocar un
// campo con letra menor a 16px. En escritorio se vuelve a la escala compacta.
const CAMPO =
  'w-full rounded-xl border border-border-strong bg-field text-fg placeholder:text-fg-faint text-base sm:text-sm transition-colors hover:border-fg-faint focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60 disabled:cursor-not-allowed'

/** Etiqueta de un campo de formulario. */
export function FieldLabel({
  htmlFor,
  children,
  hint,
}: {
  htmlFor?: string
  children: ReactNode
  hint?: ReactNode
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="flex items-baseline justify-between gap-2 text-xs font-medium text-fg-muted"
    >
      <span>{children}</span>
      {hint && <span className="font-normal text-fg-faint">{hint}</span>}
    </label>
  )
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: ReactNode
  /** Icono alineado a la izquierda dentro del campo. */
  leftIcon?: IconName
  /** Elemento interactivo alineado a la derecha (ej. boton de mostrar contrasena). */
  rightElement?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, leftIcon, rightElement, className, id, ...props },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  const hasLeft = !!leftIcon
  const hasRight = !!rightElement
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <FieldLabel htmlFor={inputId} hint={hint}>
          {label}
        </FieldLabel>
      )}
      <div className={cx('relative', (hasLeft || hasRight) && 'group')}>
        {hasLeft && (
          <Icon
            name={leftIcon}
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-faint transition-colors group-focus-within:text-accent"
          />
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error || undefined}
          className={cx(
            CAMPO,
            'h-10 sm:h-9',
            hasLeft ? 'pl-10' : 'px-3',
            hasRight && 'pr-10',
            error && 'border-danger focus:ring-danger/20',
            className,
          )}
          {...props}
        />
        {hasRight && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">{rightElement}</div>
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
})

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, className, id, rows = 3, ...props },
  ref,
) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <div className="flex flex-col gap-1.5">
      {label && <FieldLabel htmlFor={fieldId}>{label}</FieldLabel>}
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        className={cx(CAMPO, 'px-3 py-2 resize-y min-h-[2.5rem]', className)}
        {...props}
      />
    </div>
  )
})

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string
  /** 'sm' para barras de filtros. */
  size?: 'sm' | 'md'
}

/**
 * Select nativo con el estilo de la app (el nativo es lo mas accesible y en el celular abre la
 * rueda del sistema). Reemplaza los 28 <select> que cada pantalla estilaba a su manera.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, className, id, size = 'md', children, ...props },
  ref,
) {
  const autoId = useId()
  const fieldId = id ?? autoId
  const control = (
    <div className={cx('relative', !label && className)}>
      <select
        ref={ref}
        id={fieldId}
        className={cx(
          CAMPO,
          'appearance-none pl-2.5 pr-8 cursor-pointer',
          size === 'sm' ? 'h-8' : 'h-10 sm:h-9',
        )}
        {...props}
      >
        {children}
      </select>
      <Icon
        name="chevronDown"
        size={14}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-faint"
      />
    </div>
  )
  if (!label) return control
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <FieldLabel htmlFor={fieldId}>{label}</FieldLabel>
      {control}
    </div>
  )
})
