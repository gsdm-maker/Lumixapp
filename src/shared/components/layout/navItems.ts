import type { Capability } from '@core/auth/capabilities'
import type { IconName } from '@shared/components/ui/Icon'

export interface NavItem {
  to: string
  label: string
  icon: IconName
  /** Permiso "modulos.*" que hace falta para ver la entrada (y la ruta, ver ModuloGuard). */
  capability?: Capability
}

/** Navegacion principal, en el orden del brief. */
export const navItems: NavItem[] = [
  { to: '/chat', label: 'Chat', icon: 'chat' },
  { to: '/activities', label: 'Actividades', icon: 'list', capability: 'modulos.actividades' },
  { to: '/minuta', label: 'Minuta', icon: 'clipboard', capability: 'modulos.minuta' },
  { to: '/proyectos', label: 'Proyectos', icon: 'folder', capability: 'modulos.proyectos' },
  {
    to: '/compromisos',
    label: 'Compromisos',
    icon: 'checkCircle',
    capability: 'modulos.compromisos',
  },
  { to: '/errors', label: 'Errores', icon: 'bug', capability: 'modulos.errores' },
  { to: '/ingestas', label: 'Ingestas', icon: 'database', capability: 'modulos.ingestas' },
  {
    to: '/gantt',
    label: 'Planificación',
    icon: 'calendar',
    capability: 'modulos.planificacion',
  },
  { to: '/dashboard', label: 'Dashboard', icon: 'chart', capability: 'modulos.dashboard' },
  { to: '/notifications', label: 'Notificaciones', icon: 'bell' },
  { to: '/teams', label: 'Equipos', icon: 'users' },
]

/**
 * Barra inferior del celular: los cuatro destinos de uso diario + "Mas" (abre el menu
 * completo). Antes eran seis con etiquetas recortadas ("Proy.", "Compr.").
 */
export const bottomNavItems: NavItem[] = [
  { to: '/chat', label: 'Chat', icon: 'chat' },
  { to: '/activities', label: 'Actividades', icon: 'list', capability: 'modulos.actividades' },
  { to: '/minuta', label: 'Minuta', icon: 'clipboard', capability: 'modulos.minuta' },
  {
    to: '/compromisos',
    label: 'Compromisos',
    icon: 'checkCircle',
    capability: 'modulos.compromisos',
  },
]
