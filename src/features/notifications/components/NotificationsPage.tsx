import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotificationsContext } from '@core/notifications/NotificationContext'
import { getNotificationKind } from '@features/notifications/hooks/useNotifications'
import { PageHeader } from '@shared/components/ui/PageHeader'
import { Button } from '@shared/components/ui/Button'
import { Icon } from '@shared/components/ui/Icon'
import { EmptyState } from '@shared/components/ui/EmptyState'
import { SkeletonRows } from '@shared/components/ui/Skeleton'
import { SectionLabel } from '@shared/components/ui/Indicators'
import { cx } from '@shared/utils/cx'
import type { AppNotification } from '@shared/types'

interface Destination {
  to: string
  state?: { activityId: string }
  label: string
}

// A donde lleva una notificacion segun lo que trae en metadata. Cuando hay activity_id
// se manda tambien por el state de la ruta: Actividades abre esa actividad en particular,
// en vez de dejar al usuario buscandola en el listado.
function destinationFor(metadata: Record<string, unknown>): Destination | null {
  if (typeof metadata?.activity_id === 'string')
    return {
      to: '/activities',
      state: { activityId: metadata.activity_id },
      label: 'Abrir actividad',
    }
  if (metadata?.error_id) return { to: '/errors', label: 'Ver errores' }
  if (metadata?.minuta) return { to: '/minuta', label: 'Ver minuta' }
  return null
}

function relativeTime(iso: string): string {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diffMin < 1) return 'ahora'
  if (diffMin < 60) return `hace ${diffMin} min`
  const diffHrs = Math.floor(diffMin / 60)
  if (diffHrs < 24) return `hace ${diffHrs} h`
  return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

// Agrupa por dia local: "Hoy", "Ayer" y despues la fecha. La lista llega ordenada de la mas
// nueva a la mas vieja, asi que basta con cortar cuando cambia el dia.
function groupByDay(list: AppNotification[]): { label: string; items: AppNotification[] }[] {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const groups: { key: string; label: string; items: AppNotification[] }[] = []
  for (const n of list) {
    const d = new Date(n.created_at)
    d.setHours(0, 0, 0, 0)
    const key = d.toDateString()
    const dias = Math.round((hoy.getTime() - d.getTime()) / 86400000)
    let g = groups.find((x) => x.key === key)
    if (!g) {
      const label =
        dias === 0
          ? 'Hoy'
          : dias === 1
            ? 'Ayer'
            : d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'short' })
      g = { key, label, items: [] }
      groups.push(g)
    }
    g.items.push(n)
  }
  return groups
}

const TONE: Record<'danger' | 'warning' | 'muted', string> = {
  danger: 'text-danger',
  warning: 'text-warning',
  muted: 'text-fg-faint',
}

export function NotificationsPage() {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } =
    useNotificationsContext()
  const navigate = useNavigate()
  const groups = useMemo(() => groupByDay(notifications), [notifications])

  // Abrir la marca leida (con lo que sale de la lista) y lleva a lo que referencia.
  const open = (notif: AppNotification) => {
    void markAsRead(notif.id)
    const dest = destinationFor(notif.metadata)
    if (dest) navigate(dest.to, dest.state ? { state: dest.state } : undefined)
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Notificaciones"
        meta={unreadCount > 0 ? `${unreadCount} nuevas` : undefined}
        actions={
          unreadCount > 0 && (
            <Button variant="ghost" size="sm" icon="check" onClick={markAllAsRead}>
              Marcar todas leídas
            </Button>
          )
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-3 sm:px-5 py-4">
          {loading ? (
            <SkeletonRows rows={5} />
          ) : notifications.length === 0 ? (
            <EmptyState
              icon="checkCircle"
              title="Todo al día"
              description="No tienes notificaciones pendientes."
            />
          ) : (
            <div className="space-y-5">
              {groups.map((g) => (
                <section key={g.label} aria-label={g.label} className="space-y-1.5">
                  <SectionLabel>{g.label}</SectionLabel>
                  <ul className="lamina divide-y divide-border">
                    {g.items.map((n) => (
                      <NotificationRow
                        key={n.id}
                        notif={n}
                        onOpen={() => open(n)}
                        onRead={() => void markAsRead(n.id)}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function NotificationRow({
  notif,
  onOpen,
  onRead,
}: {
  notif: AppNotification
  onOpen: () => void
  onRead: () => void
}) {
  const kind = getNotificationKind(notif.type)
  const dest = destinationFor(notif.metadata)
  return (
    <li className="flex items-start gap-3 px-3 py-2.5 hover:bg-surface transition-colors">
      <Icon name={kind.icon} size={16} className={cx('mt-0.5', TONE[kind.tone])} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <p className="flex-1 min-w-0 text-sm font-medium text-fg truncate">{notif.title}</p>
          <time
            dateTime={notif.created_at}
            title={new Date(notif.created_at).toLocaleString('es-CL')}
            className="shrink-0 text-xs text-fg-faint tabular-nums"
          >
            {relativeTime(notif.created_at)}
          </time>
          {/* Todas las de la lista estan sin leer (el contexto solo trae esas): el punto
              marca "nueva" y desaparece junto con la fila al leerla. */}
          <span aria-hidden="true" className="shrink-0 w-1.5 h-1.5 rounded-full bg-accent" />
        </div>
        <p className="text-xs text-fg-faint">{kind.label}</p>
        {notif.body && <p className="text-sm text-fg-muted mt-0.5 line-clamp-2">{notif.body}</p>}
        <div className="flex items-center gap-1 mt-1.5 -ml-2">
          {dest && (
            <Button variant="ghost" size="xs" icon="arrowRight" onClick={onOpen}>
              {dest.label}
            </Button>
          )}
          <Button variant="ghost" size="xs" icon="check" onClick={onRead}>
            Marcar leída
          </Button>
        </div>
      </div>
    </li>
  )
}
