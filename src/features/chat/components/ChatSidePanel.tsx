import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@shared/components/ui/Icon'
import { DueDate, SectionLabel } from '@shared/components/ui/Indicators'
import { SegmentedControl } from '@shared/components/ui/SegmentedControl'
import { ProjectDot } from '@shared/components/ui/ProjectDot'
import { Spinner } from '@shared/components/ui/Spinner'
import { cx } from '@shared/utils/cx'
import { nombreCorto } from '@shared/utils/nombres'
import type { Activity, MinuteItem } from '@shared/types'
import type { ResumenDia } from '@features/chat/components/log/registro'
import { textoLumix } from '@features/chat/components/log/registro'
import { useTrabajoPendiente, type Plazo } from '@features/chat/hooks/useTrabajoPendiente'

type Lista = 'actividades' | 'proyectos' | 'minuta'

interface Props {
  resumen: ResumenDia
  onJump: (messageId: string) => void
  onCompletar: (activityId: string) => Promise<unknown>
  teamId: string
  userId: string | undefined
  verEquipo: boolean
  /** Cambia con cada mensaje nuevo: el panel se relee (algo se pudo crear o cerrar). */
  version: number
  memberName: (id: string) => string
}

const PLAZOS: { value: Plazo; label: string }[] = [
  { value: 'vencidas', label: 'Vencidas' },
  { value: 'hoy', label: 'Hoy' },
  { value: 'proximas', label: 'Por vencer' },
]

const RUTA: Record<Lista, string> = {
  actividades: '/activities',
  proyectos: '/proyectos',
  minuta: '/minuta',
}

// Borde del circulo de completar por prioridad (como Todoist): se ve la urgencia de un vistazo.
const CHECK_PRIO: Record<number, string> = {
  1: 'border-p1 hover:bg-p1/10',
  2: 'border-p2 hover:bg-p2/10',
  3: 'border-p3 hover:bg-p3/10',
}

/**
 * Panel al costado del chat (escritorio): lo que salio de la conversacion hoy y el trabajo que
 * vence (hoy, vencido o por vencer) de actividades, proyectos y minuta. Crear no va aca: ya
 * esta en los botones de tipo del campo de texto.
 */
