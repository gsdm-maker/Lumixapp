import { useDraggable } from '@dnd-kit/core'
import { Avatar } from '@shared/components/ui/Avatar'
import { useAuth } from '@core/auth/hooks/useAuth'
import { useCapabilities } from '@core/auth/hooks/useCapabilities'
import { nombreCorto } from '@shared/utils/nombres'
import { cx } from '@shared/utils/cx'
import type { Activity } from '@shared/types'
import type { GanttRow } from '@features/gantt/hooks/useGantt'
import { CAPACIDAD_DIA, fmtHoras, horasDe, hoyYMD } from '@features/gantt/utils/carga'
import { nivelDia, type Nivel } from '@features/gantt/utils/niveles'
import { Carita } from '@shared/components/ui/Carita'
import { TEXTO_NIVEL } from '@shared/utils/nivelCarga'
import { DiaDroppable } from './ActividadChip'

const BARRA: Record<Nivel, string> = {
  libre: '#2fbf85',
  normal: '#7b5cff',
  alta: '#f59e0b',
  saturado: '#e5533d',
}

// Cabecera de la tarjeta segun como viene (texto blanco: cada degradado da >= 4.5).
const CABECERA = {
  violeta: 'linear-gradient(90deg, #5b3fd9, #7759f7)',
  azul: 'linear-gradient(90deg, #1d55a8, #2563c4)',
  ambar: 'linear-gradient(90deg, #9a5800, #aa6400)',
  rojo: 'linear-gradient(90deg, #b23a29, #c94a37)',
  gris: 'linear-gradient(90deg, #5b5873, #747190)',
  verde: 'linear-gradient(90deg, #0b7a4f, #108556)',
}

function cabecera(a: Activity, hoy: string): { tono: keyof typeof CABECERA; texto: string } {
  const dia = a.due_date.split('T')[0]
  if (a.status === 'completado') return { tono: 'verde', texto: 'HECHA' }
  if (a.status === 'bloqueado') return { tono: 'gris', texto: 'BLOQUEADA' }
  if (dia < hoy) {
    const dias = Math.round(
      (new Date(hoy + 'T00:00:00').getTime() - new Date(dia + 'T00:00:00').getTime()) / 86_400_000,
    )
    return { tono: 'rojo', texto: dias === 1 ? 'VENCIDA · AYER' : `VENCIDA · HACE ${dias} D` }
  }
  if (dia === hoy) return { tono: 'ambar', texto: 'VENCE HOY' }
  return a.status === 'en_proceso'
    ? { tono: 'azul', texto: 'EN PROCESO' }
    : { tono: 'violeta', texto: 'PENDIENTE' }
}

/**
 * Tarjeta de una actividad en el calendario: cabecera de color segun como viene, alto segun sus
 * horas estimadas (un dia lleno se ve lleno). Se arrastra a otro dia si la persona puede
 * editarla; se toca para ver el detalle.
 */
export function TarjetaActividad({
  activity,
  nombre,
  onSelect,
}: {
  activity: Activity
  /** Nombre del responsable (se muestra en la vista de todo el equipo). */
  nombre?: string
  onSelect: (a: Activity) => void
}) {
  const { profile } = useAuth()
  const { canEditAllActivities } = useCapabilities()
  const movible =
    activity.status !== 'completado' &&
    (canEditAllActivities || activity.responsible_id === profile?.id)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: activity.id,
    disabled: !movible,
  })
  const h = horasDe(activity)
  const cab = cabecera(activity, hoyYMD())
  return (
    <div
      ref={setNodeRef}
      role="button"
      tabIndex={0}
      {...(movible ? attributes : {})}
      {...(movible ? listeners : {})}
      onClick={() => onSelect(activity)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSelect(activity)
      }}
      aria-label={`${activity.title}, ${cab.texto.toLowerCase()}, ${fmtHoras(h)}`}
      title={movible ? `${activity.title} · arrastra para cambiar de día` : activity.title}
      style={{ minHeight: Math.max(76, h * 14 + 34) }}
      className={cx(
        'flex flex-col w-full overflow-hidden rounded-2xl border border-border bg-panel text-left shadow-sm transition-shadow hover:shadow-md',
        movible && 'cursor-grab active:cursor-grabbing touch-none',
        isDragging && 'opacity-40',
        activity.status === 'completado' && 'opacity-60',
      )}
    >
      <span
        className="flex items-center justify-between gap-2 px-2.5 py-0.5 font-mono text-[10.5px] font-semibold text-white"
        style={{ background: CABECERA[cab.tono] }}
      >
        <span className="truncate">{cab.texto}</span>
        <span className="shrink-0">{fmtHoras(h).toUpperCase()}</span>
      </span>
      <span className="flex flex-1 flex-col gap-1.5 px-2.5 py-2">
        <b
          className={cx(
            'text-[13px] font-semibold leading-snug text-fg line-clamp-3',
            activity.status === 'completado' && 'line-through',
          )}
        >
          {activity.title}
        </b>
        {nombre && (
          <span className="mt-auto flex items-center gap-1.5 text-xs text-fg-faint">
            <Avatar name={nombre} size="xs" />
            <span className="truncate">{nombreCorto(nombre)}</span>
          </span>
        )}
      </span>
    </div>
  )
}

