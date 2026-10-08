import { NavLink } from 'react-router-dom'
import { useCapabilities } from '@core/auth/hooks/useCapabilities'
import { useNotificationsContext } from '@core/notifications/NotificationContext'
import { Icon } from '@shared/components/ui/Icon'
import { cx } from '@shared/utils/cx'
import { TAG } from '@shared/utils/colores'
import { bottomNavItems } from './navItems'

/**
 * Barra inferior del celular: 4 destinos + "Mas" (abre el menu completo).
 *
 * Se oculta sola mientras el teclado esta abierto (AppLayout marca data-teclado en <html>):
 * en el chat, una barra fija bajo el campo de texto empujaba el boton Enviar fuera de la
 * pantalla con el teclado abierto (bug real). Con el teclado cerrado, la barra se ve en todas
 * las pantallas, chat incluido.
 */
export function BottomNav({ onMore }: { onMore: () => void }) {
  const { can } = useCapabilities()
  const { unreadCount } = useNotificationsContext()
  const item = 'flex-1 flex flex-col items-center justify-center gap-1 pt-1.5 pb-1 text-2xs'

  return (
    <nav
      aria-label="Accesos rápidos"
      className="md:hidden shrink-0 flex items-stretch border-t border-border bg-panel [[data-teclado=abierto]_&]:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {bottomNavItems
        .filter((i) => !i.capability || can(i.capability))
        .map((i) => (
          <NavLink
            key={i.to}
            to={i.to}
            className={({ isActive }) =>
              cx(
                item,
                'relative',
                isActive
                  ? 'text-fg font-semibold before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:w-6 before:h-0.5 before:rounded-full before:bg-accent'
                  : 'text-fg-faint',
              )
            }
          >
            <Icon
              name={i.icon}
              size={20}
              className={
                i.color === 'accent' ? 'text-accent' : i.color ? TAG[i.color].text : undefined
              }
            />
            <span className="truncate max-w-full px-0.5">{i.label}</span>
          </NavLink>
        ))}
      <button
        type="button"
        onClick={onMore}
        aria-controls="menu-movil"
        aria-label={unreadCount > 0 ? `Más, ${unreadCount} notificaciones sin leer` : 'Más'}
        className={cx(item, 'relative text-fg-faint')}
      >
        <Icon name="menu" size={20} />
        <span>Más</span>
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute top-1 left-1/2 ml-2 w-2 h-2 rounded-full bg-danger"
          />
        )}
      </button>
    </nav>
  )
}
