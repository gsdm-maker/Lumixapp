import { useState } from 'react'
import { Button } from '@shared/components/ui/Button'
import { DatePicker } from '@shared/components/ui/DatePicker'
import { PriorityPicker } from '@shared/components/ui/Indicators'
import { FieldLabel, Input, Select, Textarea } from '@shared/components/ui/Input'
import { Modal } from '@shared/components/ui/Modal'
import { useToast } from '@shared/components/ui/Toast'
import type { Profile } from '@shared/types'
import { crearActividad } from '@features/activities/utils/crearActividad'
import { FECHA_CAMPO } from '@features/activities/utils/ui'

interface AssignActivityModalProps {
  open: boolean
  onClose: () => void
  userId: string | undefined
  teamId: string | null | undefined
  members: Profile[]
  onAssigned: () => void
}

/**
 * Asignar una actividad nueva en el equipo activo, opcionalmente llevandola a la minuta.
 * Se monta solo mientras esta abierto (ver ActivitiesPage), asi el formulario parte limpio.
 */
export function AssignActivityModal({
  open,
  onClose,
  userId,
  teamId,
  members,
  onAssigned,
}: AssignActivityModalProps) {
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [member, setMember] = useState('')
  const [priority, setPriority] = useState(2)
  const [due, setDue] = useState('')
  const [toMinuta, setToMinuta] = useState(false)
  const [busy, setBusy] = useState(false)

  const listo = !!title.trim() && !!member

  const asignar = async () => {
    if (!userId || !teamId || !listo) return
    setBusy(true)
    try {
      await crearActividad(
        {
          teamId,
          memberId: member,
          title: title.trim(),
          description: desc.trim(),
          priority,
          dueISO: due ? new Date(due).toISOString() : new Date().toISOString(),
          addToMinuta: toMinuta,
        },
        userId,
      )
      onClose()
      onAssigned()
      toast.success(toMinuta ? 'Asignada y agregada a la minuta' : 'Actividad asignada')
    } catch {
      toast.error('No se pudo asignar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Asignar actividad"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!listo} loading={busy} onClick={asignar}>
            Asignar
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input
          label="Título"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Qué hay que hacer…"
        />
        <Textarea
          label="Descripción (opcional)"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={2}
        />
        <Select label="Asignar a" value={member} onChange={(e) => setMember(e.target.value)}>
          <option value="">Elegir persona…</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name}
            </option>
          ))}
        </Select>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Prioridad</FieldLabel>
          <PriorityPicker value={priority} onChange={setPriority} />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Fecha de entrega</FieldLabel>
          <DatePicker
            value={due || null}
            onChange={(v) => setDue(v ?? '')}
            placeholder="Hoy"
            className={FECHA_CAMPO}
          />
        </div>
        <CheckMinuta checked={toMinuta} onChange={setToMinuta} />
      </div>
    </Modal>
  )
}

/** Casilla "Tambien llevar a la minuta", igual en asignar, subtarea y delegar. */
export function CheckMinuta({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-fg-muted cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-accent w-3.5 h-3.5"
      />
      También llevar a la minuta del equipo
    </label>
  )
}
