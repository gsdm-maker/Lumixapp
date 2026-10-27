import { useLocation, useNavigate } from 'react-router-dom'
import { Avatar } from '@shared/components/ui/Avatar'
import { Icon } from '@shared/components/ui/Icon'
import { Desplegable } from '@shared/components/ui/Desplegable'
import { useAuth } from '@core/auth/hooks/useAuth'
import { useNotificationsContext } from '@core/notifications/NotificationContext'
import { useTheme } from '@core/theme/ThemeContext'
import { abrirPaletaDeComandos } from './paletaEventos'
import { BotonRedondo, ContadorNoLeidas, MenuPersona } from './MenuPersona'

/**
 * Buscar (Ctrl K), tema, notificaciones y el menu de la persona, arriba a la derecha. Es el mismo
 * grupo con el menu de modulos arriba (TopBar) o a un costado (AppLayout): asi la barra lateral
 * queda solo para navegar y no se aprieta.
 */
export function AccionesSuperiores() {
  const { profile } = useAuth()
  const { unreadCount } = useNotificationsContext()
  const { theme, setPreference } = useTheme()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
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
  )
}