export function ChatSidePanel({
  resumen,
  onJump,
  onCompletar,
  teamId,
  userId,
  verEquipo,
  version,
  memberName,
}: Props) {
  const navigate = useNavigate()
  const { trabajo } = useTrabajoPendiente({ teamId, userId, verEquipo, version })
  const [lista, setLista] = useState<Lista>('actividades')
  const [plazo, setPlazo] = useState<Plazo>('hoy')
  const [completando, setCompletando] = useState<string | null>(null)

  const grupo = trabajo?.[lista]
  const items = grupo?.[plazo] ?? []
  const contar = (l: Lista) =>
    trabajo ? trabajo[l].vencidas.length + trabajo[l].hoy.length + trabajo[l].proximas.length : 0

  const completar = async (a: Activity) => {
    setCompletando(a.id)
    try {
      await onCompletar(a.id)
    } finally {
      setCompletando(null)
    }
  }

  return (
    <aside
      aria-label="Panel de trabajo"
      className="hidden lg:flex w-80 shrink-0 flex-col gap-5 overflow-y-auto border-l border-border bg-shell px-4 py-4"
    >
      <section className="flex flex-col gap-2">
        <SectionLabel>Esta conversación hoy</SectionLabel>
        <div className="grid grid-cols-2 gap-1.5">
          <Cifra label="Actividades" value={resumen.actividades} />
          <Cifra label="Errores" value={resumen.errores} />
          <Cifra label="Fechas movidas" value={resumen.movidas} />
          <Cifra label="Por decidir" value={resumen.porDecidir.length} alerta />
        </div>
        {resumen.porDecidir.length > 0 && (
          <ul className="flex flex-col gap-0.5 -mx-1.5">
            {resumen.porDecidir.slice(-5).map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onJump(m.id)}
                  className="w-full rounded-md px-1.5 py-1 text-left text-xs text-fg-muted hover:bg-surface hover:text-fg line-clamp-2"
                >
                  {textoLumix(m.content).text}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2.5 min-h-0">
        <SectionLabel
          action={
            <button
              type="button"
              onClick={() => navigate(RUTA[lista])}
              className="text-xs text-accent hover:underline"
            >
              Ver todo
            </button>
          }
        >
          {verEquipo ? 'Trabajo del equipo' : 'Mi trabajo'}
        </SectionLabel>

        <SegmentedControl
          label="Qué listar"
          value={lista}
          onChange={setLista}
          className="w-full [&>button]:flex-1 [&>button]:justify-center"
          options={[
            { value: 'actividades', label: 'Actividades', count: contar('actividades') },
            { value: 'proyectos', label: 'Proyectos', count: contar('proyectos') },
            { value: 'minuta', label: 'Minuta', count: contar('minuta') },
          ]}
        />

        <div role="tablist" aria-label="Plazo" className="flex gap-1">
          {PLAZOS.map((p) => {
            const n = grupo?.[p.value].length ?? 0
            const activo = plazo === p.value
            return (
              <button
                key={p.value}
                type="button"
                role="tab"
                aria-selected={activo}
                onClick={() => setPlazo(p.value)}
                className={cx(
                  'flex-1 inline-flex items-center justify-center gap-1.5 h-7 rounded-full text-xs font-medium transition-colors',
                  activo
                    ? p.value === 'vencidas'
                      ? 'bg-danger-soft text-danger'
                      : p.value === 'hoy'
                        ? 'bg-tag-green-soft text-date-today'
                        : 'bg-tag-violet-soft text-date-week'
                    : 'text-fg-muted hover:bg-surface',
                )}
              >
                {p.label}
                <span className={cx('tabular-nums', !activo && 'text-fg-faint')}>{n}</span>
              </button>
            )
          })}
        </div>

        {!trabajo ? (
          <div className="flex justify-center py-6 text-fg-faint">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <p className="text-xs text-fg-faint text-center py-6">
            {plazo === 'vencidas'
              ? 'Nada vencido. Bien.'
              : plazo === 'hoy'
                ? 'Nada vence hoy.'
                : 'Nada vence en los próximos 7 días.'}
          </p>
        ) : (
          <ul className="flex flex-col -mx-1.5">
            {items.slice(0, 12).map((it) =>
              lista === 'actividades' ? (
                <FilaActividad
                  key={it.id}
                  a={it as Activity}
                  responsable={verEquipo ? memberName((it as Activity).responsible_id) : null}
                  completando={completando === it.id}
                  puedeCompletar={verEquipo || (it as Activity).responsible_id === userId}
                  onCompletar={() => completar(it as Activity)}
                  onAbrir={() => navigate('/activities', { state: { activityId: it.id } })}
                />
              ) : (
                <FilaTema
                  key={it.id}
                  item={it as MinuteItem}
                  raiz={lista === 'proyectos' ? trabajo.raizProyecto(it as MinuteItem) : null}
                  memberName={memberName}
                  onAbrir={() => {
                    const raiz = trabajo.raizProyecto(it as MinuteItem)
                    navigate(lista === 'proyectos' ? `/proyectos/${raiz.id}` : '/minuta')
                  }}
                />
              ),
            )}
            {items.length > 12 && (
              <li className="px-1.5 pt-1 text-xs text-fg-faint">y {items.length - 12} más…</li>
            )}
          </ul>
        )}
      </section>
    </aside>
  )
}

function Cifra({ label, value, alerta }: { label: string; value: number; alerta?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-panel px-2.5 py-1.5">
      <div
        className={cx(
          'text-lg font-semibold tabular-nums leading-tight',
          alerta && value > 0 ? 'text-warning' : 'text-fg',
        )}
      >
        {value}
      </div>
      <div className="text-2xs text-fg-faint">{label}</div>
    </div>
  )
}

function FilaActividad({
  a,
  responsable,
  completando,
  puedeCompletar,
  onCompletar,
  onAbrir,
}: {
  a: Activity
  responsable: string | null
  completando: boolean
  puedeCompletar: boolean
  onCompletar: () => void
  onAbrir: () => void
}) {
  return (
    <li className="flex items-start gap-2 rounded-lg px-1.5 py-1.5 hover:bg-panel">
      {puedeCompletar ? (
        <button
          type="button"
          onClick={onCompletar}
          disabled={completando}
          aria-label={`Completar ${a.title}`}
          title="Completar"
          className={cx(
            'group/check mt-0.5 w-4 h-4 shrink-0 rounded-full border-[1.5px] grid place-items-center transition-colors',
            CHECK_PRIO[a.priority] ?? 'border-fg-faint',
          )}
        >
          <Icon
            name="check"
            size={10}
            strokeWidth={3}
            className={cx(
              'opacity-0 group-hover/check:opacity-100',
              a.priority === 1 ? 'text-p1' : a.priority === 2 ? 'text-p2' : 'text-p3',
            )}
          />
        </button>
      ) : (
        <span className="mt-0.5 w-4 h-4 shrink-0" />
      )}
      <button type="button" onClick={onAbrir} className="min-w-0 flex-1 text-left">
        <span className="block text-sm text-fg leading-snug line-clamp-2">{a.title}</span>
        <span className="flex items-center gap-1.5 text-xs text-fg-faint">
          <DueDate date={a.due_date} />
          {responsable && <span className="truncate">· {nombreCorto(responsable)}</span>}
        </span>
      </button>
    </li>
  )
}

function FilaTema({
  item,
  raiz,
  memberName,
  onAbrir,
}: {
  item: MinuteItem
  /** Proyecto al que pertenece (solo en la lista de proyectos). */
  raiz: MinuteItem | null
  memberName: (id: string) => string
  onAbrir: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onAbrir}
        className="w-full flex items-start gap-2 rounded-lg px-1.5 py-1.5 text-left hover:bg-panel"
      >
        {raiz ? (
          <ProjectDot id={raiz.id} className="mt-1.5" />
        ) : (
          <Icon name="clipboard" size={14} className="mt-0.5 text-tag-amber" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-fg leading-snug line-clamp-2">{item.tema}</span>
          <span className="flex items-center gap-1.5 text-xs text-fg-faint min-w-0">
            {item.plazo && <DueDate date={item.plazo} />}
            {raiz && raiz.id !== item.id && <span className="truncate">· {raiz.tema}</span>}
            {!raiz && item.responsables[0] && (
              <span className="truncate">· {nombreCorto(memberName(item.responsables[0]))}</span>
            )}
          </span>
        </span>
      </button>
    </li>
  )
}
