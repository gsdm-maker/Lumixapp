import { useEffect, useRef, useState, type FocusEvent, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation } from 'react-router-dom'
import { Icon } from '@shared/components/ui/Icon'
import { LumixIcon } from '@shared/components/ui/LumixIcon'
import { useTheme } from '@core/theme/ThemeContext'
import { cx } from '@shared/utils/cx'
import { tonoIcono, useModulos } from './useModulos'
import { SelectorEquipo } from './SelectorEquipo'
import { usePanelLateral } from './panelLateral'

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

/**
 * Menu de modulos como barra vertical a un costado (eleccion de la persona, ver Perfil >
 * Apariencia). Compacto: solo iconos, con el nombre en una etiqueta al pasar el mouse; o con
 * los nombres a la vista. Solo navega: buscar, tema, notificaciones y la persona van arriba a la
 * derecha (AccionesSuperiores), para que la barra no quede apretada.
 *
 * En el chat lleva un boton flotante "Mi semana": al tocarlo la barra se ensancha, esconde los
 * modulos y muestra el panel de Lumix (lo dibuja el chat en `ranura`, ver panelLateral.ts).
 * "Volver al menu", Escape o cambiar de pagina devuelven los modulos.
 */
export function MenuLateral({
  lado,
  onRanura,
}: {
  lado: Lado
  onRanura: (el: HTMLElement | null) => void
}) {
  const { menuNombres } = useTheme()
  const modulos = useModulos()
  const { pathname } = useLocation()
  const semana = usePanelLateral()
  const conSemana = pathname.startsWith('/chat')
  const compacto = !menuNombres && !semana.abierto
  const etiqueta = useEtiqueta(lado, compacto)
  const volverRef = useRef<HTMLButtonElement>(null)
  const botonRef = useRef<HTMLButtonElement>(null)
  const estabaAbierto = useRef(false)

  // Al abrir, el foco va a "Volver al menu"; al cerrar, vuelve al boton flotante.
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
        'vidrio relative z-30 hidden md:flex shrink-0 flex-col gap-1 rounded-[28px] my-3 py-3 px-2',
        'transition-[width] duration-200 ease-out motion-reduce:transition-none',
        lado === 'derecha' ? 'order-last mr-3' : 'ml-3',
        semana.abierto ? 'w-[360px]' : compacto ? 'w-[64px] items-center' : 'w-[212px]',
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
            className="self-start inline-flex items-center gap-1.5 min-h-9 px-3 rounded-full text-sm font-semibold text-fg-muted hover:text-fg hover:bg-surface transition-colors"
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
          className={cx('flex flex-col gap-1 min-h-0 overflow-y-auto', compacto && 'items-center')}
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
              {({ isActive }) => (
                <>
                  <Icon name={n.icon} size={18} className={isActive ? undefined : tonoIcono(n)} />
                  {!compacto && <span className="truncate">{n.label}</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      )}

      {/* Boton flotante: solo donde hay un panel que mostrar (el chat). */}
      {conSemana && !semana.abierto && (
        <div className={cx('mt-auto pt-2', compacto ? 'flex justify-center' : 'px-1')}>
          <button
            ref={botonRef}
            type="button"
            onClick={semana.alternar}
            aria-expanded={false}
            aria-label={compacto ? 'Mi semana' : undefined}
            {...(compacto ? etiqueta.props('Mi semana') : {})}
            className={cx(
              'inline-flex items-center justify-center gap-2 rounded-full bg-fg text-shell shadow-lg font-semibold text-sm',
              'hover:opacity-90 active:scale-[0.98] transition-[opacity,transform]',
              compacto ? 'w-11 h-11' : 'w-full h-11 px-4',
            )}
          >
            <Icon name="sparkles" size={16} />
            {!compacto && 'Mi semana'}
          </button>
        </div>
      )}

      {etiqueta.nodo}
    </div>
  )
}
