// Panel lateral de detalle de un item del proyecto (idea 13 de la propuesta UI/UX).
//
// Es el MISMO panel para las tres vistas (Lista, Tablero, Cronograma): un solo camino de
// edicion para el mismo objeto. Antes era un dialogo centrado que tapaba la lista; ahora es el
// SidePanel compartido, igual que en Actividades, y en escritorio deja seguir tocando filas.

import { useState, type ReactNode } from 'react'
import type { DecoratedItem } from '@features/minuta/hooks/useMinuta'
import { plazoEfectivo } from '@features/minuta/utils/subtareas'
import { SidePanel } from '@shared/components/ui/SidePanel'
import { Button } from '@shared/components/ui/Button'
import { Icon } from '@shared/components/ui/Icon'
import { Select } from '@shared/components/ui/Input'
import { StatusLabel } from '@shared/components/ui/StatusLabel'
import { EditableText } from '@shared/components/ui/EditableText'
import { ComentarioLibre } from '@shared/components/ui/ComentarioLibre'
import { MemberMultiSelect } from '@shared/components/ui/MemberMultiSelect'
import { DatePicker } from '@shared/components/ui/DatePicker'
import { useConfirm } from '@shared/components/ui/ConfirmDialog'
import {
  DueDate,
  PriorityBars,
  PriorityPicker,
  SectionLabel,
} from '@shared/components/ui/Indicators'
import { MINUTE_ESTADO, PRIORITY_LABEL } from '@shared/utils/estados'
import { formatDateLocal } from '@shared/utils/date'
import { cx } from '@shared/utils/cx'
import type { MinuteEstado, MinuteItem, Profile } from '@shared/types'
import { ESTADOS, estadoItem, plural } from '@features/proyectos/utils/proyecto'

interface ItemPanelProps {
  item: DecoratedItem
  proyecto: DecoratedItem
  allItems: DecoratedItem[]
  members: Profile[]
  canManage: boolean
  canAssign: boolean
  canDelete: boolean
  onClose: () => void
  onGuardar: (patch: Partial<MinuteItem>) => void
  onGuardarPlazo: (v: string | null) => void
  onAdd: (tema: string) => void
  onAsignar: () => void
  onDiscutir: () => void
  onEliminar: () => Promise<void>
  onAbrir: (itemId: string) => void
}

