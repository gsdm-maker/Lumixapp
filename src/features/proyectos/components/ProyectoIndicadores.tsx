// Indicadores de un proyecto que se repiten en la lista y en el encabezado del detalle. Un solo
// dibujo para cada dato: antes la lista usaba barra indigo y el detalle un anillo verde para el
// mismo avance.

import { ProgressBar } from '@shared/components/ui/Indicators'
import { cx } from '@shared/utils/cx'
import { plural, type AlertasDetalle } from '@features/proyectos/utils/proyecto'

/** "45%" + barra fina. Sin subtareas no hay avance: se muestra una raya, no un 0% engañoso. */
export function AvanceProyecto({
  avance,
  className,
  barClassName = 'w-16',
}: {
  avance: number | null
  className?: string
  barClassName?: string
}) {
  if (avance === null) return <span className={cx('text-fg-faint', className)}>—</span>
  return (
    <span className={cx('inline-flex items-center gap-2', className)}>
      <span className="tabular-nums text-fg w-9">{avance}%</span>
      <ProgressBar value={avance} label={`Avance ${avance}%`} className={barClassName} />
    </span>
  )
}

/**
 * Alertas en texto, con el mismo tono que DueDate (rojo vencido, ambar hoy): "2 vencidas ·
 * 1 vence hoy". Sin alertas, una raya. `conBloqueadas` las suma en el detalle, donde hay
 * espacio; en la lista se omiten para no alargar la celda.
 */
export function AlertasTexto({
  alertas,
  conBloqueadas = false,
  className,
}: {
  alertas: AlertasDetalle
  conBloqueadas?: boolean
  className?: string
}) {
  const partes = [
    alertas.vencidas > 0 && (
      <span key="v" className="text-danger font-medium">
        {plural(alertas.vencidas, 'vencida', 'vencidas')}
      </span>
    ),
    alertas.hoy > 0 && (
      <span key="h" className="text-warning font-medium">
        {alertas.hoy} {alertas.hoy === 1 ? 'vence' : 'vencen'} hoy
      </span>
    ),
    alertas.proximas > 0 && (
      <span key="p" className="text-fg" title="Vencen en los próximos 3 días">
        {alertas.proximas} por vencer
      </span>
    ),
    conBloqueadas && alertas.bloqueadas > 0 && (
      <span key="b" className="text-blocked">
        {plural(alertas.bloqueadas, 'bloqueada', 'bloqueadas')}
      </span>
    ),
  ].filter(Boolean)

  if (partes.length === 0) return <span className={cx('text-fg-faint', className)}>—</span>
  return (
    <span className={cx('inline-flex flex-wrap items-center gap-x-1.5', className)}>
      {partes.map((p, i) => (
        <span key={i} className="inline-flex items-center gap-x-1.5">
          {i > 0 && <span className="text-fg-faint">·</span>}
          {p}
        </span>
      ))}
    </span>
  )
}
