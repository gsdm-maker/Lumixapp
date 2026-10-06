import { Icon } from '@shared/components/ui/Icon'
import { StatusLabel } from '@shared/components/ui/StatusLabel'
import { ERROR_STATUS } from '@shared/utils/estados'
import type { ErrorStatus } from '@shared/types'

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
