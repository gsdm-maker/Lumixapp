import { useState } from 'react'
import type { ActivityStatus } from '@shared/types'
import type { ActivityListItem } from '@features/chat/components/ActivityListMessage'
import { Modal } from '@shared/components/ui/Modal'
import { Button } from '@shared/components/ui/Button'
import { FieldLabel, Input, Select, Textarea } from '@shared/components/ui/Input'
import { PriorityPicker } from '@shared/components/ui/Indicators'
import { useToast } from '@shared/components/ui/Toast'
import { ACTIVITY_STATUS } from '@shared/utils/estados'

export interface EditChanges {
  priority: number
  due_date: string
  description: string
  status: ActivityStatus
  responsibleId?: string
}

interface Props {
  item: ActivityListItem
  canAssignOthers: boolean
  members: { id: string; full_name: string }[]
  onSave: (id: string, changes: EditChanges) => Promise<unknown>
  onClose: () => void
}

/**
 * Edicion completa de una actividad del listado. Se monta con la actividad elegida, asi el
 * formulario arranca con sus datos sin sincronizar estado a mano.
 */
export function EditActivityModal({ item, canAssignOthers, members, onSave, onClose }: Props) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    priority: item.priority,
    due_date: item.dueDate.split('T')[0],
    description: item.description ?? '',
    status: (item.status in ACTIVITY_STATUS ? item.status : 'pendiente') as ActivityStatus,
    responsibleId: item.responsibleId,
  })

  const guardar = async () => {
    setSaving(true)
    try {
      await onSave(item.id, {
        priority: form.priority,
        due_date: form.due_date,
        description: form.description,
        status: form.status,
        responsibleId: canAssignOthers ? form.responsibleId : undefined,
      })
      // El cambio tambien queda en el chat (Lumix deja la tarjeta actualizada); el aviso solo
      // confirma que se guardo, sin dejar la ventana abierta con un mensaje de exito.
      toast.success('Actividad actualizada')
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={() => !saving && onClose()}
      dismissible={!saving}
      title={item.title.replace(/^\[Ingesta\]\s*/, '')}
      footer={
        <>
          <Button variant="secondary" disabled={saving} onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={saving} onClick={guardar}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Textarea
          label="Descripción"
          rows={3}
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />

        <div className="flex flex-col gap-1.5">
          <FieldLabel>Prioridad</FieldLabel>
          <PriorityPicker
            value={form.priority}
            onChange={(p) => setForm((f) => ({ ...f, priority: p }))}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Fecha de entrega"
            type="date"
            value={form.due_date}
            onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
          />
          <Select
            label="Estado"
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ActivityStatus }))}
          >
            {(Object.keys(ACTIVITY_STATUS) as ActivityStatus[]).map((s) => (
              <option key={s} value={s}>
                {ACTIVITY_STATUS[s].label}
              </option>
            ))}
          </Select>
        </div>

        {canAssignOthers && (
          <Select
            label="Responsable"
            value={form.responsibleId}
            onChange={(e) => setForm((f) => ({ ...f, responsibleId: e.target.value }))}
          >
            {members.length === 0 && (
              <option value={form.responsibleId}>{item.responsibleName}</option>
            )}
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name}
              </option>
            ))}
          </Select>
        )}
      </div>
    </Modal>
  )
}
