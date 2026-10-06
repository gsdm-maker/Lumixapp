// Planificacion en el celular: una persona a la vez, con los 7 dias como lista vertical. Los
// dias siguen siendo zonas donde soltar, asi que se puede mover una actividad de un dia a otro
// arrastrandola hacia arriba o abajo, sin scroll horizontal.

import { StatusLabel } from '@shared/components/ui/StatusLabel'
import { Select } from '@shared/components/ui/Input'
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

export function PersonaSemana({
  rows,
  memberId,
  onMember,
  onSelect,
}: {
  rows: GanttRow[]
  memberId: string
  onMember: (id: string) => void
  onSelect: (a: Activity) => void
}) {
  const row = rows.find((r) => r.member.id === memberId) ?? rows[0]
  if (!row) return null
  const hoy = hoyYMD()
  const estado = estadoCarga(row.loadPercentage)

  return (
    <div className="px-4 py-3 space-y-3">
      {rows.length > 1 && (
        <Select label="Persona" value={row.member.id} onChange={(e) => onMember(e.target.value)}>
          {rows.map((r) => (
            <option key={r.member.id} value={r.member.id}>
              {r.member.full_name}
            </option>
          ))}
        </Select>
      )}

      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className="font-medium text-fg tabular-nums">{fmtHoras(row.totalHours)}</span>
        <span className="text-fg-faint tabular-nums">{row.loadPercentage}% de la semana</span>
        <StatusLabel {...estado} />
      </p>

      <ol className="rounded-lg border border-border bg-panel divide-y divide-border">
        {row.days.map((cell, i) => {
          const horas = horasDia(cell.activities)
          const esHoy = cell.date === hoy
          return (
            <li key={cell.date}>
              <DiaDroppable date={cell.date} className="rounded-none px-3 py-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={cx(
                      'text-sm',
                      esHoy ? 'text-accent font-semibold' : i >= 5 ? 'text-fg-faint' : 'text-fg',
                    )}
                  >
                    {DIAS[i]} {cell.label.split(' ')[0]}
                    {esHoy && <span className="ml-1.5 text-xs font-normal">hoy</span>}
                  </span>
                  <span
                    className={cx(
                      'ml-auto rounded-md px-1.5 py-0.5 text-xs tabular-nums',
                      CALOR_CLASE[nivelCalor(horas)],
                    )}
                  >
                    {horas > 0 ? fmtHoras(horas) : '—'}
                  </span>
                </div>
                {cell.activities.map((a) => (
                  <ActividadChip key={a.id} activity={a} onSelect={onSelect} />
                ))}
              </DiaDroppable>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
