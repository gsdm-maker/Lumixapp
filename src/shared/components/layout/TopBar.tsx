import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Avatar } from '@shared/components/ui/Avatar'
import { Icon } from '@shared/components/ui/Icon'
import { LumixIcon } from '@shared/components/ui/LumixIcon'
import { Desplegable } from '@shared/components/ui/Desplegable'
import { useAuth } from '@core/auth/hooks/useAuth'
import { useNotificationsContext } from '@core/notifications/NotificationContext'
import { useTheme } from '@core/theme/ThemeContext'
import { cx } from '@shared/utils/cx'
import { abrirPaletaDeComandos } from './paletaEventos'
import { tonoIcono, useModulos } from './useModulos'
import { BotonRedondo, ContadorNoLeidas, MenuPersona } from './MenuPersona'
import { SelectorEquipo } from './SelectorEquipo'

/**
 * Menu superior del escritorio (rediseno Orbita, la posicion por defecto): marca con el nucleo
 * de Lumix, los modulos en una barra flotante de vidrio, y a la derecha buscar (Ctrl K), tema,
 * notificaciones y el menu de la persona. La persona puede pasarlo a un costado (MenuLateral).
 * En el celular manda el menu inferior (BottomNav) y el lateral (Sidebar).
 */
export function TopBar() {
  const { profile } = useAuth()
  const { unreadCount } = useNotificationsContext()
  const { theme, setPreference } = useTheme()
  const modulos = useModulos()
  const navigate = useNavigate()
  const { pathname } = useLocation()

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
      <SelectorEquipo />

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
          <ContadorNoLeidas n={unreadCount} />
        </BotonRedondo>

        <Desplegable
          label={`Menú de ${profile?.full_name ?? 'usuario'}`}
          botonClassName="ml-1 rounded-full"
          panelClassName="w-72"
          boton={
            <Avatar name={profile?.full_name ?? 'Usuario'} src={profile?.avatar_url} size="md" />
          }
        >
          {(cerrar) => <MenuPersona cerrar={cerrar} />}
        </Desplegable>
      </div>
    </header>
  )
}
