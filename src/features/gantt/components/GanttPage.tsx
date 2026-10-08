// Planificacion semanal: carga de trabajo por persona y dia.
//
// Rediseno Orbita: la vista por defecto es un calendario de la semana (idea de Planius,
// adaptada: sin horas del dia) con una persona o todo el equipo, y cada persona con su % de
// saturacion. La segunda vista es el mapa de calor de siempre (Carga del equipo). En las dos se
// arrastra una actividad a otro dia para reprogramarla (solo cambia la fecha de entrega). En el
// celular se ve una persona a la vez, con los dias en vertical.

import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { Button, IconButton } from '@shared/components/ui/Button'
import { Icon } from '@shared/components/ui/Icon'
import { PageHeader } from '@shared/components/ui/PageHeader'
import { EmptyState } from '@shared/components/ui/EmptyState'
import { SkeletonRows } from '@shared/components/ui/Skeleton'
import { useToast } from '@shared/components/ui/Toast'
import { cx } from '@shared/utils/cx'
import { useGantt } from '@features/gantt/hooks/useGantt'
import { useEsMovil } from '@shared/hooks/useEsMovil'
import { CALOR_CLASE, CAPACIDAD_DIA, HORAS_SEMANA, fmtHoras } from '@features/gantt/utils/carga'
import { minutesService } from '@infrastructure/supabase/minutes.service'
import { cambiarEntrega } from '@features/compromisos/utils/operaciones'
import { SegmentedControl } from '@shared/components/ui/SegmentedControl'
import { Avatar } from '@shared/components/ui/Avatar'
import { nombreCorto } from '@shared/utils/nombres'
import { nivelSemana, PILL_NIVEL, saturacionEquipo } from '@features/gantt/utils/niveles'
import { useAuth } from '@core/auth/hooks/useAuth'
import { useCapabilities } from '@core/auth/hooks/useCapabilities'
import type { Activity } from '@shared/types'
import { HeatmapTable, type CeldaAbierta } from './HeatmapTable'
import { PersonaSemana } from './PersonaSemana'
import { ActividadModal } from './ActividadModal'
import { ChipContenido } from './ActividadChip'
import { SemanaCalendario } from './SemanaCalendario'

