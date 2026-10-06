import { IconButton } from '@shared/components/ui/Button'
import { EditableText } from '@shared/components/ui/EditableText'
import { Icon } from '@shared/components/ui/Icon'
import { DueDate } from '@shared/components/ui/Indicators'
import { StatusLabel } from '@shared/components/ui/StatusLabel'
import { cx } from '@shared/utils/cx'
import { formatDateLocal } from '@shared/utils/date'
import { INGESTA_ESTADO, MINUTE_ESTADO } from '@shared/utils/estados'
import type { DecoratedItem } from '@features/minuta/hooks/useMinuta'
import { EstadoCampo, PlazoCampo, ResponsableCampo } from '@features/minuta/components/CamposTema'
import { SubtareasPanel } from '@features/minuta/components/SubtareasPanel'
import { AccionPrincipal, type Hoja } from '@features/minuta/components/hoja'
import { plazoEfectivo } from '@features/minuta/utils/subtareas'
import { huerfanas, responsablesLabel } from '@features/minuta/utils/temas'

/** Linea chica bajo el tema: avance de sus actividades y el aviso de actividad huerfana. */
function MetaTema({ it, hoja }: { it: DecoratedItem; hoja: Hoja }) {
  const n = it.linkedActivities.length
  const hechas = it.linkedActivities.filter((a) => a.status === 'completado').length
  const sueltas = huerfanas(it)
  if (!n && !sueltas.length) return null
  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs">
      {n > 0 && (
        <span className="text-fg-faint tabular-nums">
          {hechas} de {n} {n === 1 ? 'actividad completada' : 'actividades completadas'}
        </span>
      )}
      {sueltas.length > 0 && (
        <span
          className="inline-flex items-center gap-1 text-warning"
          title="Sacaste a esa persona del tema, pero su actividad sigue abierta. Ciérrala o reasígnala desde Actividades."
        >
          <Icon name="alert" size={13} />
          Actividad abierta de {sueltas.map((a) => hoja.memberName(a.responsible_id)).join(', ')}
        </span>
      )}
    </div>
  )
}

