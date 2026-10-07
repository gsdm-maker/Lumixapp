import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '@shared/components/ui/Avatar'
import { Icon } from '@shared/components/ui/Icon'
import { DueDate } from '@shared/components/ui/Indicators'
import { ProjectDot } from '@shared/components/ui/ProjectDot'
import { nombreCorto } from '@shared/utils/nombres'
import { cx } from '@shared/utils/cx'
import type { Activity, ErrorSeverity } from '@shared/types'
import type { Origenes, ProyectoFila } from '@features/dashboard/hooks/useDashboard'
import {
  CAPACIDAD_HORAS,
  type CargaPersona,
  type EdadErrores,
} from '@features/dashboard/utils/metricas'

/** Tarjeta de cada bloque: titulo, nota en gris y un enlace opcional a la vista completa. */
export function Panel({
  title,
  nota,
  accion,
  children,
  className,
}: {
  title: string
  nota?: ReactNode
  accion?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cx(
        'flex min-w-0 flex-col rounded-xl border border-border bg-panel shadow-xs',
        className,
      )}
    >
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 pt-3.5">
        <h2 className="text-sm font-semibold tracking-tight text-fg">{title}</h2>
        {nota && <span className="text-xs text-fg-faint">{nota}</span>}
        {accion && <span className="ml-auto">{accion}</span>}
      </header>
      <div className="flex-1 px-4 pt-3 pb-4">{children}</div>
    </section>
  )
}

export function VerTodo({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="text-xs font-medium text-accent hover:underline">
      {children}
    </Link>
  )
}

/** Leyenda de colores de un grafico. */
export function Leyenda({ items }: { items: { label: string; className: string }[] }) {
  return (
    <span className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-fg-muted">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <i
            aria-hidden="true"
            className={cx('inline-block h-2.5 w-2.5 rounded-[3px]', i.className)}
          />
          {i.label}
        </span>
      ))}
    </span>
  )
}

function Nada({ children }: { children: ReactNode }) {
  return <p className="py-2 text-sm text-fg-faint">{children}</p>
}

const LEYENDA_CARGA = [
  { label: 'En proceso', className: 'bg-tag-blue' },
  { label: 'Pendiente', className: 'bg-tag-blue-soft ring-1 ring-inset ring-tag-blue' },
  { label: 'Detenida', className: 'bg-blocked' },
]

export function LeyendaCarga() {
  return <Leyenda items={LEYENDA_CARGA} />
}

/**
 * Horas abiertas por persona, apiladas por estado, contra la capacidad semanal (la raya). La
 * escala deja aire sobre la capacidad para que quien se pasa se vea pasado.
 */
