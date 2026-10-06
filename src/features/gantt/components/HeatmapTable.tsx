// Planificacion en escritorio: mapa de calor persona x dia (idea 14 de la propuesta UI/UX).
//
// Primero se ve DONDE esta la carga (horas por celda, con tono que sube de acento a ambar y
// rojo) y recien al tocar una celda aparecen las actividades de esa persona, en una fila que se
// abre debajo con las mismas columnas de dias: ahi se arrastran a otro dia. Antes cada celda
// tenia chips de 9px y la tabla forzaba scroll horizontal.

import { Fragment } from 'react'
import { StatusLabel } from '@shared/components/ui/StatusLabel'
import { IconButton } from '@shared/components/ui/Button'
import { cx } from '@shared/utils/cx'
import type { Activity } from '@shared/types'
import type { GanttRow } from '@features/gantt/hooks/useGantt'
import {
  CALOR_CLASE,
  DIAS,
  estadoCarga,
  fmtHoras,
  horasDia,
  hoyYMD,
  nivelCalor,
} from '@features/gantt/utils/carga'
import { ActividadChip, DiaDroppable } from './ActividadChip'

export interface CeldaAbierta {
  memberId: string
  date: string
}

export function HeatmapTable({
  rows,
  days,
  abierta,
  onAbrir,
  onSelect,
}: {
  rows: GanttRow[]
  days: { date: string; label: string }[]
  abierta: CeldaAbierta | null
  onAbrir: (c: CeldaAbierta | null) => void
  onSelect: (a: Activity) => void
}) {
  const hoy = hoyYMD()

  return (
    <table className="w-full table-fixed border-collapse text-sm">
      <thead className="sticky top-0 z-10 bg-panel">
        <tr className="border-b border-border">
          <th className="w-44 py-2 pl-5 pr-3 text-left text-2xs font-semibold uppercase tracking-wide text-fg-faint">
            Persona
          </th>
          {days.map((d, i) => {
            const esHoy = d.date === hoy
            return (
              <th
                key={d.date}
                className={cx(
                  'py-1.5 px-1 text-center font-normal',
                  esHoy ? 'text-accent' : i >= 5 ? 'text-fg-faint' : 'text-fg-muted',
                )}
                aria-current={esHoy ? 'date' : undefined}
              >
                <span className="block text-2xs uppercase tracking-wide">{DIAS[i]}</span>
                <span className={cx('block text-xs', esHoy && 'font-semibold')}>
                  {d.label.split(' ')[0]}
                </span>
              </th>
            )
          })}
          <th className="w-52 py-2 pl-3 pr-5 text-left text-2xs font-semibold uppercase tracking-wide text-fg-faint">
            Semana
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const estado = estadoCarga(row.loadPercentage)
          const abiertaAca = abierta?.memberId === row.member.id
          return (
            <Fragment key={row.member.id}>
              <tr className={cx('border-b border-border', abiertaAca && 'bg-surface-soft')}>
                <td className="py-1.5 pl-5 pr-3">
                  <span className="block truncate font-medium text-fg">{row.member.full_name}</span>
                </td>
                {row.days.map((cell, j) => {
                  const horas = horasDia(cell.activities)
                  const nivel = nivelCalor(horas)
                  const seleccionada = abiertaAca && abierta?.date === cell.date
                  return (
                    <td key={cell.date} className="p-0.5">
                      <button
                        type="button"
                        onClick={() =>
                          onAbrir(
                            seleccionada ? null : { memberId: row.member.id, date: cell.date },
                          )
                        }
                        aria-expanded={seleccionada}
                        aria-label={`${row.member.full_name}, ${DIAS[j]} ${cell.label}: ${fmtHoras(horas)}, ${cell.count} ${cell.count === 1 ? 'actividad' : 'actividades'}`}
                        className={cx(
                          'w-full h-9 rounded-md text-center text-xs tabular-nums transition-shadow',
                          CALOR_CLASE[nivel],
                          seleccionada
                            ? 'ring-2 ring-inset ring-accent'
                            : 'hover:ring-1 hover:ring-inset hover:ring-border-strong',
                        )}
                      >
                        {horas > 0
                          ? horas.toLocaleString('es-CL', { maximumFractionDigits: 1 })
                          : '—'}
                      </button>
                    </td>
                  )
                })}
                <td className="py-1.5 pl-3 pr-5">
                  <span className="flex items-center gap-2 text-xs">
                    <span className="tabular-nums text-fg font-medium">
                      {fmtHoras(row.totalHours)}
                    </span>
                    <span className="tabular-nums text-fg-faint">{row.loadPercentage}%</span>
                    <StatusLabel {...estado} />
                  </span>
                </td>
              </tr>

              {abiertaAca && abierta && (
                <tr className="border-b border-border bg-surface-soft">
                  <td className="py-2 pl-5 pr-3 align-top">
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-xs text-fg-faint">
                        {plural(row.totalActivities)}. Arrastra una a otro día para moverla.
                      </span>
                      <IconButton
                        icon="x"
                        size="xs"
                        label="Cerrar actividades"
                        onClick={() => onAbrir(null)}
                        className="-mt-1 -mr-1"
                      />
                    </span>
                  </td>
                  {row.days.map((cell) => (
                    <td key={cell.date} className="p-0.5 align-top">
                      <DiaDroppable
                        date={cell.date}
                        className={cx(
                          'min-h-16 p-1 space-y-1',
                          cell.date === abierta.date && 'bg-panel ring-1 ring-inset ring-border',
                        )}
                      >
                        {cell.activities.map((a) => (
                          <ActividadChip key={a.id} activity={a} onSelect={onSelect} />
                        ))}
                      </DiaDroppable>
                    </td>
                  ))}
                  <td />
                </tr>
              )}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}

const plural = (n: number) => `${n} ${n === 1 ? 'actividad' : 'actividades'} esta semana`
