import { Icon } from '@shared/components/ui/Icon'
import { StatusLabel } from '@shared/components/ui/StatusLabel'
import { ERROR_SEVERITY, ERROR_STATUS } from '@shared/utils/estados'
import type { ErrorSeverity, ErrorStatus } from '@shared/types'

const ORDEN: ErrorStatus[] = ['abierto', 'en_revision', 'resuelto', 'cerrado']

/**
 * Estado del error que tambien sirve para cambiarlo. Se VE como el resto de los estados de la
 * app (punto + texto), pero encima hay un <select> nativo transparente: es lo mas accesible
 * (teclado, lector de pantalla) y en el celular abre la rueda del sistema. Antes era un select
 * con forma de pildora de color, distinto a todos los demas estados.
 */
export function ErrorStatusSelect({
  value,
  onChange,
  canEdit,
  errorTitle,
}: {
  value: ErrorStatus
  onChange: (next: ErrorStatus) => void
  canEdit: boolean
  errorTitle: string
}) {
  const info = ERROR_STATUS[value]
  if (!canEdit) return <StatusLabel {...info} />

  return (
    <span className="relative inline-flex items-center gap-1 h-7 -mx-1.5 px-1.5 rounded-md hover:bg-surface focus-within:ring-2 focus-within:ring-accent/40">
      <StatusLabel {...info} />
      <Icon name="chevronDown" size={12} className="text-fg-faint" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ErrorStatus)}
        aria-label={`Estado de “${errorTitle}”`}
        className="absolute inset-0 w-full opacity-0 cursor-pointer text-base sm:text-sm"
      >
        {ORDEN.map((s) => (
          <option key={s} value={s}>
            {ERROR_STATUS[s].label}
          </option>
        ))}
      </select>
    </span>
  )
}

const SEVERIDADES: ErrorSeverity[] = ['baja', 'media', 'alta', 'critica']

const SEVERIDAD_TEXTO: Record<ErrorSeverity, string> = {
  critica: 'text-danger font-medium',
  alta: 'text-danger',
  media: 'text-warning',
  baja: 'text-fg-faint',
}

/** Severidad del error, editable con el mismo patron de select transparente que el estado. */
export function ErrorSeveritySelect({
  value,
  onChange,
  canEdit,
  errorTitle,
}: {
  value: ErrorSeverity
  onChange: (next: ErrorSeverity) => void
  canEdit: boolean
  errorTitle: string
}) {
  const label = ERROR_SEVERITY[value]?.label ?? value
  if (!canEdit) return <span className={SEVERIDAD_TEXTO[value]}>{label}</span>

  return (
    <span className="relative inline-flex items-center gap-1 h-7 -mx-1.5 px-1.5 rounded-md hover:bg-surface focus-within:ring-2 focus-within:ring-accent/40">
      <span className={SEVERIDAD_TEXTO[value]}>{label}</span>
      <Icon name="chevronDown" size={12} className="text-fg-faint" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ErrorSeverity)}
        aria-label={`Severidad de “${errorTitle}”`}
        className="absolute inset-0 w-full opacity-0 cursor-pointer text-base sm:text-sm"
      >
        {SEVERIDADES.map((s) => (
          <option key={s} value={s}>
            {ERROR_SEVERITY[s].label}
          </option>
        ))}
      </select>
    </span>
  )
}
