import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { DueDate, PriorityBars } from '@shared/components/ui/Indicators'
import { cx } from '@shared/utils/cx'
import type { Activity } from '@shared/types'
import type {
  MemberWorkload,
  PriorityCount,
  StatusCount,
} from '@features/dashboard/hooks/useDashboard'

// Las preguntas de gestion del dashboard (idea 15). Cada panel responde UNA pregunta con
// una lista corta que lleva al item; nada de graficos decorativos.

/** Marco de cada pregunta: titulo en forma de pregunta, respuesta corta debajo. */
export function Question({
  title,
  aside,
  children,
}: {
  title: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-lg border border-border bg-panel flex flex-col min-w-0">
      <header className="flex items-baseline justify-between gap-2 px-4 pt-3 pb-2">
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        {aside && <span className="text-xs text-fg-faint">{aside}</span>}
      </header>
      <div className="px-4 pb-3 flex-1">{children}</div>
    </section>
  )
}

function Nada({ children }: { children: ReactNode }) {
  return <p className="text-sm text-fg-faint py-2">{children}</p>
}

/** Lista de actividades que abre cada una en Actividades (via state.activityId). */
export function ActivityList({
  items,
  memberNames,
  empty,
  showResponsible,
}: {
  items: Activity[]
  memberNames: Record<string, string>
  empty: string
  showResponsible: boolean
}) {
  if (items.length === 0) return <Nada>{empty}</Nada>
  return (
    <ul className="-mx-2">
      {items.map((a) => (
        <li key={a.id}>
          <Link
            to="/activities"
            state={{ activityId: a.id }}
            className="flex items-baseline gap-2 rounded-md px-2 py-1.5 hover:bg-surface"
          >
            <span className="flex-1 min-w-0 truncate text-sm text-fg">{a.title}</span>
            {showResponsible && memberNames[a.responsible_id] && (
              <span className="hidden sm:inline shrink-0 max-w-[9rem] truncate text-xs text-fg-muted">
                {memberNames[a.responsible_id].split(' ')[0]}
              </span>
            )}
            <DueDate date={a.due_date} className="shrink-0 text-xs" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

// Escala de carga semanal: 21 h es media jornada de la semana, 30 h ya es alta y 42 h es la
// semana completa. Mismos cortes que tenia la barra anterior.
const ESCALA = 42
const CORTES = [21, 30, 42]

function tonoCarga(horas: number): string {
  if (horas >= ESCALA) return 'bg-danger'
  if (horas >= 30) return 'bg-warning'
  return 'bg-fg-muted'
}

/** "¿Quien esta saturado?": horas pendientes por persona sobre la escala 0-21-30-42 h. */
export function Workload({ workloads }: { workloads: MemberWorkload[] }) {
  if (workloads.length === 0) return <Nada>Sin datos de carga.</Nada>
  const orden = [...workloads].sort((a, b) => b.totalHours - a.totalHours)
  return (
    <div>
      <ul className="space-y-2">
        {orden.map((m) => {
          const pct = Math.min(100, (m.totalHours / ESCALA) * 100)
          return (
            <li key={m.id} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3">
              <span className="truncate text-sm text-fg" title={m.name}>
                {m.name}
              </span>
              <div
                className="relative h-1.5 rounded-full bg-border"
                role="img"
                aria-label={`${m.name}: ${m.totalHours} horas de ${ESCALA}`}
              >
                <div
                  className={cx('absolute inset-y-0 left-0 rounded-full', tonoCarga(m.totalHours))}
                  style={{ width: `${pct}%` }}
                />
                {CORTES.slice(0, 2).map((c) => (
                  <i
                    key={c}
                    aria-hidden="true"
                    className="absolute -top-0.5 -bottom-0.5 w-px bg-border-strong"
                    style={{ left: `${(c / ESCALA) * 100}%` }}
                  />
                ))}
              </div>
              <span
                className={cx(
                  'text-xs tabular-nums whitespace-nowrap w-24 text-right',
                  m.totalHours >= ESCALA ? 'text-danger font-medium' : 'text-fg-muted',
                )}
              >
                {m.totalHours} h · {m.total} act.
              </span>
            </li>
          )
        })}
      </ul>
      {/* Escala bajo las barras, alineada con la columna de la barra. */}
      <div className="grid grid-cols-[7rem_1fr_auto] gap-3 mt-1.5" aria-hidden="true">
        <span />
        <div className="relative h-3 text-2xs text-fg-faint">
          <span className="absolute left-0">0 h</span>
          {CORTES.map((c) => (
            <span
              key={c}
              className="absolute -translate-x-1/2 last:-translate-x-full"
              style={{ left: `${(c / ESCALA) * 100}%` }}
            >
              {c} h
            </span>
          ))}
        </div>
        <span className="w-24" />
      </div>
    </div>
  )
}

const SEGMENTOS: { key: keyof StatusCount; label: string; color: string }[] = [
  { key: 'pendiente', label: 'Pendientes', color: 'bg-fg-faint' },
  { key: 'en_proceso', label: 'En proceso', color: 'bg-accent' },
  { key: 'esperando', label: 'Esperando', color: 'bg-warning' },
  { key: 'bloqueado', label: 'Bloqueadas', color: 'bg-blocked' },
  { key: 'completado', label: 'Completadas', color: 'bg-success' },
]

/**
 * Estado de actividades como una barra apilada horizontal. Reemplaza a la dona dibujada a
 * mano con colores hex fijos (que no cambiaban con el tema).
 */
export function StatusBar({ counts }: { counts: StatusCount }) {
  const total = SEGMENTOS.reduce((s, x) => s + counts[x.key], 0)
  if (total === 0) return <Nada>Sin actividades.</Nada>
  return (
    <div className="space-y-3">
      <div
        className="flex h-2.5 rounded-full overflow-hidden gap-px bg-panel"
        role="img"
        aria-label={SEGMENTOS.map((s) => `${s.label} ${counts[s.key]}`).join(', ')}
      >
        {SEGMENTOS.filter((s) => counts[s.key] > 0).map((s) => (
          <div
            key={s.key}
            className={s.color}
            style={{ width: `${(counts[s.key] / total) * 100}%` }}
            title={`${s.label}: ${counts[s.key]}`}
          />
        ))}
      </div>
      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
        {SEGMENTOS.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-xs">
            <span aria-hidden="true" className={cx('w-2 h-2 rounded-sm', s.color)} />
            <span className="text-fg-muted flex-1">{s.label}</span>
            <span className="text-fg tabular-nums font-medium">{counts[s.key]}</span>
            <span className="text-fg-faint tabular-nums w-8 text-right">
              {Math.round((counts[s.key] / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Resumen de prioridades de lo que sigue activo, como tabla chica. */
export function PriorityTable({ counts }: { counts: PriorityCount }) {
  const filas = [
    { p: 1, label: 'Alta', n: counts.alta },
    { p: 2, label: 'Media', n: counts.media },
    { p: 3, label: 'Baja', n: counts.baja },
  ]
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Actividades activas por prioridad</caption>
      <tbody className="divide-y divide-border">
        {filas.map((f) => (
          <tr key={f.p}>
            <td className="py-1.5 w-6">
              <PriorityBars priority={f.p} />
            </td>
            <td className="py-1.5 text-fg-muted">{f.label}</td>
            <td className="py-1.5 text-right tabular-nums font-medium text-fg">{f.n}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
