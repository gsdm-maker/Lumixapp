import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@core/auth/hooks/useAuth'
import { Icon, type IconName } from '@shared/components/ui/Icon'
import { LoadingState } from '@shared/components/ui/Spinner'
import { AuthShell } from './AuthShell'

/**
 * Despues de iniciar sesion: el admin global elige si entra a trabajar (Lumix) o a la consola
 * de administracion. Cualquier otra persona pasa directo al chat, sin ver esta pantalla.
 */
export function ElegirEntrada() {
  const { profile } = useAuth()

  // El perfil llega un momento despues del inicio de sesion.
  if (!profile)
    return (
      <div className="min-h-dvh flex items-center justify-center bg-shell">
        <LoadingState label="Cargando…" />
      </div>
    )
  if (profile.role !== 'admin') return <Navigate to="/chat" replace />

  return (
    <AuthShell title={`Hola, ${profile.full_name.split(' ')[0]}`} subtitle="¿Dónde quieres entrar?">
      <div className="space-y-2">
        <Opcion
          to="/chat"
          icon="chat"
          titulo="Lumix"
          texto="El chat, tus actividades y los equipos"
        />
        <Opcion
          to="/admin"
          icon="shield"
          titulo="Administración"
          texto="Personas, accesos, equipos y registro"
        />
      </div>
    </AuthShell>
  )
}

function Opcion({
  to,
  icon,
  titulo,
  texto,
}: {
  to: string
  icon: IconName
  titulo: string
  texto: string
}) {
  return (
    <Link
      to={to}
      replace
      className="flex items-center gap-3 rounded-2xl border border-border p-3 transition-colors hover:bg-surface hover:border-border-strong"
    >
      <span className="grid place-items-center w-10 h-10 rounded-xl bg-accent-soft text-accent">
        <Icon name={icon} size={19} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-fg">{titulo}</span>
        <span className="block text-xs text-fg-faint">{texto}</span>
      </span>
      <Icon name="chevronRight" size={16} className="text-fg-faint" />
    </Link>
  )
}
