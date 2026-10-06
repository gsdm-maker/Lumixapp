import { useState } from 'react'
import { PageHeader } from '@shared/components/ui/PageHeader'
import { SegmentedControl } from '@shared/components/ui/SegmentedControl'
import { Button } from '@shared/components/ui/Button'
import { EmptyState } from '@shared/components/ui/EmptyState'
import { Skeleton } from '@shared/components/ui/Skeleton'
import { useDashboard } from '@features/dashboard/hooks/useDashboard'
import { useCapabilities } from '@core/auth/hooks/useCapabilities'
import { AiAccuracyPanel } from '@features/dashboard/components/AiAccuracyPanel'
import { SummaryStrip } from '@features/dashboard/components/SummaryStrip'
import {
  ActivityList,
  PriorityTable,
  Question,
  StatusBar,
  Workload,
} from '@features/dashboard/components/QuestionPanels'

type Vista = 'equipo' | 'ia'

/** Semana ISO del ano: es como el equipo nombra la semana en la reunion ("semana 41"). */
function semanaISO(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dia = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dia)
  const inicio = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil(((t.getTime() - inicio.getTime()) / 86400000 + 1) / 7)
}

/**
 * Dashboard que responde preguntas (idea 15): una franja con los cuatro numeros y, debajo,
 * cuatro preguntas de gestion respondidas con nombres y fechas que llevan al item.
 */
export function DashboardPage() {
  const { isGlobalAdmin } = useCapabilities()
  const [vista, setVista] = useState<Vista>('equipo')
  const d = useDashboard()

  const teamHours = d.memberWorkloads.reduce((s, w) => s + w.totalHours, 0)
  const meta = [d.teamName, `semana ${semanaISO(new Date())}`].filter(Boolean).join(' · ')
  // Un colaborador ve solo lo suyo: el nombre del responsable en cada fila sobra.
  const showResponsible = !d.isColaborador

  return (
    <div className="flex flex-col h-full bg-shell">
      <PageHeader
        title="Resumen del equipo"
        meta={meta}
        actions={
          // Precision de la IA: solo el admin global, es una senal de operacion del producto.
          isGlobalAdmin && (
            <SegmentedControl
              label="Sección del dashboard"
              value={vista}
              onChange={setVista}
              options={[
                { value: 'equipo', label: 'Equipo' },
                { value: 'ia', label: 'Precisión de la IA' },
              ]}
            />
          )
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-3 sm:px-5 py-4 space-y-4">
          {isGlobalAdmin && vista === 'ia' ? (
            <AiAccuracyPanel />
          ) : d.loading ? (
            <div className="space-y-4" aria-busy="true" aria-label="Cargando">
              <Skeleton className="h-[70px]" />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-44" />
                ))}
              </div>
            </div>
          ) : d.error ? (
            <EmptyState
              icon="alert"
              title="No se pudo cargar el resumen"
              description="Revisa tu conexión e inténtalo de nuevo."
              action={
                <Button variant="secondary" size="sm" icon="refresh" onClick={d.reload}>
                  Reintentar
                </Button>
              }
            />
          ) : (
            <>
              <SummaryStrip
                pending={d.pendingActivities}
                overdue={d.overdue}
                openErrors={d.openErrors}
                criticalErrors={d.criticalErrors}
                completedThisWeek={d.completedThisWeek}
                weeklyTrend={d.weeklyTrend}
                teamHours={teamHours}
              />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Question
                  title="¿Qué está atrasado?"
                  aside={d.overdue > 5 ? `5 de ${d.overdue}` : undefined}
                >
                  <ActivityList
                    items={d.overdueList}
                    memberNames={d.memberNames}
                    showResponsible={showResponsible}
                    empty="Nada atrasado."
                  />
                </Question>

                <Question title="¿Quién está saturado?" aside="horas pendientes">
                  <Workload workloads={d.memberWorkloads} />
                </Question>

                <Question title="Estado de actividades">
                  <StatusBar counts={d.statusCounts} />
                  <div className="mt-4 pt-3 border-t border-border">
                    <p className="text-xs text-fg-faint mb-1">Activas por prioridad</p>
                    <PriorityTable counts={d.priorityCounts} />
                  </div>
                </Question>

                <Question title="¿Qué vence pronto?" aside="próximos 3 días">
                  <ActivityList
                    items={d.upcomingDeadlines}
                    memberNames={d.memberNames}
                    showResponsible={showResponsible}
                    empty="Nada vence en los próximos 3 días."
                  />
                </Question>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
