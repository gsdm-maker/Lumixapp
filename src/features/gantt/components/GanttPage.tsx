// Planificacion semanal: carga de trabajo por persona y dia.
//
// Rediseno 2026 (idea 14): la vista por defecto es un mapa de calor (horas por celda). Tocar
// una celda abre las actividades de esa persona, que se arrastran a otro dia para
// reprogramarlas (mismo comportamiento de siempre: solo cambia la fecha de entrega). En el
// celular se ve una persona a la vez, con los dias en vertical.

import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { Button, IconButton } from '@shared/components/ui/Button'
import { PageHeader } from '@shared/components/ui/PageHeader'
import { EmptyState } from '@shared/components/ui/EmptyState'
import { SkeletonRows } from '@shared/components/ui/Skeleton'
import { useToast } from '@shared/components/ui/Toast'
import { cx } from '@shared/utils/cx'
import { useGantt } from '@features/gantt/hooks/useGantt'
import { useEsMovil } from '@shared/hooks/useEsMovil'
import { CALOR_CLASE, CAPACIDAD_DIA, HORAS_SEMANA, fmtHoras } from '@features/gantt/utils/carga'
import { activitiesService } from '@infrastructure/supabase/activities.service'
import { useAuth } from '@core/auth/hooks/useAuth'
import { useCapabilities } from '@core/auth/hooks/useCapabilities'
import type { Activity } from '@shared/types'
import { HeatmapTable, type CeldaAbierta } from './HeatmapTable'
import { PersonaSemana } from './PersonaSemana'
import { ActividadModal } from './ActividadModal'
import { ChipContenido } from './ActividadChip'

export function GanttPage() {
  const {
    rows,
    loading,
    error,
    days,
    weekLabel,
    prevWeek,
    nextWeek,
    currentWeek,
    weekOffset,
    reload,
  } = useGantt()
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)
  const [arrastrandoId, setArrastrandoId] = useState<string | null>(null)
  const [dropping, setDropping] = useState(false)
  const [abierta, setAbierta] = useState<CeldaAbierta | null>(null)
  const { profile } = useAuth()
  const [personaMovil, setPersonaMovil] = useState<string>(profile?.id ?? '')
  const { canEditAllActivities } = useCapabilities()
  const toast = useToast()
  const esMovil = useEsMovil()
  const canEdit = canEditAllActivities || selectedActivity?.responsible_id === profile?.id
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const todas = rows.flatMap((r) => r.days.flatMap((d) => d.activities))
  const arrastrandoActividad = todas.find((a) => a.id === arrastrandoId)

  const alSoltar = async (e: DragEndEvent) => {
    setArrastrandoId(null)
    const activityId = e.active.id as string
    const date = e.over?.id as string | undefined
    if (!date || dropping) return

    const activity = todas.find((a) => a.id === activityId)
    if (!activity) return

    const newDueDate = new Date(date)
    const oldDueDate = new Date(activity.due_date)
    if (newDueDate.toDateString() === oldDueDate.toDateString()) return

    setDropping(true)
    try {
      await activitiesService.update(activity.id, { due_date: newDueDate.toISOString() })
      reload()
    } catch {
      toast.error('No se pudo mover la actividad')
    } finally {
      setDropping(false)
    }
  }

  // Al recargar (despues de mover o editar) se mantiene la tabla visible: el esqueleto solo
  // aparece en la primera carga, para que la pantalla no parpadee con cada cambio.
  const primeraCarga = loading && rows.length === 0

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Planificación"
        meta="Horas por persona y día"
        actions={
          <>
            <IconButton icon="chevronLeft" label="Semana anterior" onClick={prevWeek} />
            <Button size="xs" variant="secondary" onClick={currentWeek} disabled={weekOffset === 0}>
              Hoy
            </Button>
            <IconButton icon="chevronRight" label="Semana siguiente" onClick={nextWeek} />
            <span className="ml-1 text-xs text-fg-muted tabular-nums whitespace-nowrap">
              {weekLabel}
            </span>
          </>
        }
      />

      <div
        className={cx(
          'flex-1 overflow-y-auto transition-opacity',
          loading && !primeraCarga && 'opacity-60',
        )}
        aria-busy={loading}
      >
        {primeraCarga ? (
          <div className="p-3 sm:p-5">
            <SkeletonRows />
          </div>
        ) : error ? (
          <EmptyState
            icon="alert"
            title="No se pudo cargar la planificación"
            action={
              <Button size="sm" variant="secondary" icon="refresh" onClick={reload}>
                Reintentar
              </Button>
            }
          />
        ) : rows.length === 0 ? (
          <EmptyState icon="users" title="Sin miembros en el equipo" />
        ) : (
          <DndContext
            sensors={sensors}
            onDragStart={(e: DragStartEvent) => setArrastrandoId(e.active.id as string)}
            onDragEnd={alSoltar}
            onDragCancel={() => setArrastrandoId(null)}
          >
            {/* Una sola vista montada a la vez: las dos registran zonas de soltar con la
                fecha como id (ver useEsMovil). */}
            {esMovil ? (
              <PersonaSemana
                rows={rows}
                memberId={personaMovil}
                onMember={setPersonaMovil}
                onSelect={setSelectedActivity}
              />
            ) : (
              <HeatmapTable
                rows={rows}
                days={days}
                abierta={abierta}
                onAbrir={setAbierta}
                onSelect={setSelectedActivity}
              />
            )}
            <DragOverlay>
              {arrastrandoActividad && (
                <ChipContenido
                  activity={arrastrandoActividad}
                  className="shadow-lg border-border-strong w-48"
                />
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      <Leyenda />

      <ActividadModal
        activity={selectedActivity}
        canEdit={canEdit}
        onClose={() => setSelectedActivity(null)}
        onChange={(next) => {
          setSelectedActivity(next)
          reload()
        }}
      />
    </div>
  )
}

/** Que significa cada tono del mapa de calor, contra la capacidad de un dia habil. */
function Leyenda() {
  const tramos: { nivel: 1 | 2 | 3 | 4; texto: string }[] = [
    { nivel: 1, texto: `hasta ${fmtHoras(CAPACIDAD_DIA / 2)}` },
    { nivel: 2, texto: `hasta ${fmtHoras(CAPACIDAD_DIA)}` },
    { nivel: 3, texto: `hasta ${fmtHoras(Math.round(CAPACIDAD_DIA * 1.3 * 10) / 10)}` },
    { nivel: 4, texto: 'más' },
  ]
  return (
    <footer className="shrink-0 border-t border-border bg-panel px-3 sm:px-5 py-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-faint">
        <span>Carga del día:</span>
        {tramos.map((t) => (
          <span key={t.nivel} className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className={cx('w-3 h-3 rounded-sm border border-border', CALOR_CLASE[t.nivel])} />
            {t.texto}
          </span>
        ))}
        <span className="sm:ml-auto">
          Capacidad {fmtHoras(CAPACIDAD_DIA)} por día hábil · {HORAS_SEMANA} h por semana
        </span>
      </div>
    </footer>
  )
}