export function ItemPanel({
  item,
  proyecto,
  allItems,
  members,
  canManage,
  canAssign,
  canDelete,
  onClose,
  onGuardar,
  onGuardarPlazo,
  onAdd,
  onAsignar,
  onDiscutir,
  onEliminar,
  onAbrir,
}: ItemPanelProps) {
  const confirm = useConfirm()
  const [nuevaSubtarea, setNuevaSubtarea] = useState('')
  const hijos = allItems.filter((d) => d.parent_item_id === item.id)
  const padre =
    item.parent_item_id && item.parent_item_id !== proyecto.id
      ? allItems.find((d) => d.id === item.parent_item_id)
      : undefined
  const vinculada = item.linkedActivities.length > 0
  const nombre = (id: string) => members.find((m) => m.id === id)?.full_name ?? 'Desconocido'

  // El boton hace explicito lo que antes solo se podia con Enter. Deja el campo listo para la
  // siguiente subtarea en vez de cerrar el panel: agregar varias seguidas es el caso comun.
  const confirmarAgregar = () => {
    if (!nuevaSubtarea.trim()) return
    onAdd(nuevaSubtarea.trim())
    setNuevaSubtarea('')
  }

  // Borrar arrastra las subtareas (ON DELETE CASCADE en parent_item_id): se dice antes.
  const eliminar = async () => {
    const total = contarDescendientes(item.id, allItems)
    const ok = await confirm({
      title: 'Eliminar actividad',
      message: (
        <>
          Se eliminará <strong className="text-fg">{item.tema || 'esta actividad'}</strong>
          {total > 0 && <> junto con {plural(total, 'subtarea', 'subtareas')}</>}. No se puede
          deshacer.
        </>
      ),
      confirmLabel: 'Eliminar',
      tone: 'danger',
    })
    if (ok) await onEliminar()
  }

  const puedeAsignar = !vinculada && canAssign && item.responsables.length > 0
  const puedeDiscutir = vinculada && item.effectiveEstado !== 'resuelto' && canManage

  return (
    <SidePanel
      open
      onClose={onClose}
      width="lg"
      eyebrow={
        <span className="inline-flex items-center gap-1 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="truncate hover:text-fg"
            title="Volver al proyecto"
          >
            {proyecto.tema}
          </button>
          {padre && (
            <>
              <Icon name="chevronRight" size={12} />
              <button
                type="button"
                onClick={() => onAbrir(padre.id)}
                className="truncate hover:text-fg"
              >
                {padre.tema}
              </button>
            </>
          )}
        </span>
      }
      title={
        <EditableText
          value={item.tema}
          canEdit={canManage}
          onSave={(tema) => onGuardar({ tema })}
          textClassName="text-lg font-semibold text-fg"
          emptyLabel="Sin nombre"
          preventEmpty
        />
      }
      footer={
        <>
          {puedeAsignar && (
            <Button size="sm" onClick={onAsignar}>
              Asignar actividad
            </Button>
          )}
          {puedeDiscutir && (
            <Button
              size="sm"
              variant="secondary"
              icon="arrowUp"
              onClick={onDiscutir}
              title="Si hay un bloqueo de fondo, se conversa en la reunión semanal"
            >
              Discutir en reunión
            </Button>
          )}
          {canDelete && (
            <Button size="sm" variant="ghost" icon="trash" onClick={eliminar} className="ml-auto">
              Eliminar
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-3 items-center text-sm">
          <Campo label="Estado">
            {vinculada ? (
              <span
                className="inline-flex items-center gap-2"
                title="Lo define el estado de la actividad vinculada"
              >
                <StatusLabel {...estadoItem(item, allItems)} />
                <span className="text-xs text-fg-faint">según la actividad</span>
              </span>
            ) : canManage ? (
              <Select
                size="sm"
                value={item.estado}
                onChange={(e) => onGuardar({ estado: e.target.value as MinuteEstado })}
                aria-label="Estado"
                className="max-w-52"
              >
                {ESTADOS.map((s) => (
                  <option key={s} value={s}>
                    {MINUTE_ESTADO[s].label}
                  </option>
                ))}
              </Select>
            ) : (
              <StatusLabel {...estadoItem(item, allItems)} />
            )}
          </Campo>

          <Campo label="Prioridad">
            {canManage ? (
              <span className="flex flex-wrap items-center gap-2">
                <PriorityPicker
                  value={item.prioridad ?? 0}
                  onChange={(prioridad) => onGuardar({ prioridad })}
                />
                {item.prioridad && (
                  <button
                    type="button"
                    onClick={() => onGuardar({ prioridad: null })}
                    className="text-xs text-fg-faint hover:text-fg"
                  >
                    Quitar
                  </button>
                )}
              </span>
            ) : item.prioridad ? (
              <span className="inline-flex items-center gap-2 text-fg-body">
                <PriorityBars priority={item.prioridad} />
                {PRIORITY_LABEL[item.prioridad]}
              </span>
            ) : (
              <span className="text-fg-faint">Sin prioridad</span>
            )}
          </Campo>

          <Campo label="Responsables">
            {canManage ? (
              <MemberMultiSelect
                members={members}
                selected={item.responsables}
                paraTodos={item.para_todos}
                onChange={(patch) => onGuardar(patch)}
              />
            ) : (
              <span className="text-fg-body">
                {item.responsables.length
                  ? item.responsables.map(nombre).join(', ')
                  : 'Sin asignar'}
              </span>
            )}
          </Campo>

          <Campo label="Inicio">
            {canManage ? (
              <DatePicker
                value={item.fecha_inicio ?? null}
                onChange={(v) => onGuardar({ fecha_inicio: v })}
                placeholder="Agregar fecha"
              />
            ) : (
              <FechaLectura fecha={item.fecha_inicio ?? null} />
            )}
          </Campo>

          <Campo label="Término">
            {canManage ? (
              <DatePicker
                value={item.plazo}
                onChange={onGuardarPlazo}
                placeholder="Agregar fecha"
              />
            ) : (
              <FechaLectura fecha={item.plazo} />
            )}
          </Campo>
        </dl>

        <div className="space-y-1.5">
          <SectionLabel>Comentarios</SectionLabel>
          <ComentarioLibre
            value={item.comentarios}
            canEdit={canManage}
            onSave={(comentarios) => onGuardar({ comentarios })}
            textClassName="text-sm text-fg-body"
          />
        </div>

        <div className="space-y-2">
          <SectionLabel>
            Subtareas
            {hijos.length > 0 && (
              <span className="ml-1.5 font-normal tabular-nums">
                {hijos.filter((h) => h.effectiveEstado === 'resuelto').length}/{hijos.length}
              </span>
            )}
          </SectionLabel>
          {hijos.length > 0 && (
            <ul className="-mx-2">
              {hijos.map((h) => {
                const resuelta = h.effectiveEstado === 'resuelto'
                const fin = plazoEfectivo(h, allItems)
                return (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() => onAbrir(h.id)}
                      className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left text-sm hover:bg-surface"
                    >
                      <Casilla marcada={resuelta} />
                      <span
                        className={cx(
                          'flex-1 min-w-0 truncate',
                          resuelta ? 'text-fg-faint line-through' : 'text-fg-body',
                        )}
                      >
                        {h.tema || 'Sin nombre'}
                      </span>
                      {fin && <DueDate date={fin} done={resuelta} className="text-xs" />}
                      <Icon name="chevronRight" size={14} className="text-fg-faint" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {canManage && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                confirmarAgregar()
              }}
            >
              <input
                value={nuevaSubtarea}
                onChange={(e) => setNuevaSubtarea(e.target.value)}
                placeholder="Nueva subtarea…"
                aria-label="Nueva subtarea"
                className="flex-1 min-w-0 h-8 rounded-md border border-border-strong bg-field px-2.5 text-base sm:text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
              <Button
                type="submit"
                size="sm"
                variant="secondary"
                icon="plus"
                disabled={!nuevaSubtarea.trim()}
              >
                Agregar
              </Button>
            </form>
          )}
        </div>
      </div>
    </SidePanel>
  )
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  )
}

function FechaLectura({ fecha }: { fecha: string | null }) {
  return fecha ? (
    <span className="text-fg-body">{formatDateLocal(fecha)}</span>
  ) : (
    <span className="text-fg-faint">Sin fecha</span>
  )
}

/** Casilla de solo lectura: dice si la subtarea esta resuelta (tocar la fila la abre). */
function Casilla({ marcada }: { marcada: boolean }) {
  return (
    <span
      aria-label={marcada ? 'Resuelta' : 'Pendiente'}
      role="img"
      className={cx(
        'w-4 h-4 shrink-0 rounded-[4px] border flex items-center justify-center',
        marcada ? 'bg-success border-success text-on-accent' : 'border-border-strong',
      )}
    >
      {marcada && <Icon name="check" size={12} strokeWidth={2.5} />}
    </span>
  )
}

function contarDescendientes(id: string, allItems: DecoratedItem[]): number {
  return allItems
    .filter((d) => d.parent_item_id === id)
    .reduce((n, h) => n + 1 + contarDescendientes(h.id, allItems), 0)
}
