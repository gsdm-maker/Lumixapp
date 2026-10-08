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

// Los modulos de uso diario van a la vista en la barra; el resto, en "Mas". Notificaciones
// tiene su campana propia.
const PRINCIPALES = ['/chat', '/activities', '/minuta', '/proyectos', '/compromisos', '/dashboard']

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

  const visibles = navItems.filter((n) => !n.capability || can(n.capability))
  const principales = visibles.filter((n) => PRINCIPALES.includes(n.to))
  const resto = visibles.filter((n) => !PRINCIPALES.includes(n.to) && n.to !== '/notifications')
  const enResto = resto.some((n) => pathname.startsWith(n.to)) || pathname.startsWith('/admin')

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
        <span className="text-lg font-extrabold tracking-tight text-fg">Lumix</span>
      </NavLink>

      <nav aria-label="Principal" className="vidrio flex items-center gap-0.5 rounded-full p-1">
        {principales.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) =>
              cx(
                'flex items-center gap-2 h-9 px-3.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors',
                isActive ? 'bg-fg text-shell' : 'text-fg-muted hover:text-fg',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon name={n.icon} size={16} className={isActive ? undefined : tonoIcono(n)} />
                <span className="hidden lg:inline">{n.label}</span>
                <span className="lg:hidden sr-only">{n.label}</span>
              </>
            )}
          </NavLink>
        ))}
        {(resto.length > 0 || isAdmin) && (
          <Desplegable
            alinear="izquierda"
            botonClassName={cx(
              'flex items-center gap-1.5 h-9 px-3.5 rounded-full text-sm font-semibold transition-colors',
              enResto ? 'bg-fg text-shell' : 'text-fg-muted hover:text-fg',
            )}
            boton={
              <>
                Más
                <Icon name="chevronDown" size={14} />
              </>
            }
          >
            {(cerrar) => (
              <>
                {resto.map((n) => (
                  <OpcionMenu
                    key={n.to}
                    onClick={() => {
                      navigate(n.to)
                      cerrar()
                    }}
                    className={pathname.startsWith(n.to) ? 'bg-surface font-semibold' : undefined}
                  >
                    <Icon name={n.icon} size={17} className={tonoIcono(n)} />
                    {n.label}
                  </OpcionMenu>
                ))}
                {isAdmin && (
                  <>
                    <div className="h-px bg-border my-1.5 mx-2" />
                    <OpcionMenu
                      onClick={() => {
                        navigate('/admin')
                        cerrar()
                      }}
                    >
                      <Icon name="shield" size={17} className="text-fg-faint" />
                      Administración
                    </OpcionMenu>
                  </>
                )}
              </>
            )}
          </Desplegable>
        )}
      </nav>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={abrirPaletaDeComandos}
          className="vidrio hidden lg:flex items-center gap-2 h-10 pl-3.5 pr-2 rounded-full text-sm text-fg-faint hover:text-fg-muted transition-colors"
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
          className="lg:hidden"
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
