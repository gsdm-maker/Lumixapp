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
import { Desplegable } from '@shared/components/ui/Desplegable'
import { Icon } from '@shared/components/ui/Icon'
import { LumixIcon } from '@shared/components/ui/LumixIcon'
import { useAuth } from '@core/auth/hooks/useAuth'
import { ROLE_LABEL } from '@core/auth/roles'
import { useNotificationsContext } from '@core/notifications/NotificationContext'
import { useTheme } from '@core/theme/ThemeContext'
import { cx } from '@shared/utils/cx'
import { abrirPaletaDeComandos } from './paletaEventos'
import { ContadorNoLeidas, MenuPersona } from './MenuPersona'
import { useModulos } from './useModulos'
import { SelectorEquipo } from './SelectorEquipo'
import { usePanelLateral } from './panelLateral'

type Lado = 'izquierda' | 'derecha'

// Estilo plano, como los chats de IA: letra normal, iconos grises y el activo con un fondo suave.
const claseItem = (activo: boolean, compacto: boolean) =>
  cx(
    'group relative flex items-center gap-3 h-9 rounded-lg text-sm transition-colors',
    compacto ? 'w-10 justify-center' : 'w-full px-2.5',
    activo ? 'bg-surface-2 text-fg font-medium' : 'text-fg-muted hover:text-fg hover:bg-surface',
  )

/** Icono chico de la cabecera (buscar, tema, notificaciones). */
function BotonCabecera({
  label,
  onClick,
  activo,
  children,
}: {
  label: string
  onClick: () => void
  activo?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cx(
        'relative grid place-items-center w-8 h-8 rounded-lg transition-colors hover:bg-surface',
        activo ? 'text-fg' : 'text-fg-muted hover:text-fg',
      )}
    >
      {children}
    </button>
  )
}

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

/**
 * Barra lateral (eleccion de la persona en Perfil > Apariencia), plana como la de los chats de IA:
 *
 *   arriba   Lumix y, a su lado, buscar (Ctrl K), tema y notificaciones; debajo, el equipo.
 *   medio    los modulos, con letra normal e iconos grises.
 *   abajo    "Mi semana" (en el chat) y la persona: avatar, nombre y su menu.
 *
 * Asi la pantalla no necesita una franja de botones arriba y el chat gana ese espacio.
 * Compacto: solo iconos, con el nombre en una etiqueta al pasar el mouse.
 *
 * "Mi semana": la barra se ensancha, esconde los modulos y muestra el panel de Lumix (lo dibuja
 * el chat en `ranura`, ver panelLateral.ts). "Volver al menu", Escape o cambiar de pagina
 * devuelven los modulos.
 */
