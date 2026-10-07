import type { Capability } from '@core/auth/capabilities'
import type { IconName } from '@shared/components/ui/Icon'
import type { TagColor } from '@shared/utils/colores'

export interface NavItem {
  to: string
  label: string
  icon: IconName
  /** Color del modulo (icono del menu). Sin color = item de sistema, en gris. */
  color?: TagColor | 'accent'
  /** Permiso "modulos.*" que hace falta para ver la entrada (y la ruta, ver ModuloGuard). */
  capability?: Capability
}

/** Navegacion principal, en el orden del brief. */
export const navItems: NavItem[] = [
  { to: '/chat', label: 'Chat', icon: 'chat', color: 'accent' },
  {
    to: '/activities',
    label: 'Actividades',
    icon: 'list',
    color: 'blue',
    capability: 'modulos.actividades',
  },
  {
    to: '/minuta',
    label: 'Minuta',
    icon: 'clipboard',
    color: 'amber',
    capability: 'modulos.minuta',
  },
  {
    to: '/proyectos',
    label: 'Proyectos',
    icon: 'folder',
    color: 'violet',
    capability: 'modulos.proyectos',
  },
  {
    to: '/compromisos',
    label: 'Compromisos',
    icon: 'checkCircle',
    color: 'green',
    capability: 'modulos.compromisos',
  },
  { to: '/errors', label: 'Errores', icon: 'bug', color: 'red', capability: 'modulos.errores' },
  {
    to: '/ingestas',
    label: 'Ingestas',
    icon: 'database',
    color: 'pink',
    capability: 'modulos.ingestas',
  },
  {
    to: '/gantt',
    label: 'Planificación',
    icon: 'calendar',
    color: 'orange',
    capability: 'modulos.planificacion',
  },
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: 'chart',
    capability: 'modulos.dashboard',
  },
  { to: '/notifications', label: 'Notificaciones', icon: 'bell' },
  { to: '/teams', label: 'Equipos', icon: 'users' },
  { to: '/guia', label: 'Guía', icon: 'guia' },
]

/**
 * Barra inferior del celular: los cuatro destinos de uso diario + "Mas" (abre el menu
 * completo). Antes eran seis con etiquetas recortadas ("Proy.", "Compr.").
 */
export const bottomNavItems: NavItem[] = [
  { to: '/chat', label: 'Chat', icon: 'chat', color: 'accent' },
  {
    to: '/activities',
    label: 'Actividades',
    icon: 'list',
    color: 'blue',
    capability: 'modulos.actividades',
  },
  {
    to: '/minuta',
    label: 'Minuta',
    icon: 'clipboard',
    color: 'amber',
    capability: 'modulos.minuta',
  },
  {
    to: '/compromisos',
    label: 'Compromisos',
    icon: 'checkCircle',
    color: 'green',
    capability: 'modulos.compromisos',
  },
]
