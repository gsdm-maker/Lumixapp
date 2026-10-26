import { useState } from 'react'
import type { ActivityStatus } from '@shared/types'
import { Button, IconButton } from '@shared/components/ui/Button'
import { Select } from '@shared/components/ui/Input'
import { useConfirm } from '@shared/components/ui/ConfirmDialog'
import { useToast } from '@shared/components/ui/Toast'
import { cx } from '@shared/utils/cx'
import { MetaActividad } from '@features/chat/components/ActivityCard'
import { atajosFecha } from '@features/chat/components/log/actividad'

export interface ActivityListItem {
  id: string
  title: string
  responsibleId: string
  responsibleName: string
  dueDate: string
  status: string
  priority: number
  description: string
}

export interface BulkChanges {
  status?: ActivityStatus
  due_date?: string
  responsibleId?: string
  responsibleName?: string
}

interface Props {
  items: ActivityListItem[]
  onSelect: (item: ActivityListItem) => void
  canAssignOthers?: boolean
  members?: { id: string; full_name: string }[]
  onBulkUpdate?: (ids: string[], changes: BulkChanges) => Promise<void>
  // Accion rapida sobre UNA fila, igual que los botones de ActivityCard (crear/editar desde
  // el chat). Sin esto la fila solo abre el modal completo al tocarla.
  onQuickUpdate?: (id: string, changes: BulkChanges) => Promise<void>
  // Eliminar UNA fila. Solo se ofrece para 'pendiente': una vez iniciada, borrarla se
  // siente como perder trabajo en curso -desde ahi se cierra o edita, no se borra-.
  onDelete?: (id: string, title: string) => Promise<void>
}

const plural = (n: number, s: string, p: string) => (n === 1 ? s : p)

/**
 * Listado de actividades que Lumix devuelve ("que tengo esta semana"). Mismo borde de acento
 * que la tarjeta: es trabajo, no conversacion. La fila trae la siguiente accion logica
 * (Completar) y el resto como iconos; tocar la fila abre la edicion completa.
 *
 * Modo seleccion: solo tiene sentido ofrecerlo si hay a donde aplicar el resultado
 * (onBulkUpdate). Sin eso, el listado se comporta igual que antes (tocar = editar una).
 */
