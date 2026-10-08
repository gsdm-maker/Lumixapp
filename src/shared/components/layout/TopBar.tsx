import type { ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Avatar } from '@shared/components/ui/Avatar'
import { Icon } from '@shared/components/ui/Icon'
import { LumixIcon } from '@shared/components/ui/LumixIcon'
import { InstalarApp } from '@shared/components/ui/InstalarApp'
import { Desplegable, OpcionMenu } from '@shared/components/ui/Desplegable'
import { useAuth } from '@core/auth/hooks/useAuth'
import { useCapabilities } from '@core/auth/hooks/useCapabilities'
import { useNotificationsContext } from '@core/notifications/NotificationContext'
import { useTheme } from '@core/theme/ThemeContext'
import { ROLE_LABEL } from '@core/auth/roles'
import { TAG } from '@shared/utils/colores'
import { cx } from '@shared/utils/cx'
import { navItems, type NavItem } from './navItems'
import { abrirPaletaDeComandos } from './paletaEventos'
import { useEquipos } from './useEquipos'
import { LogroRacha } from './LogroRacha'

const tonoIcono = (n: NavItem) =>
  n.color === 'accent' ? 'text-accent' : n.color ? TAG[n.color].text : 'text-fg-faint'

/**
 * Menu superior del escritorio (rediseno Orbita): marca con el nucleo de Lumix, los modulos en
 * una barra flotante de vidrio, y a la derecha buscar (Ctrl K), tema, notificaciones y el menu
 * de la persona (equipo, perfil, apariencia, WhatsApp, cerrar sesion). En el celular manda el
 * menu inferior (BottomNav) y el lateral (Sidebar).
 */
