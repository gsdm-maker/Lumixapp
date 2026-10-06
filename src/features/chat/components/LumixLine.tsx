import { Icon, type IconName } from '@shared/components/ui/Icon'
import { LumixIcon } from '@shared/components/ui/LumixIcon'
import { cx } from '@shared/utils/cx'
import { hora, textoLumix } from '@features/chat/components/log/registro'

/**
 * Firma de Lumix: su nombre en el acento y lo que hizo, en una linea. Es la UNICA identidad de
 * Lumix en el chat (antes tenia tres avatares distintos segun el tipo de respuesta), y no
 * habla en burbuja: firma debajo del mensaje que provoco la accion.
 */
export function LumixFirma({
  text,
  icon: iconFijo,
  timestamp,
  className,
}: {
  /** Texto tal como lo guardo Lumix; el emoji inicial se vuelve icono. */
  text: string
  /** Icono explicito, para textos que no vienen de Lumix con su emoji. */
  icon?: IconName
  /** Hora exacta, en el tooltip: la columna de hora es del mensaje de origen. */
  timestamp?: string
  className?: string
}) {
  const leido = textoLumix(text)
  const icon = iconFijo ?? leido.icon
  const limpio = leido.text
  return (
    <p
      className={cx('text-sm text-fg-muted leading-relaxed', className)}
      title={timestamp ? hora(timestamp) : undefined}
    >
      <span className="inline-flex items-center gap-1.5 font-semibold text-accent mr-1.5 align-[-3px]">
        {/* firma-marca: MessageLine la oculta cuando el avatar de la linea ya es Lumix. */}
        <LumixIcon size="sm" className="firma-marca !w-4 !h-4 !rounded-[4px]" />
        Lumix
      </span>
      {icon && (
        <Icon
          name={icon}
          size={14}
          className={cx(
            'inline-block align-[-2px] mr-1',
            icon === 'check' ? 'text-success' : icon === 'alert' ? 'text-warning' : 'text-fg-faint',
          )}
        />
      )}
      <span className="whitespace-pre-wrap break-words">{limpio}</span>
    </p>
  )
}
