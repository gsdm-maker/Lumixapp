import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon, type IconName } from '@shared/components/ui/Icon'
import { fechaRelativa } from '@shared/utils/date'
import { cx } from '@shared/utils/cx'
import { Sparkline } from '@features/dashboard/components/Graficos'

type Tono = 'good' | 'bad' | 'neutral'

const TONO: Record<Tono, string> = {
  good: 'bg-success-soft text-success',
  bad: 'bg-danger-soft text-danger',
  neutral: 'bg-surface text-fg-muted',
}

/**
 * Cuanto cambio contra el periodo anterior. La flecha dice hacia donde se movio el numero y el
 * color si eso es bueno: menos vencidas es verde aunque la flecha baje.
 */
function Delta({ diff, tono, contra }: { diff: number; tono: Tono; contra: string }) {
  return (
    <span
      title={`Contra ${contra}`}
      className={cx(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 text-xs font-medium tabular-nums',
        TONO[tono],
      )}
    >
      {diff !== 0 && (
        <Icon name={diff > 0 ? 'trendUp' : 'trendDown'} size={12} strokeWidth={2.25} />
      )}
      {diff === 0 ? 'igual' : Math.abs(diff)}
      <span className="sr-only">
        {diff > 0 ? 'más' : diff < 0 ? 'menos' : ''} que {contra}
      </span>
    </span>
  )
}

/** Tarjeta de un indicador: nombre con icono de color, numero grande, cambio y detalle. */
function Kpi({
  icon,
  color,
  label,
  valor,
  extra,
  pie,
  to,
}: {
  icon: IconName
  color: string
  label: string
  valor: ReactNode
  extra?: ReactNode
  pie: ReactNode
  to?: string
}) {
  const cuerpo = (
    <>
      <span className="flex items-center gap-1.5 text-xs font-medium text-fg-muted">
        <Icon name={icon} size={15} className={color} />
        {label}
      </span>
      <span className="flex items-baseline gap-2">
        <span className="text-[28px] leading-none font-semibold tracking-tight tabular-nums">
          {valor}
        </span>
        {extra}
      </span>
      {pie}
    </>
  )
  const clase = 'grid gap-2 rounded-xl border border-border bg-panel p-4 shadow-xs min-w-0'
  return to ? (
    <Link to={to} className={cx(clase, 'transition-colors hover:border-border-strong')}>
      {cuerpo}
    </Link>
  ) : (
    <div className={clase}>{cuerpo}</div>
  )
}

function Pie({ texto, serie, color }: { texto: ReactNode; serie?: number[]; color?: string }) {
  return (
    <span className="flex items-end justify-between gap-3 text-xs text-fg-muted">
      <span className="min-w-0">{texto}</span>
      {serie && serie.length > 1 && <Sparkline serie={serie} className={color} />}
    </span>
  )
}

interface Serie {
  valor: number
  diff: number
  tono: Tono
  serie: number[]
}

export interface KpisProps {
  pendientes: Serie & { enProceso: number; bloqueadas: number }
  vencidas: Serie & { masAntigua: string | null }
  completadas: Serie & { anterior: number }
  compromisos: { porcentaje: number | null; cumplidos: number; total: number; meta: number }
  /** "la semana anterior", "las 4 semanas anteriores"... */
  contra: string
  /** "esta semana", "en 4 semanas"... */
  enPeriodo: string
}

/** Los cuatro numeros del equipo, cada uno con su tendencia. */
export function Kpis({
  pendientes,
  vencidas,
  completadas,
  compromisos,
  contra,
  enPeriodo,
}: KpisProps) {
  const pct = compromisos.porcentaje
  const tonoMeta =
    pct === null ? 'neutral' : pct >= compromisos.meta ? 'good' : pct >= 60 ? 'warn' : 'bad'
  return (
    <div className="grid grid-cols-1 min-[520px]:grid-cols-2 lg:grid-cols-4 gap-3.5">
      <Kpi
        icon="list"
        color="text-tag-blue"
        label="Pendientes"
        to="/activities"
        valor={pendientes.valor}
        extra={<Delta diff={pendientes.diff} tono={pendientes.tono} contra={contra} />}
        pie={
          <Pie
            texto={`${pendientes.enProceso} en proceso · ${pendientes.bloqueadas} bloqueadas`}
            serie={pendientes.serie}
            color="text-tag-blue"
          />
        }
      />
      <Kpi
        icon="alarm"
        color="text-danger"
        label="Vencidas"
        valor={
          <span className={vencidas.valor > 0 ? 'text-danger' : undefined}>{vencidas.valor}</span>
        }
        extra={<Delta diff={vencidas.diff} tono={vencidas.tono} contra={contra} />}
        pie={
          <Pie
            texto={
              vencidas.masAntigua
                ? `La más antigua: ${fechaRelativa(vencidas.masAntigua).text}`
                : 'Nada vencido'
            }
            serie={vencidas.serie}
            color="text-danger"
          />
        }
      />
      <Kpi
        icon="checkCircle"
        color="text-success"
        label="Completadas"
        valor={completadas.valor}
        extra={<Delta diff={completadas.diff} tono={completadas.tono} contra={contra} />}
        pie={
          <Pie
            texto={`${enPeriodo} · ${completadas.anterior} ${contra}`}
            serie={completadas.serie}
            color="text-success"
          />
        }
      />
      <Kpi
        icon="handshake"
        color="text-tag-violet"
        label="Compromisos"
        to="/compromisos"
        valor={pct === null ? '—' : `${pct}%`}
        extra={
          <span
            className={cx(
              'rounded-full px-1.5 text-xs font-medium',
              tonoMeta === 'good' && 'bg-success-soft text-success',
              tonoMeta === 'warn' && 'bg-warning-soft text-warning',
              tonoMeta === 'bad' && 'bg-danger-soft text-danger',
              tonoMeta === 'neutral' && 'bg-surface text-fg-muted',
            )}
          >
            meta {compromisos.meta}%
          </span>
        }
        pie={
          <span className="grid gap-2">
            <span
              role="img"
              aria-label={`${pct ?? 0}% contra la meta de ${compromisos.meta}%`}
              className="relative h-1.5 rounded-full bg-surface"
            >
              <i
                className={cx(
                  'block h-full rounded-full',
                  tonoMeta === 'good'
                    ? 'bg-success'
                    : tonoMeta === 'bad'
                      ? 'bg-danger'
                      : 'bg-warning',
                )}
                style={{ width: `${pct ?? 0}%` }}
              />
              <i
                aria-hidden="true"
                className="absolute -top-[3px] -bottom-[3px] w-0.5 rounded-sm bg-fg"
                style={{ left: `${compromisos.meta}%` }}
              />
            </span>
            <span className="text-xs text-fg-muted">
              {compromisos.total
                ? `${compromisos.cumplidos} de ${compromisos.total} cumplidos ${enPeriodo}`
                : `Sin compromisos ${enPeriodo}`}
            </span>
          </span>
        }
      />
    </div>
  )
}