export function MenuLateral({
  lado,
  onRanura,
}: {
  lado: Lado
  onRanura: (el: HTMLElement | null) => void
}) {
  const { menuNombres, theme, setPreference } = useTheme()
  const { profile, empresa } = useAuth()
  const { unreadCount } = useNotificationsContext()
  const modulos = useModulos()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const semana = usePanelLateral()
  const conSemana = pathname.startsWith('/chat')
  const compacto = !menuNombres && !semana.abierto
  const etiqueta = useEtiqueta(lado, compacto)
  const volverRef = useRef<HTMLButtonElement>(null)
  const botonRef = useRef<HTMLButtonElement>(null)
  const estabaAbierto = useRef(false)

  // Al abrir, el foco va a "Volver al menu"; al cerrar, vuelve al boton de "Mi semana".
  useEffect(() => {
    if (semana.abierto) volverRef.current?.focus()
    else if (estabaAbierto.current) botonRef.current?.focus()
    estabaAbierto.current = semana.abierto
  }, [semana.abierto])

  // Escape devuelve el menu, salvo que otro elemento (un dialogo, un menu) ya lo haya usado.
  const { abierto, cerrar } = semana
  useEffect(() => {
    if (!abierto) return
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) cerrar()
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [abierto, cerrar])

  return (
    <div
      className={cx(
        'relative z-30 hidden md:flex shrink-0 flex-col gap-1 bg-panel/70 py-2.5 px-2',
        'transition-[width] duration-200 ease-out motion-reduce:transition-none',
        lado === 'derecha' ? 'order-last border-l border-border' : 'border-r border-border',
        semana.abierto ? 'w-[360px]' : compacto ? 'w-[60px] items-center' : 'w-[260px]',
      )}
    >
      {/* Cabecera: marca y, a su lado, buscar, tema y notificaciones (como ChatGPT). */}
      <div className={cx('flex items-center gap-1 pb-1', compacto ? 'flex-col' : 'pl-1')}>
        <NavLink
          to="/chat"
          aria-label="Lumix, ir al chat"
          className="flex items-center gap-2 rounded-lg p-1 hover:bg-surface"
        >
          <LumixIcon size="sm" />
          {!compacto && <span className="text-base font-semibold text-fg">Lumix</span>}
        </NavLink>
        {!compacto && <span className="flex-1" />}
        <BotonCabecera label="Buscar o crear (Ctrl K)" onClick={abrirPaletaDeComandos}>
          <Icon name="search" size={17} />
        </BotonCabecera>
        <BotonCabecera
          label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
          onClick={() => setPreference(theme === 'dark' ? 'light' : 'dark')}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} />
        </BotonCabecera>
        <BotonCabecera
          label={unreadCount ? `Notificaciones, ${unreadCount} sin leer` : 'Notificaciones'}
          onClick={() => navigate('/notifications')}
          activo={pathname.startsWith('/notifications')}
        >
          <Icon name="bell" size={17} />
          <ContadorNoLeidas n={unreadCount} />
        </BotonCabecera>
      </div>
      <div className={cx('pb-2 mb-1', compacto ? 'flex justify-center' : '')}>
        <SelectorEquipo
          compacto={compacto}
          completo
          abrirHacia={lado === 'derecha' ? 'izquierda' : 'derecha'}
        />
      </div>

      {semana.abierto ? (
        <section aria-label="Mi semana" className="flex flex-1 min-h-0 flex-col gap-2">
          <button
            ref={volverRef}
            type="button"
            onClick={semana.cerrar}
            className="self-start inline-flex items-center gap-1.5 h-9 px-2.5 rounded-lg text-sm text-fg-muted hover:text-fg hover:bg-surface transition-colors"
          >
            <Icon name="arrowLeft" size={16} />
            Volver al menú
          </button>
          {/* El chat dibuja aca su panel (portal). */}
          <div
            ref={onRanura}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-1 pb-1"
          />
        </section>
      ) : (
        <nav
          aria-label="Principal"
          className={cx(
            'flex flex-col gap-0.5 min-h-0 overflow-y-auto',
            compacto && 'items-center',
          )}
        >
          {/* Con poca altura (o zoom) la lista se desplaza; las etiquetas van en un portal. */}
          {modulos.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              aria-label={compacto ? n.label : undefined}
              className={({ isActive }) => claseItem(isActive, compacto)}
              {...etiqueta.props(n.label)}
            >
              <Icon name={n.icon} size={17} />
              {!compacto && <span className="truncate">{n.label}</span>}
            </NavLink>
          ))}
        </nav>
      )}

      <div className={cx('mt-auto flex flex-col gap-1.5 pt-2 w-full', compacto && 'items-center')}>
        {/* "Mi semana": solo donde hay un panel que mostrar (el chat). */}
        {conSemana && !semana.abierto && (
          <button
            ref={botonRef}
            type="button"
            onClick={semana.alternar}
            aria-expanded={false}
            aria-label={compacto ? 'Mi semana' : undefined}
            {...(compacto ? etiqueta.props('Mi semana') : {})}
            className={cx(
              'inline-flex items-center justify-center gap-2 rounded-full bg-fg text-shell shadow-md text-sm font-medium',
              'hover:opacity-90 active:scale-[0.98] transition-[opacity,transform]',
              compacto ? 'w-10 h-10' : 'w-full h-10 px-4',
            )}
          >
            <Icon name="sparkles" size={16} />
            {!compacto && 'Mi semana'}
          </button>
        )}

        {/* La persona, abajo (como Claude): avatar, nombre, rol y empresa; abre su menu. */}
        <div className="border-t border-border pt-1.5">
          <Desplegable
            label={`Menú de ${profile?.full_name ?? 'usuario'}`}
            abrirHacia={lado === 'derecha' ? 'izquierda' : 'derecha'}
            botonClassName={cx(
              'flex items-center gap-2.5 rounded-lg hover:bg-surface transition-colors',
              compacto ? 'p-1 mx-auto' : 'w-full p-1.5 text-left',
            )}
            panelClassName="w-72"
            boton={
              <>
                <Avatar
                  name={profile?.full_name ?? 'Usuario'}
                  src={profile?.avatar_url}
                  size="sm"
                />
                {!compacto && (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-fg">
                        {profile?.full_name}
                      </span>
                      <span className="block truncate text-xs text-fg-faint">
                        {[profile?.role ? ROLE_LABEL[profile.role] : null, empresa?.nombre]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    <Icon name="chevronUp" size={14} className="shrink-0 text-fg-faint" />
                  </>
                )}
              </>
            }
          >
            {(cerrarMenu) => <MenuPersona cerrar={cerrarMenu} />}
          </Desplegable>
        </div>
      </div>

      {etiqueta.nodo}
    </div>
  )
}