/** Tabla de escritorio: celdas editables en el lugar, una sola accion visible por fila. */
export function MinutaTabla({
  items,
  hoja,
  seleccionado,
}: {
  items: DecoratedItem[]
  hoja: Hoja
  seleccionado: string | null
}) {
  const { esIngesta, canManage } = hoja
  const th = 'sticky top-0 z-[1] bg-panel border-b border-border px-3 py-2 font-medium text-left'
  return (
    <table className="w-full text-sm border-separate border-spacing-0">
      <thead className="text-xs text-fg-faint">
        <tr>
          <th className={cx(th, 'w-[36%] min-w-[280px]')}>{esIngesta ? 'Solicitud' : 'Tema'}</th>
          <th className={cx(th, 'min-w-[150px]')}>Responsable</th>
          <th className={cx(th, 'min-w-[130px]')}>Estado</th>
          <th className={cx(th, 'min-w-[110px]')}>{esIngesta ? 'Compromiso' : 'Plazo'}</th>
          {esIngesta && <th className={cx(th, 'min-w-[90px]')}>Solicitada</th>}
          <th className={cx(th, 'min-w-[160px]')}>Comentarios</th>
          <th className={th}>
            <span className="sr-only">Acciones</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((it) => {
          const td = cx(
            'px-3 py-2 align-top border-b border-border',
            seleccionado === it.id && 'bg-accent-soft',
          )
          return (
            <tr key={it.id} className="group hover:bg-surface-soft">
              <td className={td}>
                <EditableText
                  value={it.tema}
                  canEdit={canManage}
                  onSave={(next) => hoja.guardarTema(it.id, next)}
                  textClassName="text-sm font-medium text-fg"
                  preventEmpty
                />
                <MetaTema it={it} hoja={hoja} />
                <SubtareasPanel
                  parentId={it.id}
                  allItems={hoja.allItems}
                  members={hoja.members}
                  canManage={canManage}
                  canAssign={hoja.canAssign}
                  singleResponsable={hoja.esMinuta}
                  maxDepth={hoja.esMinuta ? 1 : undefined}
                  canDelete={hoja.canDelete}
                  onRemove={(id) => hoja.eliminar(id)}
                  memberName={hoja.memberName}
                  onGuardar={hoja.guardar}
                  onGuardarTema={hoja.guardarTema}
                  onGuardarPlazo={hoja.guardarPlazo}
                  onOpenCreate={(s) => hoja.asignar(s)}
                  onAdd={hoja.addItem}
                />
              </td>
              <td className={td}>
                <ResponsableCampo
                  item={it}
                  esIngesta={esIngesta}
                  canEdit={canManage}
                  members={hoja.members}
                  single={hoja.esMinuta}
                  memberName={hoja.memberName}
                  onChange={(p) => hoja.guardar(it.id, p)}
                />
              </td>
              <td className={td}>
                <EstadoCampo
                  item={it}
                  esIngesta={esIngesta}
                  canEdit={canManage}
                  onChange={(p) => hoja.guardar(it.id, p)}
                />
              </td>
              <td className={td}>
                <PlazoCampo
                  item={it}
                  allItems={hoja.allItems}
                  canEdit={canManage}
                  onChange={(v) => hoja.guardarPlazo(it, v)}
                  done={it.effectiveEstado === 'resuelto'}
                />
              </td>
              {esIngesta && (
                <td className={cx(td, 'text-fg-muted whitespace-nowrap')}>
                  {formatDateLocal(it.created_at, 'short')}
                </td>
              )}
              <td className={td}>
                <EditableText
                  value={it.comentarios}
                  canEdit={canManage}
                  onSave={(next) => hoja.guardarComentarios(it.id, next)}
                  placeholder="Notas…"
                  emptyLabel="—"
                  textClassName="text-sm text-fg-muted"
                />
              </td>
              <td className={cx(td, 'text-right whitespace-nowrap')}>
                <div className="inline-flex items-center gap-1">
                  <AccionPrincipal it={it} hoja={hoja} />
                  <IconButton
                    icon="more"
                    size="xs"
                    label="Ver detalle y más acciones"
                    onClick={() => hoja.abrirDetalle(it)}
                  />
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/**
 * Celular: una fila plana de dos lineas por tema (tema arriba; responsable, estado y plazo
 * abajo). Tocarla abre el panel de detalle, donde se edita todo. Antes era una tarjeta con
 * todos los campos abiertos, y cinco temas ya no cabian en la pantalla.
 */
export function MinutaLista({ items, hoja }: { items: DecoratedItem[]; hoja: Hoja }) {
  return (
    <ul className="divide-y divide-border">
      {items.map((it) => {
        const plazo = it.plazo ?? plazoEfectivo(it, hoja.allItems)
        const estado = hoja.esIngesta
          ? INGESTA_ESTADO[it.estado_ingesta ?? 'no_iniciado']
          : MINUTE_ESTADO[it.effectiveEstado]
        const responsable = hoja.esIngesta
          ? it.responsables_text || 'Sin asignar'
          : responsablesLabel(it, hoja.memberName)
        return (
          <li key={it.id}>
            <button
              type="button"
              onClick={() => hoja.abrirDetalle(it)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left active:bg-surface"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-fg line-clamp-2">{it.tema}</p>
                <div className="mt-0.5 flex items-center gap-x-2 text-xs text-fg-faint min-w-0">
                  <span className="truncate">{responsable}</span>
                  <StatusLabel {...estado} />
                  {plazo && <DueDate date={plazo} done={it.effectiveEstado === 'resuelto'} />}
                  {huerfanas(it).length > 0 && (
                    <Icon
                      name="alert"
                      size={13}
                      className="shrink-0 text-warning"
                      aria-label="Hay una actividad abierta de alguien que ya no figura"
                    />
                  )}
                </div>
              </div>
              <Icon name="chevronRight" size={16} className="shrink-0 text-fg-faint" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