export function GanttPage() {
  const {
    rows,
    atrasadas,
    moverLocal,
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
  const [vista, setVista] = useState<'semana' | 'equipo'>('semana')
  const { profile } = useAuth()
  // Calendario: por defecto la propia semana; null = todo el equipo.
  const [persona, setPersona] = useState<string | null>(profile?.id ?? null)
  const [personaMovil, setPersonaMovil] = useState<string>(profile?.id ?? '')
  const { canEditAllActivities } = useCapabilities()
  const toast = useToast()
  const esMovil = useEsMovil()
  const canEdit = canEditAllActivities || selectedActivity?.responsible_id === profile?.id
  // Mouse/touch y tambien teclado (Espacio toma la tarjeta, flechas la mueven, Espacio la suelta).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  )

  // Lo atrasado tambien se puede arrastrar (desde su columna en el calendario).
  const todas = [...rows.flatMap((r) => r.days.flatMap((d) => d.activities)), ...atrasadas]
  // Si la persona elegida no esta en la planificacion (ej. admin), se muestra todo el equipo.
  const personaVista = persona && rows.some((r) => r.member.id === persona) ? persona : null
  const arrastrandoActividad = todas.find((a) => a.id === arrastrandoId)

  const alSoltar = async (e: DragEndEvent) => {
    setArrastrandoId(null)
    const activityId = e.active.id as string
    const date = e.over?.id as string | undefined
    if (!date || dropping) return

    const activity = todas.find((a) => a.id === activityId)
    if (!activity) return
    if (!canEditAllActivities && activity.responsible_id !== profile?.id) return

    const newDueDate = new Date(date)
    const oldDueDate = new Date(activity.due_date)
    if (newDueDate.toDateString() === oldDueDate.toDateString()) return

    const antes = activity.due_date.split('T')[0]
    // Se mueve en pantalla al instante; si no se puede guardar, se vuelve a cargar lo real.
    moverLocal(activity.id, date)
    setDropping(true)
    try {
      // Mismo cambio de fecha que el resto de la app: si nacio de un tema, su plazo tambien.
      const temas = [
        ...(await minutesService.getByTeam(activity.team_id, 'minuta')),
        ...(await minutesService.getByTeam(activity.team_id, 'proyecto')),
      ]
      await cambiarEntrega(activity, date, temas)
      const dia = new Date(date + 'T00:00:00').toLocaleDateString('es-CL', {
        weekday: 'short',
        day: 'numeric',
      })
      toast.success(`«${activity.title}» movida al ${dia}`, {
        action: {
          label: 'Deshacer',
          onClick: () => {
            moverLocal(activity.id, antes)
            cambiarEntrega({ ...activity, due_date: date }, antes, temas)
              .then(reload)
              .catch(() => {
                toast.error('No se pudo deshacer')
                reload()
              })
          },
        },
      })
      reload()
    } catch {
      toast.error('No se pudo mover la actividad')
      reload()
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
        meta={weekLabel}
        actions={
          <>
            {!esMovil && (
              <SegmentedControl
                label="Vista"
                value={vista}
                onChange={setVista}
                options={[
                  { value: 'semana', label: 'Semana' },
                  { value: 'equipo', label: 'Carga del equipo' },
                ]}
              />
            )}
            <IconButton icon="chevronLeft" label="Semana anterior" onClick={prevWeek} />
            <Button size="xs" variant="secondary" onClick={currentWeek} disabled={weekOffset === 0}>
              Hoy
            </Button>
            <IconButton icon="chevronRight" label="Semana siguiente" onClick={nextWeek} />
          </>
        }
      >
        {/* Personas con su % de saturacion de la semana (horas / 42 h). */}
        {!esMovil && vista === 'semana' && rows.length > 0 && (
          <div
            role="group"
            aria-label="Persona"
            className="flex flex-wrap items-center gap-1.5 px-3 sm:px-5 pb-3"
          >
            {rows.length > 1 && (
              <ChipPersona
                activo={personaVista === null}
                onClick={() => setPersona(null)}
                nombre="Todo el equipo"
                pct={saturacionEquipo(rows)}
                detalle={`${fmtHoras(rows.reduce((s, r) => s + r.totalHours, 0))} de ${fmtHoras(HORAS_SEMANA * rows.length)}`}
                equipo
              />
            )}
            {rows.map((r) => (
              <ChipPersona
                key={r.member.id}
                activo={personaVista === r.member.id}
                onClick={() => setPersona(r.member.id)}
                nombre={r.member.full_name}
                avatar={r.member.avatar_url}
                pct={r.loadPercentage}
                detalle={`${fmtHoras(r.totalHours)} de ${HORAS_SEMANA} h · ${r.totalActivities} actividades`}
              />
            ))}
          </div>
        )}
      </PageHeader>

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
            accessibility={{
              screenReaderInstructions: {
                draggable:
                  'Para mover la actividad a otro día: Espacio para tomarla, flechas para moverla, Espacio para soltarla y Escape para cancelar. Enter abre el detalle.',
              },
              announcements: {
                onDragStart: () => 'Actividad tomada.',
                onDragOver: ({ over }) =>
                  over ? `Sobre el día ${over.id}.` : 'Fuera de los días.',
                onDragEnd: ({ over }) =>
                  over ? `Actividad soltada en el día ${over.id}.` : 'Sin cambios.',
                onDragCancel: () => 'Movimiento cancelado.',
              },
            }}
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
            ) : vista === 'semana' ? (
              <SemanaCalendario
                rows={rows}
                days={days}
                atrasadas={atrasadas}
                personaId={personaVista}
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

      {(esMovil || vista === 'equipo') && <Leyenda />}

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
    <footer className="shrink-0 border-t border-border px-3 sm:px-5 py-2">
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

/** Persona del calendario con su % de saturacion de la semana, en el color de su nivel. */
function ChipPersona({
  activo,
  onClick,
  nombre,
  avatar,
  pct,
  detalle,
  equipo,
}: {
  activo: boolean
  onClick: () => void
  nombre: string
  avatar?: string | null
  pct: number
  detalle: string
  equipo?: boolean
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      title={detalle}
      aria-label={`${nombre}: ${pct}% de saturación, ${detalle}`}
      className={cx(
        'inline-flex items-center gap-2 min-h-9 pl-1 pr-1.5 rounded-full border text-[13px] font-semibold transition-shadow',
        activo
          ? 'border-transparent bg-panel text-fg shadow-[inset_0_0_0_2px_rgb(var(--accent)),0_0_14px_rgb(var(--accent)/0.3)]'
          : 'border-border bg-panel text-fg-muted hover:text-fg',
      )}
    >
      {equipo ? (
        <span className="w-7 h-7 rounded-full grid place-items-center relleno-orbita text-white">
          <Icon name="users" size={14} />
        </span>
      ) : (
        <Avatar name={nombre} src={avatar} size="sm" />
      )}
      {equipo ? nombre : nombreCorto(nombre)}
      <span
        className={cx(
          'font-mono text-2xs font-semibold px-1.5 py-0.5 rounded-full',
          PILL_NIVEL[nivelSemana(pct)],
        )}
      >
        {pct}%
      </span>
    </button>
  )
}
