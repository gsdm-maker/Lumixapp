import { useEffect, useState } from 'react'
import { EmptyState } from '@shared/components/ui/EmptyState'
import { LoadingState } from '@shared/components/ui/Spinner'
import { cx } from '@shared/utils/cx'
import { useAuth } from '@core/auth/hooks/useAuth'
import { aiDecisionsService } from '@infrastructure/supabase/ai-decisions.service'

const CATEGORY_LABELS: Record<string, string> = {
  actividad: 'Actividad',
  error: 'Error',
  ingesta: 'Ingesta',
  consulta: 'Consulta',
}

interface Row {
  category: string
  model: string
  total: number
  corrected: number
}

// "corrected" solo capta lo que el usuario corrigio por popout o editando en los 30 minutos
// siguientes (ver ai-decisions.service.ts). No es precision absoluta, es la unica señal real
// que hoy se graba: mejor esto que decidir a ciegas si el prompt de clasificacion necesita
// ajustarse.
function buildRows(
  decisions: { predicted_category: string | null; model: string | null; corrected: boolean }[],
): Row[] {
  const groups = new Map<string, Row>()
  for (const d of decisions) {
    const category = d.predicted_category ?? 'desconocida'
    const model = d.model ?? 'desconocido'
    const key = `${category}|${model}`
    const row = groups.get(key) ?? { category, model, total: 0, corrected: 0 }
    row.total++
    if (d.corrected) row.corrected++
    groups.set(key, row)
  }
  return [...groups.values()].sort((a, b) => b.total - a.total)
}

export function AiAccuracyPanel() {
  const { profile } = useAuth()
  const teamId = profile?.team_id ?? ''
  const [rows, setRows] = useState<Row[] | null>(null)

  useEffect(() => {
    if (!teamId) return
    let cancelled = false
    aiDecisionsService.getRecentDecisions(teamId, 30).then((data) => {
      if (!cancelled) setRows(buildRows(data))
    })
    return () => {
      cancelled = true
    }
  }, [teamId])

  if (rows === null) return <LoadingState />
  if (rows.length === 0) {
    return (
      <EmptyState
        icon="chart"
        title="Sin clasificaciones"
        description="No hay clasificaciones registradas en los últimos 30 días."
      />
    )
  }

  return (
    <section className="space-y-2">
      <p className="text-xs text-fg-faint max-w-2xl">
        Últimos 30 días. “Corregidas” = el usuario cambió la categoría o editó la actividad poco
        después de creada.
      </p>
      <div className="overflow-x-auto lamina">
        <table className="w-full text-sm">
          <thead className="bg-surface-soft">
            <tr className="text-xs text-fg-faint text-left border-b border-border">
              <th className="py-2 px-4 font-medium">Categoría</th>
              <th className="py-2 px-4 font-medium">Modelo</th>
              <th className="py-2 px-4 font-medium text-right">Total</th>
              <th className="py-2 px-4 font-medium text-right">Corregidas</th>
              <th className="py-2 px-4 font-medium text-right">% corrección</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const pct = r.total ? Math.round((r.corrected / r.total) * 100) : 0
              return (
                <tr key={`${r.category}-${r.model}`}>
                  <td className="py-2 px-4 text-fg">{CATEGORY_LABELS[r.category] ?? r.category}</td>
                  <td className="py-2 px-4 text-fg-muted">{r.model}</td>
                  <td className="py-2 px-4 text-right tabular-nums text-fg-body">{r.total}</td>
                  <td className="py-2 px-4 text-right tabular-nums text-fg-body">{r.corrected}</td>
                  {/* Color solo cuando la tasa es una alerta: 20% o mas es mucho corregir. */}
                  <td
                    className={cx(
                      'py-2 px-4 text-right tabular-nums font-medium',
                      pct >= 20 ? 'text-danger' : pct >= 8 ? 'text-warning' : 'text-fg',
                    )}
                  >
                    {pct}%
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
