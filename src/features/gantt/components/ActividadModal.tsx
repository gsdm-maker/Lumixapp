// Detalle de una actividad desde Planificacion: descripcion, prioridad, entrega y horas
// estimadas (las horas son lo que alimenta el mapa de calor, por eso se editan aca mismo).

import type { ReactNode } from 'react'
import { Modal } from '@shared/components/ui/Modal'
import { DatePicker } from '@shared/components/ui/DatePicker'
import { SegmentedControl } from '@shared/components/ui/SegmentedControl'
import { StatusLabel } from '@shared/components/ui/StatusLabel'
import { useToast } from '@shared/components/ui/Toast'
import { DueDate, PriorityBars, PriorityPicker } from '@shared/components/ui/Indicators'
import { estadoActividad, PRIORITY_LABEL } from '@shared/utils/estados'
import { activitiesService } from '@infrastructure/supabase/activities.service'
import type { Activity } from '@shared/types'
import { fmtHoras, horasDe, OPCIONES_HORAS } from '@features/gantt/utils/carga'

export function ActividadModal({
  activity,
  canEdit,
  onClose,
  onChange,
}: {
  activity: Activity | null
  canEdit: boolean
  onClose: () => void
  /** Se llama con la actividad ya guardada, para refrescar el modal y la planificacion. */
  onChange: (next: Activity) => void
}) {
  const toast = useToast()

  const guardar = async (patch: Partial<Activity>) => {
    if (!activity) return
    try {
      await activitiesService.update(activity.id, patch)
      onChange({ ...activity, ...patch })
    } catch {
      toast.error('No se pudo guardar el cambio')
    }
  }

  return (
    <Modal open={!!activity} onClose={onClose} title={activity?.title} size="md">
      {activity && (
        <dl className="grid grid-cols-1 sm:grid-cols-[7.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 sm:gap-y-3.5 sm:items-center text-sm">
          <Campo label="Estado">
            <StatusLabel {...estadoActividad(activity.status, activity.due_date)} />
          </Campo>

          <Campo label="Prioridad">
            {canEdit ? (
              <PriorityPicker
                value={activity.priority}
                onChange={(priority) => guardar({ priority })}
              />
            ) : (
              <span className="inline-flex items-center gap-2 text-fg-body">
                <PriorityBars priority={activity.priority} />
                {PRIORITY_LABEL[activity.priority]}
              </span>
            )}
          </Campo>

          <Campo label="Entrega">
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {canEdit ? (
                <DatePicker
                  value={activity.due_date.split('T')[0]}
                  onChange={(v) => {
                    if (!v) return
                    guardar({ due_date: new Date(v).toISOString() })
                  }}
                />
              ) : (
                <DueDate date={activity.due_date} done={activity.status === 'completado'} />
              )}
              {(activity.plazo_change_count ?? 0) > 0 && (
                <span className="text-xs text-warning">
                  Cambiada {activity.plazo_change_count}{' '}
                  {activity.plazo_change_count === 1 ? 'vez' : 'veces'}
                </span>
              )}
            </span>
          </Campo>

          <Campo label="Horas estimadas">
            {canEdit ? (
              <SegmentedControl
                label="Horas estimadas"
                options={OPCIONES_HORAS.map((h) => ({ value: String(h), label: h }))}
                value={String(horasDe(activity))}
                onChange={(v) => guardar({ estimated_hours: Number(v) })}
              />
            ) : (
              <span className="text-fg-body">{fmtHoras(horasDe(activity))}</span>
            )}
          </Campo>

          <dt className="text-xs text-fg-muted self-start pt-0.5">Descripción</dt>
          <dd className="min-w-0 whitespace-pre-wrap break-words text-fg-body">
            {activity.description || <span className="text-fg-faint">Sin descripción</span>}
          </dd>
        </dl>
      )}
    </Modal>
  )
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="min-w-0 mb-2 sm:mb-0">{children}</dd>
    </>
  )
}
