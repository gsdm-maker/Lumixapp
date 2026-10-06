import { NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Avatar } from '@shared/components/ui/Avatar'
import { LumixIcon } from '@shared/components/ui/LumixIcon'
import { Icon, type IconName } from '@shared/components/ui/Icon'
import { IconButton } from '@shared/components/ui/Button'
import { InstalarApp } from '@shared/components/ui/InstalarApp'
import { useToast } from '@shared/components/ui/Toast'
import { useAuth } from '@core/auth/hooks/useAuth'
import { useCapabilities } from '@core/auth/hooks/useCapabilities'
import { useNotificationsContext } from '@core/notifications/NotificationContext'
import { teamsService } from '@infrastructure/supabase/teams.service'
import { cx } from '@shared/utils/cx'
import { navItems } from './navItems'

interface SidebarProps {
  onClose?: () => void
}

const ROL: Record<string, string> = {
  admin: 'Admin',
  jefatura: 'Jefatura',
  colaborador: 'Colaborador',
  invitado: 'Invitado',
}

/**
 * Barra lateral compacta: logo, equipo activo, navegacion y la persona. La seccion activa se
 * marca con una linea del acento y texto en tinta, sin un bloque de color.
 */
export function Sidebar({ onClose }: SidebarProps) {
  const { profile, teamRole, signOut, user, switchTeam } = useAuth()
  const { can } = useCapabilities()
  const { unreadCount } = useNotificationsContext()
  const navigate = useNavigate()
  const toast = useToast()
  const isAdmin = profile?.role === 'admin'
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([])
  const [switching, setSwitching] = useState(false)

  useEffect(() => {
    if (!user) return
    teamsService.getMyTeams(user.id).then(setTeams)
  }, [user])

  const equipoActual = teams.find((t) => t.id === profile?.team_id)
  const puedeCambiar = isAdmin ? teams.length > 0 : teams.length > 1

  const cambiarEquipo = async (teamId: string) => {
    if (!profile || teamId === profile.team_id) return
    setSwitching(true)
    const { error } = await switchTeam(teamId)
    setSwitching(false)
    if (error) {
      toast.error(`No se pudo cambiar de equipo: ${error}`)
      return
    }
    toast.success(`Ahora estás en ${teams.find((t) => t.id === teamId)?.name ?? 'el equipo'}`)
    onClose?.()
  }

  const salir = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <aside
      className="flex flex-col h-full w-60 bg-panel border-r border-border"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex items-center gap-2.5 px-4 h-12 shrink-0">
        <LumixIcon size="sm" />
        <span className="text-sm font-semibold text-fg">Lumix</span>
      </div>

      {/* Equipo activo: siempre visible; se puede cambiar si hay mas de uno. */}
      <div className="px-3 pb-2">
        {puedeCambiar ? (
          <label className="relative block">
            <span className="sr-only">Equipo activo</span>
            <select
              value={profile?.team_id ?? ''}
              onChange={(e) => cambiarEquipo(e.target.value)}
              disabled={switching}
              className="w-full h-8 appearance-none rounded-md border border-border-strong bg-field pl-2.5 pr-8 text-base sm:text-sm font-medium text-fg cursor-pointer hover:border-fg-faint focus:outline-none focus:border-accent disabled:opacity-60"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <Icon
              name="chevronDown"
              size={14}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-faint"
            />
          </label>
        ) : (
          equipoActual && (
            <div className="h-8 flex items-center px-2.5 rounded-md bg-surface text-sm font-medium text-fg truncate">
              {equipoActual.name}
            </div>
          )
        )}
      </div>

      <nav aria-label="Principal" className="flex-1 overflow-y-auto px-2 py-1 space-y-px">
        {navItems
          .filter((item) => !item.capability || can(item.capability))
          .map((item) => (
            <NavItemLink
              key={item.to}
              to={item.to}
              label={item.label}
              icon={item.icon}
              onClick={onClose}
              badge={item.to === '/notifications' && unreadCount > 0 ? unreadCount : undefined}
            />
          ))}
        {isAdmin && (
          <>
            <div className="h-px bg-border my-2 mx-2" />
            <NavItemLink to="/admin" label="Administración" icon="shield" onClick={onClose} />
          </>
        )}
      </nav>

      <div className="shrink-0 border-t border-border p-2">
        <InstalarApp className="mb-1 px-2" />
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              navigate('/profile')
              onClose?.()
            }}
            className="flex-1 min-w-0 flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-surface text-left"
          >
            <Avatar name={profile?.full_name ?? 'Usuario'} src={profile?.avatar_url} size="sm" />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-fg truncate">
                {profile?.full_name ?? 'Usuario'}
              </span>
              <span className="block text-xs text-fg-faint truncate">
                {ROL[teamRole ?? profile?.role ?? ''] ?? 'Colaborador'}
              </span>
            </span>
          </button>
          <IconButton icon="logout" label="Cerrar sesión" onClick={salir} />
        </div>
      </div>
    </aside>
  )
}

function NavItemLink({
  to,
  label,
  icon,
  badge,
  onClick,
}: {
  to: string
  label: string
  icon: IconName
  badge?: number
  onClick?: () => void
}) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        cx(
          'relative flex items-center gap-2.5 h-8 px-2.5 rounded-md text-sm transition-colors',
          isActive
            ? 'bg-surface text-fg font-medium before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:bg-accent'
            : 'text-fg-muted hover:text-fg hover:bg-surface',
        )
      }
    >
      <Icon name={icon} size={17} />
      <span className="flex-1 truncate">{label}</span>
      {badge !== undefined && (
        <span
          aria-label={`${badge} sin leer`}
          className="min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-danger text-on-accent text-2xs font-semibold"
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </NavLink>
  )
}
