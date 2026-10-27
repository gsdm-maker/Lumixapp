import { NavLink } from 'react-router-dom'
import { Icon } from '@shared/components/ui/Icon'
import { LumixIcon } from '@shared/components/ui/LumixIcon'
import { cx } from '@shared/utils/cx'
import { tonoIcono, useModulos } from './useModulos'
import { SelectorEquipo } from './SelectorEquipo'
import { AccionesSuperiores } from './AccionesSuperiores'

/**
 * Menu superior del escritorio (rediseno Orbita, la posicion por defecto): marca con el nucleo
 * de Lumix, los modulos en una barra flotante de vidrio, y a la derecha buscar (Ctrl K), tema,
 * notificaciones y el menu de la persona. La persona puede pasarlo a un costado (MenuLateral).
 * En el celular manda el menu inferior (BottomNav) y el lateral (Sidebar).
 */
export function TopBar() {
  const modulos = useModulos()

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
        // @container: los nombres se muestran segun el ancho REAL de la barra, no el de la
        // pantalla. Antes, entre 1280 y ~1700 px los 9 nombres no cabian y los ultimos quedaban
        // tapados bajo el boton de buscar.
        className="vidrio @container flex flex-1 min-w-0 items-center justify-between gap-0.5 rounded-full p-1"
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
                {/* Con poco ancho quedan los iconos (con su nombre en el tooltip); el modulo
                    activo siempre muestra su nombre, para saber donde estas. */}
                {isActive ? (
                  <span>{n.label}</span>
                ) : (
                  <>
                    <span className="hidden @5xl:inline">{n.label}</span>
                    <span className="@5xl:hidden sr-only">{n.label}</span>
                  </>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <AccionesSuperiores />
    </header>
  )
}
