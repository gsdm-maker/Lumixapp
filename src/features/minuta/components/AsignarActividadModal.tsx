// Modal chico para convertir un tema/subtarea (de Minuta o de un Proyecto) en actividad(es).
// Extraido de MinutaPage para que Proyectos lo reuse tal cual -mismo createActivitiesFromItem,
// mismo comportamiento-, sin duplicar el formulario de prioridad/fecha.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@shared/components/ui/Button'
import { FieldLabel } from '@shared/components/ui/Input'
import { PriorityPicker } from '@shared/components/ui/Indicators'
import { StatusLabel } from '@shared/components/ui/StatusLabel'
import { estadoActividad } from '@shared/utils/estados'
import { Modal } from '@shared/components/ui/Modal'
import { DatePicker } from '@shared/components/ui/DatePicker'
import { useToast } from '@shared/components/ui/Toast'
import type { DecoratedItem } from '@features/minuta/hooks/useMinuta'

interface Props {
  item: DecoratedItem | null
  // Por defecto todos los responsables del tema; se puede acotar (ej. "falta la actividad
  // de X" cuando alguien ya tiene la suya y no hay que duplicarsela).
  soloResponsables?: string[]
  memberName: (id: string) => string
  // Solo Proyectos: el item se planifica con inicio y termino (Cronograma), asi que no se
  // asigna sin las dos fechas. Viene precargado con las fechas efectivas del item. Sin esta
  // prop (Minuta) la fecha sigue siendo opcional y cae a 6 dias habiles.
  fechasObligatorias?: { inicio: string | null; termino: string | null }
  onClose: () => void
  onCreate: (
    item: DecoratedItem,
    opts: {
      responsibleIds: string[]
      priority: number
      dueDate: string | null
      fechaInicio?: string | null
    },
  ) => Promise<unknown>
}

export function AsignarActividadModal({
  item,
  soloResponsables,
  memberName,
  fechasObligatorias,
  onClose,
  onCreate,
}: Props) {
  const [priority, setPriority] = useState(2)
  const [due, setDue] = useState(fechasObligatorias?.termino ?? item?.plazo ?? '')
  const [inicio, setInicio] = useState(fechasObligatorias?.inicio ?? '')
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()

  const resp = soloResponsables ?? item?.responsables ?? []
  const exigeFechas = !!fechasObligatorias
  // Fechas YYYY-MM-DD: comparar como texto ordena igual que comparar fechas.
  const fechasInvertidas = exigeFechas && !!inicio && !!due && inicio > due
  const faltanFechas = exigeFechas && (!inicio || !due || fechasInvertidas)

  const crear = async () => {
    if (!item) return
    setBusy(true)
    try {
      await onCreate(item, {
        responsibleIds: resp,
        priority,
        dueDate: due || null,
        ...(exigeFechas ? { fechaInicio: inicio || null } : {}),
      })
      onClose()
      toast.success(
        `${resp.length} actividad${resp.length === 1 ? '' : 'es'} creada${resp.length === 1 ? '' : 's'}`,
      )
    } catch {
      toast.error('No se pudo crear la actividad')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={!!item}
      onClose={onClose}
      title="Crear actividad"
      description={item ? `"${item.tema}"` : undefined}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={busy} disabled={resp.length === 0 || faltanFechas} onClick={crear}>
            {`Crear ${resp.length > 1 ? `${resp.length} actividades` : 'actividad'}`}
          </Button>
        </>
      }
    >
      {item && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <FieldLabel>Se asigna a</FieldLabel>
            <p className="text-sm text-fg">
              {resp.length ? resp.map(memberName).join(', ') : 'Nadie: elige un responsable'}
            </p>
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Prioridad</FieldLabel>
            <PriorityPicker value={priority} onChange={setPriority} />
          </div>
          {exigeFechas ? (
            <div className="space-y-1.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <FieldLabel>Inicio</FieldLabel>
                  <DatePicker value={inicio || null} onChange={(v) => setInicio(v ?? '')} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Término (entrega)</FieldLabel>
                  <DatePicker value={due || null} onChange={(v) => setDue(v ?? '')} />
                </div>
              </div>
              {faltanFechas && (
                <p className="text-xs text-warning">
                  {fechasInvertidas
                    ? 'El inicio no puede ser posterior al término'
                    : 'Define inicio y término para poder asignar'}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <FieldLabel hint="Sin fecha: 6 días hábiles">Entrega</FieldLabel>
              <DatePicker value={due || null} onChange={(v) => setDue(v ?? '')} />
            </div>
          )}
          {item.linkedActivities.length > 0 && (
            <div className="space-y-1.5">
              <FieldLabel>Ya tiene</FieldLabel>
              <ul className="divide-y divide-border border-y border-border">
                {item.linkedActivities.map((a) => (
                  <li key={a.id}>
                    {/* Abre el detalle en Actividades: ahi vive "Subtareas" para descomponer
                        este compromiso en un proyecto de varios niveles. */}
                    <button
                      type="button"
                      onClick={() => navigate('/activities', { state: { activityId: a.id } })}
                      title="Abrir actividad"
                      className="w-full flex items-center gap-3 py-1.5 text-left hover:bg-surface"
                    >
                      <span className="flex-1 min-w-0 truncate text-sm text-fg-body">
                        {memberName(a.responsible_id)}
                      </span>
                      <StatusLabel {...estadoActividad(a.status, a.due_date)} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
