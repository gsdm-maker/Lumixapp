import { Modal } from '@shared/components/ui/Modal'
import { Button } from '@shared/components/ui/Button'
import { Icon } from '@shared/components/ui/Icon'
import { useToast } from '@shared/components/ui/Toast'

/**
 * Clave temporal recien generada. Se muestra UNA vez: no queda guardada en ningun lado (ni en
 * la app ni en el registro de actividad). Tocar fuera no cierra, para no perderla por error.
 */
export function ClaveTemporal({
  clave,
  persona,
  email,
  onClose,
}: {
  clave: string | null
  persona: string
  email: string
  onClose: () => void
}) {
  const toast = useToast()
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(clave ?? '')
      toast.success('Clave copiada')
    } catch {
      toast.error('No se pudo copiar; selecciónala a mano')
    }
  }

  return (
    <Modal
      open={!!clave}
      onClose={onClose}
      title="Clave temporal"
      description={`${persona} · ${email}`}
      size="sm"
      dismissible={false}
      footer={<Button onClick={onClose}>Listo, ya la entregué</Button>}
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <code className="flex-1 font-mono text-lg font-semibold tracking-wide text-fg select-all rounded-xl bg-surface border border-border px-3 py-2 text-center">
            {clave}
          </code>
          <Button variant="secondary" icon="copy" onClick={copiar}>
            Copiar
          </Button>
        </div>
        <p className="flex gap-2 text-xs text-fg-muted">
          <Icon name="info" size={14} className="shrink-0 mt-0.5 text-fg-faint" />
          Solo se muestra ahora. Entrégala por un canal privado (no en un grupo); al ingresar, la
          persona deberá cambiarla.
        </p>
      </div>
    </Modal>
  )
}
