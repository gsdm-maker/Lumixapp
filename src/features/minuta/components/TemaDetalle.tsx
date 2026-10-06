// Panel de detalle de un tema: aqui vive todo lo que no es la siguiente accion (que va en la
// fila). Reemplaza la columna de acciones apiladas (Ver Gantt, Asignar, Ya lo conversamos,
// avisos, Eliminar) y, en el celular, las tarjetas con todos los campos abiertos a la vez.

import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@shared/components/ui/Button'
import { EditableText } from '@shared/components/ui/EditableText'
import { Icon } from '@shared/components/ui/Icon'
import { SectionLabel } from '@shared/components/ui/Indicators'
import { SidePanel } from '@shared/components/ui/SidePanel'
import { StatusLabel } from '@shared/components/ui/StatusLabel'
import { formatDateLocal } from '@shared/utils/date'
import { estadoActividad } from '@shared/utils/estados'
import type { DecoratedItem } from '@features/minuta/hooks/useMinuta'
import { EstadoCampo, PlazoCampo, ResponsableCampo } from '@features/minuta/components/CamposTema'
import { SubtareasPanel } from '@features/minuta/components/SubtareasPanel'
import { AccionPrincipal, type Hoja } from '@features/minuta/components/hoja'
import { huerfanas, sinActividad, tieneSubtareas } from '@features/minuta/utils/temas'

export function TemaDetalle({
  item,
  hoja,
  onClose,
}: {
  item: DecoratedItem | null
  hoja: Hoja
  onClose: () => void
}) {
  const navigate = useNavigate()
  if (!item) return null
  const { esIngesta, esMinuta, canManage, canDelete } = hoja
  const faltan = item.linkedActivities.length > 0 && !item.para_todos ? sinActividad(item) : []
  const abiertasDeOtros = huerfanas(item)
  const conSubtareas = tieneSubtareas(item, hoja.allItems)

  return (
    <SidePanel
      open
      onClose={onClose}
      width="lg"
      eyebrow={esIngesta ? 'Solicitud de ingesta' : item.parent_item_id ? 'Subtarea' : 'Tema'}
      title={item.tema}
      footer={
        <>
          <AccionPrincipal it={item} hoja={hoja} size="sm" />
          {conSubtareas && (
            <Button
              size="sm"
              variant="secondary"
              icon="timeline"
              onClick={() => hoja.verCronograma(item)}
            >
              Ver cronograma
            </Button>
          )}
          <div className="flex-1" />
          {canDelete && (
            <Button size="sm" variant="ghost" icon="trash" onClick={() => hoja.eliminar(item.id)}>
              Eliminar
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        {canManage && (
          <Campo label={esIngesta ? 'Solicitud' : 'Tema'}>
            <EditableText
              value={item.tema}
              canEdit
              onSave={(next) => hoja.guardarTema(item.id, next)}
              textClassName="text-sm text-fg"
              preventEmpty
            />
          </Campo>
        )}

        <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 items-center text-sm">
          <dt className="text-xs text-fg-faint">Responsable</dt>
          <dd className="min-w-0">
            <ResponsableCampo
              item={item}
              esIngesta={esIngesta}
              canEdit={canManage}
              members={hoja.members}
              single={esMinuta}
              memberName={hoja.memberName}
              onChange={(p) => hoja.guardar(item.id, p)}
            />
          </dd>
          <dt className="text-xs text-fg-faint">Estado</dt>
          <dd>
            <EstadoCampo
              item={item}
              esIngesta={esIngesta}
              canEdit={canManage}
              onChange={(p) => hoja.guardar(item.id, p)}
            />
          </dd>
          <dt className="text-xs text-fg-faint">{esIngesta ? 'Compromiso' : 'Plazo'}</dt>
          <dd>
            <PlazoCampo
              item={item}
              allItems={hoja.allItems}
              canEdit={canManage}
              onChange={(v) => hoja.guardarPlazo(item, v)}
              done={item.effectiveEstado === 'resuelto'}
            />
          </dd>
          {esIngesta && (
            <>
              <dt className="text-xs text-fg-faint">Solicitada</dt>
              <dd className="text-fg-body">{formatDateLocal(item.created_at)}</dd>
            </>
          )}
        </dl>

        <Campo label="Comentarios">
          <EditableText
            as="p"
            value={item.comentarios}
            canEdit={canManage}
            onSave={(next) => hoja.guardarComentarios(item.id, next)}
            placeholder="Notas…"
            emptyLabel="Sin comentarios"
            textClassName="text-sm text-fg-body"
          />
        </Campo>

        {(faltan.length > 0 || abiertasDeOtros.length > 0) && (
          <div className="space-y-1.5">
            {faltan.length > 0 && (
              <Aviso>
                {faltan.map(hoja.memberName).join(', ')} figura como responsable pero no tiene
                actividad: no le llega aviso ni aparece en Compromisos.
              </Aviso>
            )}
            {abiertasDeOtros.length > 0 && (
              <Aviso>
                {abiertasDeOtros.map((a) => hoja.memberName(a.responsible_id)).join(', ')} ya no
                figura en el tema y su actividad sigue abierta. Ciérrala o reasígnala desde
                Actividades.
              </Aviso>
            )}
          </div>
        )}

        {item.linkedActivities.length > 0 && (
          <div className="space-y-1.5">
            <SectionLabel>Actividades</SectionLabel>
            <ul className="divide-y divide-border border-y border-border">
              {item.linkedActivities.map((a) => (
                <li key={a.id}>
                  {/* Abre el detalle en Actividades: ahi viven sus propias subtareas. */}
                  <button
                    type="button"
                    onClick={() => navigate('/activities', { state: { activityId: a.id } })}
                    className="w-full flex items-center gap-3 py-2 text-left hover:bg-surface"
                  >
                    <span className="flex-1 min-w-0 truncate text-sm text-fg-body">
                      {hoja.memberName(a.responsible_id)}
                    </span>
                    <StatusLabel {...estadoActividad(a.status, a.due_date)} />
                    <Icon name="chevronRight" size={14} className="text-fg-faint" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-1.5">
          {(canManage || conSubtareas) && <SectionLabel>Subtareas</SectionLabel>}
          <SubtareasPanel
            key={item.id}
            parentId={item.id}
            allItems={hoja.allItems}
            members={hoja.members}
            canManage={canManage}
            canAssign={hoja.canAssign}
            singleResponsable={esMinuta}
            maxDepth={esMinuta ? 1 : undefined}
            // En el panel la subtarea ya es lo que se vino a ver: abierta y con "+ Subtarea".
            defaultExpanded
            canDelete={canDelete}
            onRemove={(id) => hoja.eliminar(id)}
            memberName={hoja.memberName}
            onGuardar={hoja.guardar}
            onGuardarTema={hoja.guardarTema}
            onGuardarPlazo={hoja.guardarPlazo}
            onOpenCreate={(s) => hoja.asignar(s)}
            onAdd={hoja.addItem}
          />
        </div>
      </div>
    </SidePanel>
  )
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <SectionLabel>{label}</SectionLabel>
      {children}
    </div>
  )
}

function Aviso({ children }: { children: ReactNode }) {
  return (
    <p className="flex gap-2 text-xs text-warning">
      <Icon name="alert" size={14} className="shrink-0 mt-px" />
      <span>{children}</span>
    </p>
  )
}
