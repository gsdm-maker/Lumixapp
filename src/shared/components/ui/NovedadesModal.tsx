import { useState } from 'react'
import { Modal } from '@shared/components/ui/Modal'
import { Button } from '@shared/components/ui/Button'
import { useAuth } from '@core/auth/hooks/useAuth'
import { profilesService } from '@infrastructure/supabase/profiles.service'
import { APP_VERSION, CHANGELOG_VERSION, CHANGELOG_ITEMS } from '@shared/changelog'

// Se muestra UNA vez por usuario (no por dispositivo) cuando su `changelog_visto` queda
// atras de CHANGELOG_VERSION. `profile` llega desde AuthContext ya cargado -AppLayout solo
// se monta dentro de AuthGuard, asi que siempre hay sesion cuando esto renderiza.
export function NovedadesModal() {
  const { profile, user } = useAuth()
  const yaVisto = (profile?.changelog_visto ?? 0) >= CHANGELOG_VERSION
  // Estado propio para poder cerrar al instante sin esperar a que AuthContext refresque el
  // profile completo -guardar en la base es en paralelo, no bloquea la UI.
  const [cerrado, setCerrado] = useState(false)

  const cerrar = () => {
    setCerrado(true)
    if (user)
      profilesService.update(user.id, { changelog_visto: CHANGELOG_VERSION }).catch(() => {})
  }

  if (!profile || yaVisto || cerrado) return null

  return (
    <NovedadesDialog
      open
      onClose={cerrar}
      intro="Esto es lo nuevo desde la última vez que entraste."
    />
  )
}

/**
 * El mismo contenido, abrible a mano (Perfil -> "Ver novedades"). Separado de NovedadesModal
 * para no tocar su logica de "una vez por usuario": verlo desde Perfil no marca nada.
 */
export function NovedadesDialog({
  open,
  onClose,
  intro,
}: {
  open: boolean
  onClose: () => void
  intro?: string
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novedades en Lumix"
      description={`Versión ${APP_VERSION}`}
      size="md"
      footer={<Button onClick={onClose}>Entendido</Button>}
    >
      {intro && <p className="text-sm text-fg-muted mb-3">{intro}</p>}
      {/* Lista de texto, sin emoji por item: era decoracion que competia con el titulo. */}
      <ul className="divide-y divide-border">
        {CHANGELOG_ITEMS.map((item) => (
          <li key={item.title} className="py-2.5 first:pt-0 last:pb-0">
            <p className="text-sm font-medium text-fg">{item.title}</p>
            <p className="text-sm text-fg-muted leading-relaxed mt-0.5">{item.desc}</p>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
