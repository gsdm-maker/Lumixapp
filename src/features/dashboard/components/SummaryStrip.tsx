import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cx } from '@shared/utils/cx'
import type { TrendDay } from '@features/dashboard/hooks/useDashboard'

/**
 * Los cuatro numeros del equipo en una franja delgada (idea 15). Antes eran cuatro tarjetas
 * con cifras grandes de cuatro colores: ocupaban la mitad de la pantalla y no decian que
 * hacer. El color aparece solo si el numero es una alerta (hay vencidas, hay criticos).
 */
export function SummaryStrip({
  pending,
  overdue,
  openErrors,
  criticalErrors,
  completedThisWeek,
  weeklyTrend,
  teamHours,
}: {
  pending: number
  overdue: number
  openErrors: number
  criticalErrors: number
  completedThisWeek: number
  weeklyTrend: TrendDay[]
  teamHours: number
}) {
  return (
    // gap-px sobre fondo de borde: las lineas entre celdas salen solas en 2 o 4 columnas.
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-px rounded-lg border border-border bg-border overflow-hidden">
      <Stat
        label="Pendientes"
        value={pending}
        to="/activities"
        sub={
          overdue > 0 ? (
            <span className="text-danger font-medium">{overdue} vencidas</span>
          ) : (
            'al día'
          )
        }
      />
      <Stat
        label="Errores abiertos"
        value={openErrors}
        to="/errors"
        sub={
          criticalErrors > 0 ? (
            <span className="text-danger font-medium">
              {criticalErrors} {criticalErrors === 1 ? 'alto o crítico' : 'altos o críticos'}
            </span>
          ) : (
            'ninguno grave'
          )
        }
      />
      <Stat
        label="Completadas esta semana"
        value={completedThisWeek}
        sub={<Sparkline data={weeklyTrend} />}
      />
      <Stat label="Horas equipo" value={`${teamHours} h`} sub="carga pendiente estimada" />
    </div>
  )
}

function Stat({
  label,
  value,
  sub,
  to,
}: {
  label: string
  value: ReactNode
  sub: ReactNode
  to?: string
}) {
  const body = (
    <>
      <p className="text-xs text-fg-muted">{label}</p>
      <p className="flex items-baseline gap-2 mt-0.5">
        <span className="text-2xl font-semibold text-fg tabular-nums">{value}</span>
        <span className="text-xs text-fg-faint">{sub}</span>
      </p>
    </>
  )
  return to ? (
    <Link to={to} className="block px-4 py-3 bg-panel hover:bg-surface transition-colors">
      {body}
    </Link>
  ) : (
    <div className="px-4 py-3 bg-panel">{body}</div>
  )
}

/** Completadas por dia en los ultimos 7 dias, en barras finas. */
function Sparkline({ data }: { data: TrendDay[] }) {
  const max = Math.max(1, ...data.map((d) => d.count))
  const resumen = data.map((d) => `${d.label} ${d.count}`).join(', ')
  return (
    <span
      role="img"
      aria-label={`Completadas por día: ${resumen}`}
      title={resumen}
      className="inline-flex items-end gap-[2px] h-4 align-middle"
    >
      {data.map((d, i) => (
        <i
          key={d.date}
          style={{ height: `${Math.max(12, (d.count / max) * 100)}%` }}
          className={cx(
            'w-[3px] rounded-[1px]',
            d.count === 0
              ? 'bg-border-strong'
              : i === data.length - 1
                ? 'bg-accent'
                : 'bg-fg-faint',
          )}
        />
      ))}
    </span>
  )
}
