import { useState } from 'react'
import { Button } from '@shared/components/ui/Button'
import { Icon } from '@shared/components/ui/Icon'
import { Select } from '@shared/components/ui/Input'
import { StatusLabel } from '@shared/components/ui/StatusLabel'
import { DueDate, PriorityBars } from '@shared/components/ui/Indicators'
import { PRIORITY_LABEL } from '@shared/utils/estados'
import { atajosFecha, estadoDe } from '@features/chat/components/log/actividad'
import { cx } from '@shared/utils/cx'

export interface ActivityCardMeta {
  activityId: string
  title: string
  responsibleName: string
  dueDate: string
  status: string
  priority: number
}

interface Props {
  meta: ActivityCardMeta
  canAssignOthers: boolean
  onComplete: () => void | Promise<unknown>
  onReschedule: (dueDate: string) => void | Promise<unknown>
  onReassign: (memberId: string, memberName: string) => void | Promise<unknown>
  listMembers: () => Promise<{ id: string; full_name: string }[]>
  // Responder a la tarjeta. Los botones cubren lo frecuente (completar, mover, reasignar);
  // responder cubre lo que no tiene boton: la descripcion y el objetivo.
  onReply?: () => void
}

/** Datos de una actividad en una linea: estado, responsable, fecha y prioridad. */
export function MetaActividad({
  status,
  responsibleName,
  dueDate,
  priority,
  className,
}: {
  status: string
  responsibleName: string
  dueDate: string
  priority: number
  className?: string
}) {
  const done = status === 'completado'
  return (
    <div
      className={cx('flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted', className)}
    >
      <StatusLabel {...estadoDe(status, dueDate)} />
      <span className="inline-flex items-center gap-1 min-w-0">
        <Icon name="user" size={14} className="text-fg-faint" />
        <span className="truncate">{responsibleName}</span>
      </span>
      <span className="inline-flex items-center gap-1">
        <Icon name="calendar" size={14} className="text-fg-faint" />
        <DueDate date={dueDate} done={done} />
      </span>
      <span className="inline-flex items-center gap-1.5">
        <PriorityBars priority={priority} />
        {PRIORITY_LABEL[priority] ?? priority}
      </span>
    </div>
  )
}

/**
 * Actividad dentro del chat como objeto de trabajo: borde de acento a la izquierda, datos en
 * una linea y acciones directas. Se distingue de la conversacion por estructura, no por color.
 */
export function ActivityCard({
  meta,
  canAssignOthers,
  onComplete,
  onReschedule,
  onReassign,
  listMembers,
  onReply,
}: Props) {
  const [panel, setPanel] = useState<'move' | 'assign' | null>(null)
  const [members, setMembers] = useState<{ id: string; full_name: string }[]>([])
  const [busy, setBusy] = useState(false)

  const isDone = meta.status === 'completado'

  const openAssign = async () => {
    if (panel === 'assign') {
      setPanel(null)
      return
    }
    setPanel('assign')
    if (members.length === 0) {
      try {
        setMembers(await listMembers())
      } catch {
        /* sin roster no hay a quien reasignar; el panel lo dice */
      }
    }
  }

  const act = async (fn: () => void | Promise<unknown>) => {
    setBusy(true)
    try {
      await fn()
    } finally {
      setBusy(false)
      setPanel(null)
    }
  }

  return (
    <div className="rounded-md border border-border border-l-3 border-l-accent bg-panel px-3 py-2">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 basis-56">
          <p
            className={cx(
              'text-sm font-medium leading-snug break-words',
              isDone ? 'text-fg-muted' : 'text-fg',
            )}
          >
            {meta.title}
          </p>
          <MetaActividad
            className="mt-1"
            status={meta.status}
            responsibleName={meta.responsibleName}
            dueDate={meta.dueDate}
            priority={meta.priority}
          />
        </div>

        {!isDone && (
          <div className="flex flex-wrap items-center gap-1">
            <Button
              size="xs"
              variant="secondary"
              icon="check"
              disabled={busy}
              onClick={() => act(onComplete)}
            >
              Completar
            </Button>
            <Button
              size="xs"
              variant="ghost"
              icon="calendarMove"
              disabled={busy}
              aria-expanded={panel === 'move'}
              onClick={() => setPanel(panel === 'move' ? null : 'move')}
            >
              Mover
            </Button>
            {canAssignOthers && (
              <Button
                size="xs"
                variant="ghost"
                icon="userSwap"
                disabled={busy}
                aria-expanded={panel === 'assign'}
                onClick={openAssign}
              >
                Reasignar
              </Button>
            )}
            {onReply && (
              <Button
                size="xs"
                variant="ghost"
                icon="reply"
                disabled={busy}
                onClick={onReply}
                title="Responder para cambiar la descripción, el objetivo u otra cosa"
              >
                Responder
              </Button>
            )}
          </div>
        )}
      </div>

      {panel === 'move' && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-border">
          <span className="text-xs text-fg-faint mr-1">Mover a</span>
          {atajosFecha().map((a) => (
            <Button
              key={a.label}
              size="xs"
              variant="secondary"
              disabled={busy}
              onClick={() => act(() => onReschedule(a.value))}
            >
              {a.label}
            </Button>
          ))}
          <input
            type="date"
            aria-label="Otra fecha"
            disabled={busy}
            onChange={(e) => e.target.value && act(() => onReschedule(e.target.value))}
            className="h-7 rounded-md border border-border-strong bg-field px-2 text-xs text-fg focus:outline-none focus:border-accent"
          />
        </div>
      )}

      {panel === 'assign' && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-border">
          <span className="text-xs text-fg-faint">Reasignar a</span>
          {members.length === 0 ? (
            <span className="text-xs text-fg-faint">Cargando personas…</span>
          ) : (
            <Select
              size="sm"
              className="w-48"
              aria-label="Persona"
              disabled={busy}
              defaultValue=""
              onChange={(e) => {
                const m = members.find((x) => x.id === e.target.value)
                if (m) act(() => onReassign(m.id, m.full_name))
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
  )
}