export function CargaPanel({ carga }: { carga: CargaPersona[] }) {
  if (carga.length === 0) return <Nada>Sin personas en el equipo.</Nada>
  const escala = Math.max(CAPACIDAD_HORAS * 1.2, ...carga.map((c) => c.total))
  const pct = (h: number) => `${(h / escala) * 100}%`
  return (
    <ul className="grid gap-3">
      {carga.map((c) => {
        const pasada = c.total > CAPACIDAD_HORAS
        return (
          <li
            key={c.id}
            className="grid grid-cols-[minmax(0,8rem)_1fr_3.5rem] items-center gap-3 text-sm"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Avatar name={c.nombre} src={c.avatar} size="xs" />
              <span className="truncate" title={c.nombre}>
                {nombreCorto(c.nombre)}
              </span>
            </span>
            <span
              role="img"
              aria-label={`${c.nombre}: ${c.enProceso} h en proceso, ${c.pendiente} h pendientes, ${c.detenida} h detenidas, de ${CAPACIDAD_HORAS} h`}
              className="relative flex h-2.5 rounded-full bg-surface"
            >
              <span
                className="flex h-full overflow-hidden rounded-full"
                style={{ width: pct(c.total) }}
              >
                <i
                  className="h-full bg-tag-blue"
                  style={{ width: `${(c.enProceso / (c.total || 1)) * 100}%` }}
                />
                <i
                  className="h-full bg-tag-blue-soft"
                  style={{ width: `${(c.pendiente / (c.total || 1)) * 100}%` }}
                />
                <i
                  className="h-full bg-blocked"
                  style={{ width: `${(c.detenida / (c.total || 1)) * 100}%` }}
                />
              </span>
              <i
                aria-hidden="true"
                className="absolute -top-[3px] -bottom-[3px] w-0.5 rounded-sm bg-fg opacity-55"
                style={{ left: pct(CAPACIDAD_HORAS) }}
              />
            </span>
            <span
              title={`${c.actividades} actividades abiertas`}
              className={cx(
                'text-right text-xs font-semibold tabular-nums',
                pasada ? 'text-danger' : 'text-fg',
              )}
            >
              {c.total} h
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/** Proyectos abiertos con su avance y la alerta mas urgente. */
export function ProyectosPanel({ proyectos }: { proyectos: ProyectoFila[] }) {
  if (proyectos.length === 0) return <Nada>No hay proyectos abiertos.</Nada>
  return (
    <ul className="-mx-2 grid">
      {proyectos.map((p) => {
        const { avance, alertas } = p.resumen
        const alerta =
          alertas.vencidas > 0
            ? {
                texto: `${alertas.vencidas} ${alertas.vencidas === 1 ? 'vencida' : 'vencidas'}`,
                clase: 'text-danger font-medium',
              }
            : alertas.hoy > 0
              ? { texto: `${alertas.hoy} vence hoy`, clase: 'text-date-today font-medium' }
              : alertas.bloqueadas > 0
                ? {
                    texto: `${alertas.bloqueadas} bloqueada${alertas.bloqueadas === 1 ? '' : 's'}`,
                    clase: 'text-blocked font-medium',
                  }
                : { texto: 'al día', clase: 'text-fg-faint' }
        return (
          <li key={p.id}>
            <Link
              to={`/proyectos/${p.id}`}
              className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-surface"
            >
              <span className="flex min-w-0 items-center gap-2 font-medium">
                <ProjectDot id={p.id} />
                <span className="truncate">{p.nombre}</span>
              </span>
              <span
                role="img"
                aria-label={avance === null ? 'Sin subtareas' : `Avance ${avance}%`}
                title={avance === null ? 'Sin subtareas' : `${avance}%`}
                className="h-1.5 overflow-hidden rounded-full bg-surface"
              >
                <i
                  className="block h-full rounded-full bg-fg"
                  style={{ width: `${avance ?? 0}%` }}
                />
              </span>
              <span className={cx('text-right text-xs', alerta.clase)}>{alerta.texto}</span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

const BANDERA = ['text-p1', 'text-p1', 'text-p2', 'text-p3']

/** Lista corta de actividades: cada fila abre la actividad en Actividades. */
export function ListaActividades({
  items,
  memberNames,
  origenes,
  mostrarResponsable,
  vacio,
}: {
  items: Activity[]
  memberNames: Record<string, string>
  origenes: Origenes
  mostrarResponsable: boolean
  vacio: string
}) {
  if (items.length === 0) return <Nada>{vacio}</Nada>
  return (
    <ul className="-mx-2 grid">
      {items.map((a) => {
        const meta = [
          mostrarResponsable &&
            memberNames[a.responsible_id] &&
            nombreCorto(memberNames[a.responsible_id]),
          origenes[a.id],
        ].filter(Boolean)
        return (
          <li key={a.id}>
            <Link
              to="/activities"
              state={{ activityId: a.id }}
              className="flex items-start gap-2.5 rounded-md px-2 py-2 hover:bg-surface"
            >
              <Icon
                name="flag"
                size={14}
                className={cx('mt-0.5', BANDERA[a.priority] ?? 'text-fg-faint')}
                aria-label={`Prioridad ${a.priority}`}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium leading-snug text-fg">
                  {a.title}
                </span>
                {meta.length > 0 && (
                  <span className="block truncate text-xs text-fg-muted">{meta.join(' · ')}</span>
                )}
              </span>
              <DueDate date={a.due_date} className="shrink-0 text-xs font-medium" />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

const SEVERIDAD: { key: ErrorSeverity; uno: string; varios: string; clase: string }[] = [
  { key: 'critica', uno: 'crítico', varios: 'críticos', clase: 'bg-danger-soft text-danger' },
  { key: 'alta', uno: 'alto', varios: 'altos', clase: 'bg-tag-orange-soft text-tag-orange' },
  { key: 'media', uno: 'medio', varios: 'medios', clase: 'bg-surface text-fg-muted' },
  { key: 'baja', uno: 'bajo', varios: 'bajos', clase: 'bg-surface text-fg-faint' },
]

/** Errores abiertos por antiguedad (lo viejo en rojo) y su severidad. */
export function ErroresPanel({ edad, total }: { edad: EdadErrores; total: number }) {
  if (total === 0) return <Nada>No hay errores abiertos.</Nada>
  const filas = [
    { label: '0 a 2 días', n: edad.recientes, clase: 'bg-tag-amber' },
    { label: '3 a 7 días', n: edad.semana, clase: 'bg-tag-orange' },
    { label: 'más de 7 días', n: edad.antiguos, clase: 'bg-danger' },
  ]
  return (
    <div>
      <ul className="grid gap-2.5">
        {filas.map((f) => (
          <li
            key={f.label}
            className="grid grid-cols-[6.5rem_1fr_1.5rem] items-center gap-2.5 text-xs text-fg-muted"
          >
            <span>{f.label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-surface">
              <i
                className={cx('block h-full rounded-full', f.clase)}
                style={{ width: `${(f.n / total) * 100}%` }}
              />
            </span>
            <span className="text-right font-semibold tabular-nums text-fg">{f.n}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3.5 flex flex-wrap gap-1.5">
        {SEVERIDAD.filter((s) => edad.porSeveridad[s.key] > 0).map((s) => {
          const n = edad.porSeveridad[s.key]
          return (
            <span
              key={s.key}
              className={cx('rounded-full px-2 py-0.5 text-xs font-medium', s.clase)}
            >
              {n} {n === 1 ? s.uno : s.varios}
            </span>
          )
        })}
      </div>
    </div>
  )
}
