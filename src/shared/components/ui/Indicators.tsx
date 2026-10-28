import type { ReactNode } from 'react'
import { cx } from '@shared/utils/cx'
import { fechaRelativa, formatDateLocal, type DueTone } from '@shared/utils/date'
import { PRIORITY_LABEL } from '@shared/utils/estados'

// Indicadores chicos y repetidos en toda la app. Cada concepto tiene UN dibujo: antes la
// prioridad era barras, puntos, "P1" de color y botones de tres tamanos distintos.

// Color por prioridad, el mismo codigo que Todoist: alta roja, media naranja, baja azul.
const PRIO_BAR: Record<number, string> = { 1: 'bg-p1', 2: 'bg-p2', 3: 'bg-p3' }
const PRIO_ACTIVA: Record<number, string> = {
  1: 'bg-tag-red-soft text-p1',
  2: 'bg-tag-orange-soft text-p2',
  3: 'bg-tag-blue-soft text-p3',
}

/** Prioridad 1 (alta) a 3 (baja) como tres barras de altura creciente, en su color. */
export function PriorityBars({ priority, className }: { priority: number; className?: string }) {
  const llenas = priority === 1 ? 3 : priority === 2 ? 2 : 1
  return (
    <span
      role="img"
      aria-label={`Prioridad ${PRIORITY_LABEL[priority] ?? priority}`}
      title={`Prioridad ${PRIORITY_LABEL[priority] ?? priority}`}
      className={cx('inline-flex items-end gap-[2px] h-3 align-middle', className)}
    >
      {[5, 8, 12].map((h, i) => (
        <i
          key={h}
          style={{ height: h }}
          className={cx(
            'w-[3px] rounded-[1px]',
            i < llenas ? (PRIO_BAR[priority] ?? 'bg-fg-faint') : 'bg-border-strong',
          )}
        />
      ))}
    </span>
  )
}

/** Selector de prioridad: tres botones iguales en toda la app (antes w-6, w-7 y w-10). */
export function PriorityPicker({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange: (p: number) => void
  disabled?: boolean
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Prioridad"
      className="inline-flex rounded-md border border-border-strong overflow-hidden"
    >
      {[1, 2, 3].map((p, i) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={value === p}
          disabled={disabled}
          onClick={() => onChange(p)}
          className={cx(
            'inline-flex items-center gap-1.5 h-8 px-2.5 text-xs font-medium transition-colors disabled:opacity-50',
            i > 0 && 'border-l border-border-strong',
            value === p ? PRIO_ACTIVA[p] : 'bg-panel text-fg-muted hover:bg-surface',
          )}
        >
          <PriorityBars priority={p} />
          {PRIORITY_LABEL[p]}
        </button>
      ))}
    </div>
  )
}

// Fechas con color segun cercania, un significado por color: vencido rojo, hoy ambar (urgente
// sin alarmar, y no se confunde con el verde de "completado"), esta semana violeta. Manana va
// en tinta fuerte: el naranja ya significa "prioridad media". Lo lejano, en gris.
const DUE_TONE: Record<DueTone, string> = {
  late: 'text-danger font-medium',
  today: 'text-date-today font-medium',
  tomorrow: 'text-fg font-medium',
  soon: 'text-date-week',
  normal: 'text-fg-muted',
}

/** Fecha de entrega en palabras ("hoy", "hace 3 d") con la fecha exacta en el tooltip. */
export function DueDate({
  date,
  done = false,
  className,
}: {
  date: string
  /** Si ya esta cerrada, la fecha no alarma. */
  done?: boolean
  className?: string
}) {
  const { text, tone } = fechaRelativa(date)
  return (
    <time
      dateTime={date.split('T')[0]}
      title={formatDateLocal(date)}
      className={cx('whitespace-nowrap', done ? 'text-fg-faint' : DUE_TONE[tone], className)}
    >
      {text}
    </time>
  )
}

/** Barra de avance fina. El color solo cambia si `tone` lo pide. */
export function ProgressBar({
  value,
  tone = 'default',
  className,
  label,
}: {
  /** 0 a 100 */
  value: number
  tone?: 'default' | 'accent' | 'success' | 'warning' | 'danger'
  className?: string
  label?: string
}) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cx('h-1 rounded-full bg-border overflow-hidden', className)}
    >
      <div
        style={{ width: `${v}%` }}
        className={cx(
          'h-full rounded-full transition-[width] duration-300',
          tone === 'default' && 'bg-fg-muted',
          tone === 'accent' && 'bg-accent',
          tone === 'success' && 'bg-success',
          tone === 'warning' && 'bg-warning',
          tone === 'danger' && 'bg-danger',
        )}
      />
    </div>
  )
}

/** Tecla de atajo. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex items-center h-[18px] px-1 rounded-sm border border-border-strong border-b-2 bg-panel font-mono text-2xs text-fg-faint">
      {children}
    </kbd>
  )
}

/** Titulo chico de un bloque dentro de un panel o pagina ("SUBTAREAS", "DETALLE"). */
export function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-2xs font-semibold text-fg-faint">{children}</h3>
      {action}
    </div>
  )
}
