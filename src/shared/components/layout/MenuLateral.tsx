import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
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

type Etiqueta = { texto: string; top: number; x: number } | null
type HandlersEtiqueta = {
  onPointerEnter: (e: PointerEvent<HTMLElement>) => void
  onPointerLeave: () => void
  onFocus: (e: FocusEvent<HTMLElement>) => void
  onBlur: () => void
}

/**
 * Nombre de cada item en el modo compacto, como etiqueta flotante (WCAG 1.4.13): aparece con el
 * mouse o el foco, se puede pasar el mouse sobre ella sin que se vaya, y se cierra con Escape. Va
 * en un portal fijo a la pantalla: asi la lista de modulos puede tener scroll sin cortarla.
 */
function useEtiqueta(lado: Lado, activa: boolean) {
  const [etiqueta, setEtiqueta] = useState<Etiqueta>(null)
  const temporizador = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!etiqueta) return
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEtiqueta(null)
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [etiqueta])

  const cancelar = () => window.clearTimeout(temporizador.current)
  const ocultarLuego = () => {
    cancelar()
    temporizador.current = window.setTimeout(() => setEtiqueta(null), 150)
  }
  const mostrar = (texto: string, el: HTMLElement) => {
    cancelar()
    const r = el.getBoundingClientRect()
    setEtiqueta({
      texto,
      top: r.top + r.height / 2,
      x: lado === 'derecha' ? window.innerWidth - r.left + 12 : r.right + 12,
    })
  }

  const props = (texto: string): HandlersEtiqueta | Record<string, never> =>
    activa
      ? {
          onPointerEnter: (e) => mostrar(texto, e.currentTarget),
          onPointerLeave: ocultarLuego,
          onFocus: (e) => mostrar(texto, e.currentTarget),
          onBlur: () => setEtiqueta(null),
        }
      : {}

  const nodo =
    activa && etiqueta
      ? createPortal(
          <span
            role="tooltip"
            onPointerEnter={cancelar}
            onPointerLeave={ocultarLuego}
            style={{
              position: 'fixed',
              top: etiqueta.top,
              [lado === 'derecha' ? 'right' : 'left']: etiqueta.x,
              transform: 'translateY(-50%)',
            }}
            className="z-[80] whitespace-nowrap rounded-lg bg-fg px-2.5 py-1 text-xs font-medium text-shell shadow-md animate-in fade-in-0 duration-100"
          >
            {etiqueta.texto}
          </span>,
          document.body,
        )
      : null

  return { props, nodo }
}

function Accion({
  label,
  icon,
  onClick,
  activo = false,
  compacto,
  etiqueta,
  children,
}: {
  label: string
  icon: IconName
  onClick: () => void
  activo?: boolean
  compacto: boolean
  etiqueta: ReturnType<typeof useEtiqueta>['props']
  children?: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={claseItem(activo, compacto)}
      {...etiqueta(label)}
    >
      <span className="relative">
        <Icon name={icon} size={18} />
        {children}
      </span>
      {!compacto && <span className="truncate">{label}</span>}
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
  const etiqueta = useEtiqueta(lado, compacto)

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

      {/* Con poca altura (o zoom) la lista se desplaza; las etiquetas van en un portal. */}
      <div
        className={cx('flex flex-col gap-1 min-h-0 overflow-y-auto', compacto && 'items-center')}
      >
        {modulos.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            aria-label={compacto ? n.label : undefined}
            className={({ isActive }) => claseItem(isActive, compacto)}
            {...etiqueta.props(n.label)}
          >
            {({ isActive }) => (
              <>
                <Icon name={n.icon} size={18} className={isActive ? undefined : tonoIcono(n)} />
                {!compacto && <span className="truncate">{n.label}</span>}
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
          etiqueta={etiqueta.props}
        />
        <Accion
          label={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
          icon={theme === 'dark' ? 'sun' : 'moon'}
          onClick={() => setPreference(theme === 'dark' ? 'light' : 'dark')}
          compacto={compacto}
          etiqueta={etiqueta.props}
        />
        <Accion
          label={unreadCount ? `Notificaciones (${unreadCount})` : 'Notificaciones'}
          icon="bell"
          onClick={() => navigate('/notifications')}
          activo={pathname.startsWith('/notifications')}
          compacto={compacto}
          etiqueta={etiqueta.props}
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
      {etiqueta.nodo}
    </nav>
  )
}
