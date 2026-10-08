import { useCapabilities } from '@core/auth/hooks/useCapabilities'
import { TAG } from '@shared/utils/colores'
import { navItems, type NavItem } from './navItems'

// Equipos y la Guia viven en el menu de la persona; Notificaciones, en su campana.
const EN_MENU_PERSONA = ['/notifications', '/teams', '/guia']

/**
 * Modulos del menu de escritorio (arriba o lateral): los que la persona puede ver.
 * Administracion no va aca: es una consola aparte (menu de la persona o al iniciar sesion).
 */
export function useModulos(): NavItem[] {
  const { can } = useCapabilities()
  return navItems.filter(
    (n) => (!n.capability || can(n.capability)) && !EN_MENU_PERSONA.includes(n.to),
  )
}

/** Color del icono de un modulo (como el menu de Todoist); los de sistema, en gris. */
export const tonoIcono = (n: NavItem) =>
  n.color === 'accent' ? 'text-accent' : n.color ? TAG[n.color].text : 'text-fg-faint'
