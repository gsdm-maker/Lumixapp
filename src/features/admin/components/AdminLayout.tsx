import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@core/auth/hooks/useAuth'
import { Icon, type IconName } from '@shared/components/ui/Icon'
import { Button } from '@shared/components/ui/Button'
import { LumixIcon } from '@shared/components/ui/LumixIcon'
import { cx } from '@shared/utils/cx'

const SECCIONES: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/admin', label: 'Personas', icon: 'users', end: true },
  { to: '/admin/equipos', label: 'Equipos', icon: 'layers' },
  { to: '/admin/actividad', label: 'Actividad', icon: 'historial' },
]

/**
 * Consola de administracion: separada de la app de trabajo, con su propio menu y una franja
 * que deja claro que se esta en modo administracion. Solo para el admin global; a cualquier
 * otra persona la manda al chat (y aunque entrara, la Edge Function rechaza todo sin rol
 * admin: esto es orden, no la seguridad).
 */
export function AdminLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  if (!profile) return null
  if (profile.role !== 'admin') return <Navigate to="/chat" replace />

  const salir = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-dvh flex flex-col fondo-orbita text-fg-body">
      <a
        href="#contenido-admin"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[90] focus:rounded-full focus:bg-panel focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-fg focus:shadow-lg"
      >
        Saltar al contenido
      </a>

      {/* Franja de modo: siempre a la vista, para no confundir la consola con la app. */}
      <div className="flex items-center gap-2 px-4 sm:px-6 h-9 bg-fg text-shell text-xs font-semibold">
        <Icon name="shield" size={14} />
        Modo administración
        <span className="hidden sm:inline font-normal opacity-75">
          · los cambios aplican a todos los equipos
        </span>
      </div>

      <header className="flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-border">
        <LumixIcon size="sm" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg leading-tight">Administración</p>
          <p className="text-xs text-fg-faint truncate">{profile.full_name}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" size="sm" icon="arrowLeft" onClick={() => navigate('/chat')}>
            Volver a Lumix
          </Button>
          <Button variant="ghost" size="sm" icon="logout" onClick={salir}>
            <span className="hidden sm:inline">Cerrar sesión</span>
            <span className="sr-only sm:hidden">Cerrar sesión</span>
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        <nav
          aria-label="Secciones de administración"
          className="shrink-0 flex md:flex-col gap-1 px-3 py-2 md:p-4 md:w-56 border-b md:border-b-0 md:border-r border-border overflow-x-auto"
        >
          {SECCIONES.map((s) => (
            <NavLink
              key={s.to}
              to={s.to}
              end={s.end}
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-2.5 h-10 px-3 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
                  isActive
                    ? 'bg-panel text-fg shadow-sm'
                    : 'text-fg-muted hover:text-fg hover:bg-surface',
                )
              }
            >
              <Icon name={s.icon} size={17} />
              {s.label}
            </NavLink>
          ))}
        </nav>

        <main id="contenido-admin" tabIndex={-1} className="flex-1 min-w-0 outline-none">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