export function ActivityListMessage({
  items,
  onSelect,
  canAssignOthers = false,
  members = [],
  onBulkUpdate,
  onQuickUpdate,
  onDelete,
}: Props) {
  const confirm = useConfirm()
  const toast = useToast()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [picker, setPicker] = useState<'date' | 'reassign' | null>(null)
  const [dateValue, setDateValue] = useState('')
  const [reassignId, setReassignId] = useState('')
  const [busy, setBusy] = useState(false)

  // Panel rapido abierto en UNA fila (mover o reasignar), independiente del modo seleccion.
  const [rowPanel, setRowPanel] = useState<{ id: string; type: 'move' | 'assign' } | null>(null)
  const [rowBusyId, setRowBusyId] = useState<string | null>(null)

  const supportsBulk = !!onBulkUpdate
  const hasSelection = selected.size > 0

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const clearSelection = () => {
    setSelected(new Set())
    setPicker(null)
    setDateValue('')
    setReassignId('')
  }

  const applyBulk = async (changes: BulkChanges) => {
    if (!onBulkUpdate || selected.size === 0) return
    setBusy(true)
    try {
      const ids = [...selected]
      await onBulkUpdate(ids, changes)
      toast.success(
        `${ids.length} ${plural(ids.length, 'actividad actualizada', 'actividades actualizadas')}`,
      )
      clearSelection()
    } finally {
      setBusy(false)
    }
  }

  const runQuick = async (id: string, changes: BulkChanges) => {
    if (!onQuickUpdate) return
    setRowBusyId(id)
    try {
      await onQuickUpdate(id, changes)
      setRowPanel(null)
    } finally {
      setRowBusyId(null)
    }
  }

  // Eliminar no se puede deshacer: pasa por la confirmacion unica de la app, que nombra lo
  // que se borra (antes era una mini confirmacion propia dentro de la fila).
  const runDelete = async (id: string, title: string) => {
    if (!onDelete) return
    const ok = await confirm({
      title: 'Eliminar actividad',
      message: `Se elimina "${title}". No se puede deshacer.`,
      confirmLabel: 'Eliminar',
      tone: 'danger',
    })
    if (!ok) return
    setRowBusyId(id)
    try {
      await onDelete(id, title)
    } finally {
      setRowBusyId(null)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-panel shadow-sm shadow-black/5 overflow-hidden">
      <ul className="divide-y divide-border">
        {items.map((it) => {
          const isSelected = selected.has(it.id)
          const isDone = it.status === 'completado'
          const showQuickActions = !!onQuickUpdate && !hasSelection && !isDone
          const panelOpen = rowPanel?.id === it.id ? rowPanel.type : null
          const rowBusy = rowBusyId === it.id
          const activar = () => (hasSelection ? toggle(it.id) : onSelect(it))
          return (
            <li
              key={it.id}
              className={cx(
                'flex items-start gap-2.5 px-3 py-2 transition-colors',
                isSelected ? 'bg-accent-soft' : 'hover:bg-surface',
              )}
            >
              {supportsBulk && (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(it.id)}
                  aria-label={`Seleccionar "${it.title}"`}
                  className="mt-1 h-4 w-4 shrink-0 accent-accent-fill cursor-pointer"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5">
                  <button
                    type="button"
                    onClick={activar}
                    title={hasSelection ? undefined : 'Editar'}
                    className="min-w-0 flex-1 basis-48 text-left"
                  >
                    <span
                      className={cx(
                        'block text-sm font-medium leading-snug break-words',
                        isDone ? 'text-fg-muted' : 'text-fg',
                      )}
                    >
                      {it.title}
                    </span>
                    <MetaActividad
                      className="mt-1"
                      status={it.status}
                      responsibleName={it.responsibleName}
                      dueDate={it.dueDate}
                      priority={it.priority}
                    />
                  </button>

                  {/* Mismas acciones que ActivityCard, para actuar directo desde una lista
                      (ej. "que tengo esta semana") sin abrir la edicion completa. */}
                  {showQuickActions && (
                    <div className="flex items-center gap-0.5">
                      <Button
                        size="xs"
                        variant="secondary"
                        icon="check"
                        disabled={rowBusy}
                        onClick={() => runQuick(it.id, { status: 'completado' })}
                      >
                        Completar
                      </Button>
                      <IconButton
                        icon="calendarMove"
                        label="Mover fecha"
                        size="xs"
                        disabled={rowBusy}
                        aria-expanded={panelOpen === 'move'}
                        onClick={() =>
                          setRowPanel(panelOpen === 'move' ? null : { id: it.id, type: 'move' })
                        }
                      />
                      {canAssignOthers && (
                        <IconButton
                          icon="userSwap"
                          label="Reasignar"
                          size="xs"
                          disabled={rowBusy}
                          aria-expanded={panelOpen === 'assign'}
                          onClick={() =>
                            setRowPanel(
                              panelOpen === 'assign' ? null : { id: it.id, type: 'assign' },
                            )
                          }
                        />
                      )}
                      {onDelete && it.status === 'pendiente' && (
                        <IconButton
                          icon="trash"
                          label="Eliminar"
                          size="xs"
                          disabled={rowBusy}
                          onClick={() => runDelete(it.id, it.title)}
                        />
                      )}
                    </div>
                  )}
                </div>

                {panelOpen === 'move' && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-xs text-fg-faint mr-1">Mover a</span>
                    {atajosFecha().map((a) => (
                      <Button
                        key={a.label}
                        size="xs"
                        variant="secondary"
                        disabled={rowBusy}
                        onClick={() => runQuick(it.id, { due_date: a.value })}
                      >
                        {a.label}
                      </Button>
                    ))}
                    <input
                      type="date"
                      aria-label="Otra fecha"
                      disabled={rowBusy}
                      onChange={(e) =>
                        e.target.value && runQuick(it.id, { due_date: e.target.value })
                      }
                      className="h-7 rounded-md border border-border-strong bg-field px-2 text-xs text-fg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                  </div>
                )}

                {panelOpen === 'assign' && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-xs text-fg-faint">Reasignar a</span>
                    {members.length === 0 ? (
                      <span className="text-xs text-fg-faint">Cargando personas…</span>
                    ) : (
                      <Select
                        size="sm"
                        className="w-48"
                        aria-label="Persona"
                        disabled={rowBusy}
                        defaultValue=""
                        onChange={(e) => {
                          const m = members.find((x) => x.id === e.target.value)
                          if (m)
                            runQuick(it.id, { responsibleId: m.id, responsibleName: m.full_name })
                        }}
                      >
                        <option value="" disabled>
                          Elegir persona…
                        </option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.full_name}
                          </option>
                        ))}
                      </Select>
                    )}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {/* Barra contextual: solo aparece con algo seleccionado y queda pegada al listado. */}
      {supportsBulk && hasSelection && (
        <div
          role="toolbar"
          aria-label="Acciones sobre las seleccionadas"
          className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-t border-border-strong bg-surface"
        >
          <span className="text-xs font-medium text-fg mr-1">
            {selected.size} {plural(selected.size, 'seleccionada', 'seleccionadas')}
          </span>
          {picker === 'date' ? (
            <>
              <input
                type="date"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
                autoFocus
                aria-label="Nueva fecha"
                className="h-7 rounded-md border border-border-strong bg-field px-2 text-xs text-fg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
              <Button
                size="xs"
                loading={busy}
                disabled={!dateValue}
                onClick={() => applyBulk({ due_date: dateValue })}
              >
                Aplicar
              </Button>
              <Button size="xs" variant="ghost" disabled={busy} onClick={() => setPicker(null)}>
                Volver
              </Button>
            </>
          ) : picker === 'reassign' ? (
            <>
              <Select
                size="sm"
                className="w-44"
                aria-label="Persona"
                value={reassignId}
                onChange={(e) => setReassignId(e.target.value)}
                autoFocus
              >
                <option value="">Elegir persona…</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name}
                  </option>
                ))}
              </Select>
              <Button
                size="xs"
                loading={busy}
                disabled={!reassignId}
                onClick={() => {
                  const m = members.find((x) => x.id === reassignId)
                  if (m) applyBulk({ responsibleId: m.id, responsibleName: m.full_name })
                }}
              >
                Aplicar
              </Button>
              <Button size="xs" variant="ghost" disabled={busy} onClick={() => setPicker(null)}>
                Volver
              </Button>
            </>
          ) : (
            <>
              <span aria-hidden="true" className="text-fg-faint">
                ·
              </span>
              <Button
                size="xs"
                variant="secondary"
                icon="check"
                loading={busy}
                onClick={() => applyBulk({ status: 'completado' })}
              >
                Completar
              </Button>
              <Button
                size="xs"
                variant="ghost"
                icon="calendarMove"
                disabled={busy}
                onClick={() => setPicker('date')}
              >
                Mover fecha
              </Button>
              {canAssignOthers && (
                <Button
                  size="xs"
                  variant="ghost"
                  icon="userSwap"
                  disabled={busy}
                  onClick={() => setPicker('reassign')}
                >
                  Reasignar
                </Button>
              )}
              <Button
                size="xs"
                variant="ghost"
                disabled={busy}
                onClick={clearSelection}
                className="ml-auto"
              >
                Cancelar
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
