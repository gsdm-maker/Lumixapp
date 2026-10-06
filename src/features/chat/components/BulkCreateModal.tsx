import { useState } from 'react'
import type { BulkActivity } from '@core/ai-engine/client'
import { Modal } from '@shared/components/ui/Modal'
import { Button } from '@shared/components/ui/Button'
import { PriorityBars } from '@shared/components/ui/Indicators'
import { useToast } from '@shared/components/ui/Toast'
import { PRIORITY_LABEL } from '@shared/utils/estados'
import { formatDateLocal } from '@shared/utils/date'

interface Props {
  items: BulkActivity[]
  onCreate: (items: BulkActivity[]) => Promise<number>
  onClose: () => void
}

/** Modo masivo: revisar lo que Lumix detecto en la lista pegada antes de crear todo. */
export function BulkCreateModal({ items, onCreate, onClose }: Props) {
  const toast = useToast()
  const [creating, setCreating] = useState(false)
  const vacio = items.length === 0

  const crear = async () => {
    setCreating(true)
    try {
      const n = await onCreate(items)
      toast.success(`${n} ${n === 1 ? 'actividad creada' : 'actividades creadas'}`)
      onClose()
    } finally {
      setCreating(false)
    }
  }

  return (
    <Modal
      open
      onClose={() => !creating && onClose()}
      dismissible={!creating}
      title={vacio ? 'Sin actividades' : `${items.length} actividades detectadas`}
      description={vacio ? undefined : 'Revisa y confirma para crearlas todas.'}
      footer={
        vacio ? (
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        ) : (
          <>
            <Button variant="secondary" disabled={creating} onClick={onClose}>
              Cancelar
            </Button>
            <Button loading={creating} onClick={crear}>
              Crear {items.length}
            </Button>
          </>
        )
      }
    >
      {vacio ? (
        <p className="text-sm text-fg-muted">No detecté actividades en el texto.</p>
      ) : (
        <ul className="-mx-1 divide-y divide-border">
          {items.map((it, i) => (
            <li key={i} className="px-1 py-2">
              <p className="text-sm text-fg">{it.title}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-fg-muted">
                <span>{it.responsible || 'Sin asignar'}</span>
                {/* La fecha viene de la IA: si no trae el formato esperado se muestra tal cual. */}
                {it.due_date && (
                  <span>
                    {/^\d{4}-\d{2}-\d{2}/.test(it.due_date)
                      ? formatDateLocal(it.due_date)
                      : it.due_date}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <PriorityBars priority={it.priority ?? 2} />
                  {PRIORITY_LABEL[it.priority ?? 2]}
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
