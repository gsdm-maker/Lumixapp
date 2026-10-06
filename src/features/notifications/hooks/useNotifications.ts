import type { IconName } from '@shared/components/ui/Icon'

// Icono, etiqueta y tono por tipo de notificacion. El estado vive en NotificationContext:
// tener ademas un hook con su propia copia significaba dos canales realtime abiertos y
// un contador que no se enteraba de lo que hacia el otro.
//
// El tipo se lee por el icono (forma) y solo los avisos que piden atencion llevan color
// semantico; antes cada tipo tenia un color de Tailwind distinto que no decia nada.

interface NotificationKind {
  icon: IconName
  label: string
  tone: 'danger' | 'warning' | 'muted'
}

const KINDS: Record<string, NotificationKind> = {
  activity_blocked: { icon: 'lock', label: 'Actividad bloqueada', tone: 'danger' },
  critical_error: { icon: 'bug', label: 'Error crítico', tone: 'danger' },
  deadline_soon: { icon: 'clock', label: 'Fecha límite próxima', tone: 'warning' },
  missing_info: { icon: 'info', label: 'Falta información', tone: 'warning' },
  overload: { icon: 'alert', label: 'Sobrecarga', tone: 'warning' },
}

const DEFAULT_KIND: NotificationKind = { icon: 'bell', label: 'Notificación', tone: 'muted' }

export function getNotificationKind(type: string): NotificationKind {
  return KINDS[type] ?? DEFAULT_KIND
}

export function getNotificationLabel(type: string) {
  return getNotificationKind(type).label
}