export function TopBar() {
  const { profile, teamRole, signOut } = useAuth()
  const { can } = useCapabilities()
  const { unreadCount } = useNotificationsContext()
  const { theme, setPreference } = useTheme()
  const { teams, equipoActual, puedeCambiar, cambiarEquipo, switching } = useEquipos()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isAdmin = profile?.role === 'admin'

  // Todos los modulos a la vista (pedido: sin "Mas"). Notificaciones tiene su campana.
  // Equipos y la Guia viven en el menu de la persona; Notificaciones, en su campana.
  const EN_MENU_PERSONA = ['/notifications', '/teams', '/guia']
  const modulos: NavItem[] = [
    ...navItems.filter(
      (n) => (!n.capability || can(n.capability)) && !EN_MENU_PERSONA.includes(n.to),
    ),
    ...(isAdmin ? [{ to: '/admin', label: 'Administración', icon: 'shield' as const }] : []),
  ]

  const salir = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <header className="relative z-30 hidden md:flex shrink-0 items-center gap-3 px-5 pt-3 pb-2">
      <NavLink
        to="/chat"
        className="flex items-center gap-2.5 mr-1 rounded-full"
        aria-label="Lumix, ir al chat"
      >
        <LumixIcon size="md" />
        <span className="hidden lg:inline text-lg font-extrabold tracking-tight text-fg">
          Lumix
        </span>
      </NavLink>

      <nav
        aria-label="Principal"
        className="vidrio flex flex-1 min-w-0 items-center justify-between gap-0.5 rounded-full p-1"
      >
        {modulos.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            title={n.label}
            className={({ isActive }) =>
              cx(
                'flex flex-1 items-center justify-center gap-1.5 h-9 px-2.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors',
                isActive ? 'bg-fg text-shell' : 'text-fg-muted hover:text-fg hover:bg-surface',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon name={n.icon} size={16} className={isActive ? undefined : tonoIcono(n)} />
                {/* Con poco ancho quedan los iconos (con su nombre en el tooltip). */}
                <span className="hidden xl:inline">{n.label}</span>
                <span className="xl:hidden sr-only">{n.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={abrirPaletaDeComandos}
          className="vidrio hidden 2xl:flex items-center gap-2 h-10 pl-3.5 pr-2 rounded-full text-sm text-fg-faint hover:text-fg-muted transition-colors"
        >
          <Icon name="search" size={16} />
          Buscar o crear
          <kbd className="font-mono text-2xs border border-border rounded-md px-1.5 py-0.5">
            Ctrl K
          </kbd>
        </button>
        <BotonRedondo
          label="Buscar o crear (Ctrl K)"
          onClick={abrirPaletaDeComandos}
          className="2xl:hidden"
        >
          <Icon name="search" size={18} />
        </BotonRedondo>
        <BotonRedondo
          label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
          onClick={() => setPreference(theme === 'dark' ? 'light' : 'dark')}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
        </BotonRedondo>
        <BotonRedondo
          label={unreadCount ? `Notificaciones, ${unreadCount} sin leer` : 'Notificaciones'}
          onClick={() => navigate('/notifications')}
          activo={pathname.startsWith('/notifications')}
        >
          <Icon name="bell" size={18} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 inline-flex items-center justify-center rounded-full bg-danger text-on-accent text-2xs font-bold ring-2 ring-shell">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </BotonRedondo>

        <Desplegable
          label={`Menú de ${profile?.full_name ?? 'usuario'}`}
          botonClassName="ml-1 rounded-full"
          panelClassName="w-72"
          boton={
            <Avatar name={profile?.full_name ?? 'Usuario'} src={profile?.avatar_url} size="md" />
          }
        >
          {(cerrar) => (
            <>
              <div className="px-3 pt-2 pb-2.5 border-b border-border mb-1.5">
                <p className="text-sm font-semibold text-fg truncate">{profile?.full_name}</p>
                <p className="text-xs text-fg-faint">
                  {ROLE_LABEL[isAdmin ? 'admin' : (teamRole ?? profile?.role ?? '')] ??
                    'Colaborador'}
                  {equipoActual ? ` · ${equipoActual.name}` : ''}
                </p>
                {puedeCambiar && (
                  <label className="relative block mt-2">
                    <span className="sr-only">Equipo activo</span>
                    <select
                      value={profile?.team_id ?? ''}
                      onChange={(e) => {
                        cambiarEquipo(e.target.value)
                        cerrar()
                      }}
                      disabled={switching}
                      className="w-full h-9 appearance-none rounded-xl border border-border-strong bg-field pl-3 pr-8 text-sm font-medium text-fg cursor-pointer focus:outline-none focus:border-accent disabled:opacity-60"
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
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-faint"
                    />
                  </label>
                )}
              </div>
              <LogroRacha />
              <OpcionMenu
                onClick={() => {
                  navigate('/profile')
                  cerrar()
                }}
              >
                <Icon name="user" size={17} className="text-fg-faint" />
                Mi perfil y apariencia
              </OpcionMenu>
              <OpcionMenu
                onClick={() => {
                  navigate('/guia')
                  cerrar()
                }}
              >
                <Icon name="guia" size={17} className="text-fg-faint" />
                Guía de Lumix
              </OpcionMenu>
              <OpcionMenu
                onClick={() => {
                  navigate('/teams')
                  cerrar()
                }}
              >
                <Icon name="users" size={17} className="text-fg-faint" />
                Equipos
              </OpcionMenu>
              <div
                className="flex items-center gap-2.5 min-h-10 px-3 rounded-xl text-sm text-tag-green"
                title="Muy pronto: avisos y órdenes a Lumix por WhatsApp"
              >
                <Icon name="chat" size={17} />
                Lumix por WhatsApp
                <span className="ml-auto text-2xs font-semibold px-2 py-0.5 rounded-full bg-tag-green-soft">
                  pronto
                </span>
              </div>
              <InstalarApp className="px-3" />
              <div className="h-px bg-border my-1.5 mx-2" />
              <OpcionMenu peligro onClick={salir}>
                <Icon name="logout" size={17} />
                Cerrar sesión
              </OpcionMenu>
            </>
          )}
        </Desplegable>
      </div>
    </header>
  )
}

function BotonRedondo({
  label,
  onClick,
  activo,
  className,
  children,
}: {
  label: string
  onClick: () => void
  activo?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cx(
        'vidrio relative w-10 h-10 rounded-full grid place-items-center transition-colors',
        activo ? 'text-accent' : 'text-fg-muted hover:text-fg',
        className,
      )}
    >
      {children}
    </button>
  )
}