/**
 * Planificacion como calendario semanal (rediseno Orbita, idea tomada de Planius y adaptada:
 * Lumix no agenda horas del dia, asi que no hay grilla horaria). Columnas de lunes a viernes con
 * la carga de cada dia arriba, tarjetas por actividad y lo atrasado a un costado para
 * arrastrarlo a un dia. Muestra a una persona o a todo el equipo.
 */
export function SemanaCalendario({
  rows,
  days,
  atrasadas,
  personaId,
  onSelect,
}: {
  rows: GanttRow[]
  days: { date: string; label: string }[]
  atrasadas: Activity[]
  /** null = todo el equipo. */
  personaId: string | null
  onSelect: (a: Activity) => void
}) {
  const hoy = hoyYMD()
  const visibles = personaId ? rows.filter((r) => r.member.id === personaId) : rows
  const nombreDe = (id: string) => rows.find((r) => r.member.id === id)?.member.full_name ?? ''
  const capacidad = CAPACIDAD_DIA * Math.max(1, visibles.length)
  // Lunes a viernes; sabado y domingo aparecen solo si algo vence esos dias (que no se pierda).
  const conActividad = (date: string) =>
    visibles.some((r) => (r.days.find((x) => x.date === date)?.activities.length ?? 0) > 0)
  const habiles = days.filter((d, i) => i < 5 || conActividad(d.date))
  const atrasadasVisibles = atrasadas.filter((a) => !personaId || a.responsible_id === personaId)

  return (
    <div className="flex flex-col lg:flex-row gap-3.5 items-start px-3 sm:px-5 py-3">
      {atrasadasVisibles.length > 0 && (
        <aside
          className="lamina w-full lg:w-56 shrink-0 p-3.5 flex flex-col gap-2.5"
          aria-label="Vencidas"
        >
          <span className="etiqueta-orbita">Vencidas · {atrasadasVisibles.length}</span>
          <p className="text-xs text-fg-faint">Arrástralas a un día para reprogramarlas.</p>
          {atrasadasVisibles.map((a) => (
            <TarjetaActividad
              key={a.id}
              activity={a}
              nombre={personaId ? undefined : nombreDe(a.responsible_id)}
              onSelect={onSelect}
            />
          ))}
        </aside>
      )}

      <section className="lamina overflow-clip flex-1 min-w-0 w-full" aria-label="Semana">
        <div className="overflow-x-auto">
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${habiles.length}, minmax(150px, 1fr))`,
              minWidth: habiles.length * 152,
            }}
          >
            {habiles.map((d) => {
              const acts = visibles.flatMap(
                (r) => r.days.find((x) => x.date === d.date)?.activities ?? [],
              )
              const horas = acts
                .filter((a) => a.status !== 'completado')
                .reduce((s, a) => s + horasDe(a), 0)
              const nivel = nivelDia(horas, capacidad)
              const esHoy = d.date === hoy
              const fecha = new Date(d.date + 'T00:00:00')
              const nombreDia = fecha.toLocaleDateString('es-CL', { weekday: 'short' })
              return (
                <div key={d.date} className="flex flex-col border-r border-border last:border-r-0">
                  <div
                    className={cx(
                      'flex flex-col gap-1.5 px-2.5 pt-3 pb-2.5 border-b border-border',
                      esHoy && 'bg-accent-soft/50',
                    )}
                    title={`${fmtHoras(horas)} de ${fmtHoras(capacidad)} · ${TEXTO_NIVEL[nivel]}`}
                  >
                    <div className="flex items-center gap-2">
                      <Carita nivel={nivel} />
                      <b className={cx('text-sm capitalize', esHoy ? 'text-accent' : 'text-fg')}>
                        {nombreDia} {fecha.getDate()}
                        {esHoy && ' · hoy'}
                      </b>
                      <span className="ml-auto text-2xs text-fg-muted tabular-nums">
                        {fmtHoras(horas).replace(' h', '')} / {fmtHoras(capacidad)}
                      </span>
                    </div>
                    <span className="text-2xs font-semibold text-fg-muted">
                      {TEXTO_NIVEL[nivel]}
                    </span>
                    <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                      <i
                        className="block h-full rounded-full"
                        style={{
                          width: `${Math.min(100, (horas / capacidad) * 100)}%`,
                          background: BARRA[nivel],
                        }}
                      />
                    </div>
                  </div>
                  <DiaDroppable
                    date={d.date}
                    className={cx(
                      'flex-1 min-h-[460px] p-2 flex flex-col gap-2',
                      esHoy && 'bg-accent-soft/30',
                    )}
                  >
                    {acts.length === 0 ? (
                      <p className="mt-1 rounded-xl border border-dashed border-border px-2 py-3 text-center text-xs text-fg-faint">
                        {nivel === 'libre' ? 'Día libre: arrastra algo aquí' : 'Nada para este día'}
                      </p>
                    ) : (
                      acts
                        .slice()
                        .sort(
                          (a, b) =>
                            Number(a.status === 'completado') - Number(b.status === 'completado') ||
                            a.priority - b.priority,
                        )
                        .map((a) => (
                          <TarjetaActividad
                            key={a.id}
                            activity={a}
                            nombre={personaId ? undefined : nombreDe(a.responsible_id)}
                            onSelect={onSelect}
                          />
                        ))
                    )}
                  </DiaDroppable>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
