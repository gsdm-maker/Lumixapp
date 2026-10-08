import type { ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Avatar } from '@shared/components/ui/Avatar'
import { Icon, type IconName } from '@shared/components/ui/Icon'
import { LumixIcon } from '@shared/components/ui/LumixIcon'
import { Desplegable } from '@shared/components/ui/Desplegable'
import { useAuth } from '@core/auth/hooks/useAuth'
import { useNotificationsContext } from '@core/notifications/NotificationContext'
import { useTheme } from '@core/theme/ThemeContext'
import { cx } from '@shared/utils/cx'
import { abrirPaletaDeComandos } from './paletaEventos'
import { tonoIcono, useModulos } from './useModulos'
import { ContadorNoLeidas, MenuPersona } from './MenuPersona'
import { SelectorEquipo } from './SelectorEquipo'

type Lado = 'izquierda' | 'derecha'

const claseItem = (activo: boolean, compacto: boolean) =>
  cx(
    'group relative flex items-center gap-2.5 min-h-11 rounded-full text-[13.5px] font-semibold transition-colors',
    compacto ? 'w-11 justify-center' : 'w-full px-3.5',
    activo ? 'bg-fg text-shell' : 'text-fg-muted hover:text-fg hover:bg-surface',
  )

/** Nombre del item: a la vista, o (compacto) en una etiqueta del lado del contenido al pasar el mouse. */
function Nombre({ texto, compacto, lado }: { texto: string; compacto: boolean; lado: Lado }) {
  if (!compacto) return <span className="truncate">{texto}</span>
  return (
    <span
      aria-hidden="true"
      className={cx(
        'pointer-events-none absolute top-1/2 -translate-y-1/2 z-50 whitespace-nowrap rounded-lg bg-fg px-2.5 py-1 text-xs font-medium text-shell opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100',
        lado === 'derecha' ? 'right-full mr-3' : 'left-full ml-3',
      )}
    >
      {texto}
    </span>
  )
}

function Accion({
  label,
  icon,
  onClick,
  activo = false,
  compacto,
  lado,
  children,
}: {
  label: string
  icon: IconName
  onClick: () => void
  activo?: boolean
  compacto: boolean
  lado: Lado
  children?: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={claseItem(activo, compacto)}
    >
      <span className="relative">
        <Icon name={icon} size={18} />
        {children}
      </span>
      <Nombre texto={label} compacto={compacto} lado={lado} />
    </button>
  )
}

/**
 * Menu de modulos como barra vertical a un costado (eleccion de la persona, ver Perfil >
 * Apariencia). Compacto: solo iconos, con el nombre en una etiqueta al pasar el mouse; o con
 * los nombres a la vista. Abajo: buscar, tema, notificaciones y el menu de la persona.
 */
export function MenuLateral({ lado }: { lado: Lado }) {
  const { profile } = useAuth()
  const { unreadCount } = useNotificationsContext()
  const { theme, setPreference, menuNombres } = useTheme()
  const modulos = useModulos()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const compacto = !menuNombres

  return (
    <nav
      aria-label="Principal"
      className={cx(
        'vidrio relative z-30 hidden md:flex shrink-0 flex-col gap-1 rounded-[28px] my-3 py-3 px-2',
        lado === 'derecha' ? 'order-last mr-3' : 'ml-3',
        compacto ? 'w-[64px] items-center' : 'w-[212px]',
      )}
    >
      <NavLink
        to="/chat"
        aria-label="Lumix, ir al chat"
        className={cx('flex items-center gap-2.5 pb-2', compacto ? 'justify-center' : 'px-2.5')}
      >
        <LumixIcon size="md" />
        {!compacto && <span className="text-lg font-extrabold tracking-tight text-fg">Lumix</span>}
      </NavLink>
      <div
        className={cx('pb-2 mb-1 border-b border-border', compacto ? 'flex justify-center' : '')}
      >
        <SelectorEquipo
          compacto={compacto}
          abrirHacia={lado === 'derecha' ? 'izquierda' : 'derecha'}
        />
      </div>

      {/* En compacto sin scroll propio: las etiquetas salen del borde y un overflow las cortaria. */}
      <div
        className={cx('flex flex-col gap-1 min-h-0', compacto ? 'items-center' : 'overflow-y-auto')}
      >
        {modulos.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            aria-label={compacto ? n.label : undefined}
            className={({ isActive }) => claseItem(isActive, compacto)}
          >
            {({ isActive }) => (
              <>
                <Icon name={n.icon} size={18} className={isActive ? undefined : tonoIcono(n)} />
                <Nombre texto={n.label} compacto={compacto} lado={lado} />
              </>
            )}
          </NavLink>
        ))}
      </div>

      <div
        className={cx(
          'mt-auto flex flex-col gap-1 pt-2 border-t border-border',
          compacto && 'items-center',
        )}
      >
        <Accion
          label="Buscar o crear (Ctrl K)"
          icon="search"
          onClick={abrirPaletaDeComandos}
          compacto={compacto}
          lado={lado}
        />
        <Accion
          label={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
          icon={theme === 'dark' ? 'sun' : 'moon'}
          onClick={() => setPreference(theme === 'dark' ? 'light' : 'dark')}
          compacto={compacto}
          lado={lado}
        />
        <Accion
          label={unreadCount ? `Notificaciones (${unreadCount})` : 'Notificaciones'}
          icon="bell"
          onClick={() => navigate('/notifications')}
          activo={pathname.startsWith('/notifications')}
          compacto={compacto}
          lado={lado}
        >
          <ContadorNoLeidas n={unreadCount} />
        </Accion>
        <Desplegable
          label={`Menú de ${profile?.full_name ?? 'usuario'}`}
          abrirHacia={lado === 'derecha' ? 'izquierda' : 'derecha'}
          botonClassName={cx(
            'flex items-center gap-2.5 rounded-full hover:bg-surface transition-colors',
            compacto ? 'p-1' : 'w-full p-1.5 pr-3 text-left',
          )}
          panelClassName="w-72"
          boton={
            <>
              <Avatar name={profile?.full_name ?? 'Usuario'} src={profile?.avatar_url} size="sm" />
              {!compacto && (
                <span className="min-w-0 truncate text-sm font-semibold text-fg">
                  {profile?.full_name}
                </span>
              )}
            </>
          }
        >
          {(cerrar) => <MenuPersona cerrar={cerrar} />}
        </Desplegable>
      </div>
    </nav>
  )
}
