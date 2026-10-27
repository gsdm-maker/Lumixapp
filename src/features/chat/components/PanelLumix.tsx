import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@shared/components/ui/Toast'
import { Nucleo } from '@shared/components/ui/Nucleo'
import { Icon } from '@shared/components/ui/Icon'
import { fechaRelativa } from '@shared/utils/date'
import { cx } from '@shared/utils/cx'
import { fmtHoras } from '@features/gantt/utils/carga'
import type { Sesion } from '@features/chat/components/log/sesiones'
import type { usePanelLumix } from '@features/chat/hooks/usePanelLumix'
import { Carita } from '@shared/components/ui/Carita'
import { TEXTO_NIVEL } from '@shared/utils/nivelCarga'
import { useVozLumix } from '@features/chat/hooks/useVozLumix'
import { resumenDelDia } from '@features/chat/utils/resumenVoz'
import { SUGERENCIAS_LUMIX as SUGERENCIAS } from '@features/chat/utils/sugerencias'

type Panel = NonNullable<ReturnType<typeof usePanelLumix>['panel']>

function saludo(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches'
}

const Etiqueta = ({ children }: { children: string }) => (
  <span className="font-mono text-2xs font-medium uppercase tracking-[0.12em] text-accent">
    {children}
  </span>
)

/**
 * Columna derecha del chat (rediseno Orbita): Lumix saluda con el avance de la semana y
 * sugerencias, la carga de la semana (compacta), el avance de los compromisos, lo atrasado para
 * ponerlo al dia y el historial de conversaciones. Es el tablero de la persona al lado de donde
 * le da ordenes a Lumix. Solo en pantallas anchas.
 */
export function PanelLumix({
  panel,
  nombre,
  sesiones,
  onSugerencia,
  onSesion,
  onNueva,
  onMoverAHoy,
  enPanel = false,
}: {
  panel: Panel | null
  /** Pasa una actividad atrasada a hoy. */
  onMoverAHoy?: (id: string) => Promise<void>
  nombre: string
  sesiones: Sesion[]
  onSugerencia: (texto: string) => void
  onSesion: (id: string) => void
  onNueva: () => void
  /** Dentro de un panel lateral (pantallas sin espacio para la columna). */
  enPanel?: boolean
}) {
  const navigate = useNavigate()
  const toast = useToast()
  const [moviendo, setMoviendo] = useState<string | null>(null)
  const voz = useVozLumix()
  // Tocar el nucleo: Lumix cuenta en voz alta el dia; otro toque lo calla.
  const escuchar = () => {
    if (voz.hablando) return voz.detener()
    if (panel) voz.hablar(resumenDelDia(panel, nombre))
  }
  const pct = panel?.porcentaje
  const faltanMeta =
    panel && panel.total
      ? Math.max(0, Math.ceil((panel.meta / 100) * panel.total) - panel.cumplidos)
      : 0

  return (
    <aside
      aria-label="Lumix y accesos rápidos"
      className={
        enPanel
          ? 'flex flex-col gap-3.5'
          : 'hidden xl:flex w-[380px] 2xl:w-[420px] shrink-0 flex-col gap-3.5 overflow-y-auto pl-1 pr-5 py-4'
      }
    >
      {/* Saludo de Lumix */}
      <section className="vidrio rounded-3xl p-5 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          {voz.disponible && panel ? (
            <button
              type="button"
              onClick={escuchar}
              aria-pressed={voz.hablando}
              aria-label={voz.hablando ? 'Detener a Lumix' : 'Escuchar mi día'}
              title={voz.hablando ? 'Detener' : 'Escuchar mi día'}
              className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            >
              <Nucleo
                size={60}
                flotar={!voz.hablando}
                pensando={voz.hablando}
                chispas={!!panel.sugerencia}
              />
            </button>
          ) : (
            <Nucleo size={60} flotar chispas={!!panel?.sugerencia} />
          )}
          {voz.disponible && panel && (
            <button
              type="button"
              onClick={escuchar}
              className="inline-flex items-center gap-1.5 min-h-8 px-3 rounded-full border border-border bg-panel text-xs font-semibold text-fg-muted hover:text-fg"
            >
              <Icon name={voz.hablando ? 'pause' : 'play'} size={13} className="text-accent" />
              {voz.hablando ? 'Detener' : 'Escuchar mi día'}
            </button>
          )}
        </div>
        <div>
          <Etiqueta>Lumix · tu agente</Etiqueta>
          <h2 className="mt-1 text-lg font-extrabold leading-snug tracking-tight text-fg">
            {saludo()}, {nombre.split(' ')[0]}.{' '}
            {pct !== null && pct !== undefined ? (
              <>
                Esta semana vas en <span className="texto-orbita">{pct}%</span>.
              </>
            ) : (
              'Esta semana aún no hay compromisos.'
            )}
          </h2>
          {panel && (
            <p className="mt-1 text-sm text-fg-muted">
              {faltanMeta > 0
                ? `Te faltan ${faltanMeta} compromiso${faltanMeta === 1 ? '' : 's'} para la meta`
                : panel.total
                  ? 'Vas sobre la meta'
                  : 'Nada comprometido para esta semana'}
              {panel.porConversar > 0
                ? ` · ${panel.porConversar} tema${panel.porConversar === 1 ? '' : 's'} por conversar en la minuta.`
                : '.'}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Sugerencias de Lumix">
          {SUGERENCIAS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSugerencia(s)}
              className="inline-flex items-center gap-1.5 min-h-9 px-3 rounded-full border border-border bg-panel text-xs font-semibold text-fg-muted hover:text-fg hover:shadow-[inset_0_0_0_2px_rgb(var(--accent)),0_0_16px_rgb(var(--accent)/0.3)] transition-shadow"
            >
              <Icon name="sparkles" size={13} className="text-accent" />
              {s}
            </button>
          ))}
        </div>
      </section>

      {/* Tu semana: carga por dia */}
      {panel && (
        <section
          className="vidrio rounded-3xl px-4 py-3 flex flex-col gap-2"
          aria-label="Tu semana"
        >
          <Etiqueta>Tu semana · carga</Etiqueta>
          <div className="grid grid-cols-5 gap-1">
            {panel.semana.map((d) => (
              <button
                key={d.ymd}
                type="button"
                onClick={() => navigate('/gantt')}
                aria-label={`${d.dia} ${d.numero}: ${TEXTO_NIVEL[d.nivel]}, ${fmtHoras(d.horas)}`}
                title={`${fmtHoras(d.horas)} · ${TEXTO_NIVEL[d.nivel]}`}
                aria-current={d.esHoy ? 'date' : undefined}
                className={cx(
                  'flex flex-col items-center gap-0.5 rounded-xl border border-border bg-panel py-1.5 text-2xs text-fg-faint',
                  d.esHoy &&
                    'text-accent shadow-[inset_0_0_0_2px_rgb(var(--accent)),0_0_16px_rgb(var(--accent)/0.3)]',
                )}
              >
                {d.dia}
                <Carita nivel={d.nivel} />
                <b className="text-xs text-fg">{d.numero}</b>
              </button>
            ))}
          </div>
          <TextoCarga semana={panel.semana} />
        </section>
      )}

      {/* Compromisos: el avance de la semana contra la meta */}
      {panel && (
        <section
          className="vidrio rounded-3xl px-4 py-3 flex flex-col gap-2"
          aria-label="Compromisos"
        >
          <div className="flex items-center justify-between gap-2">
            <Etiqueta>Compromisos · esta semana</Etiqueta>
            <button
              type="button"
              onClick={() => navigate('/compromisos')}
              className="text-xs font-bold text-accent hover:underline"
            >
              Abrir
            </button>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl font-extrabold tracking-tight text-fg">{pct ?? 0}%</span>
            <span className="text-xs text-fg-muted">
              {panel.cumplidos} de {panel.total} cumplidos · meta{' '}
              <b className="text-warning">{panel.meta}%</b>
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Avance de los compromisos de la semana"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct ?? 0}
            className="relative h-2.5 rounded-full bg-surface-2"
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, pct ?? 0)}%`,
                background: 'linear-gradient(90deg, rgb(var(--a-600)), rgb(61 107 255))',
              }}
            />
            {/* Marca de la meta */}
            <span
              aria-hidden="true"
              className="absolute -top-1 h-4.5 w-0.5 rounded-full bg-warning"
              style={{ left: `calc(${Math.min(100, panel.meta)}% - 1px)` }}
            />
          </div>
          {panel.pendientes.length > 0 && (
            <p className="text-xs text-fg-muted">
              Faltan {panel.pendientes.length} esta semana
              {panel.pendientes.some((c) => fechaRelativa(c.due_date).tone === 'late') &&
                ', algunas ya vencidas'}
              .
            </p>
          )}
        </section>
      )}

      {/* Atrasadas: lo vencido de la persona, para ponerlo al dia rapido */}
      {panel && panel.atrasadas.length > 0 && (
        <section
          className="vidrio rounded-3xl px-4 py-3 flex flex-col gap-1.5"
          aria-label="Atrasadas"
        >
          <div className="flex items-center justify-between gap-2">
            <Etiqueta>{`Atrasadas · ${panel.atrasadas.length}`}</Etiqueta>
            <button
              type="button"
              onClick={() => navigate('/activities')}
              className="text-xs font-bold text-accent hover:underline"
            >
              Ver todas
            </button>
          </div>
          <ul className="divide-y divide-border">
            {panel.atrasadas.slice(0, 5).map((a) => (
              <li key={a.id} className="flex items-center gap-2 py-1.5">
                <button
                  type="button"
                  onClick={() => navigate('/activities', { state: { activityId: a.id } })}
                  className="flex-1 min-w-0 truncate text-left text-sm text-fg hover:text-accent"
                  title={`Abrir "${a.title}"`}
                >
                  {a.title}
                </button>
                <span className="shrink-0 rounded-full bg-danger-soft px-2 py-0.5 text-2xs font-bold text-danger">
                  {fechaRelativa(a.due_date).text}
                </span>
                {onMoverAHoy && (
                  <button
                    type="button"
                    disabled={moviendo !== null}
                    onClick={async () => {
                      setMoviendo(a.id)
                      try {
                        await onMoverAHoy(a.id)
                        toast.success(`"${a.title}" pasó a hoy`)
                      } catch {
                        toast.error('No se pudo mover la fecha')
                      } finally {
                        setMoviendo(null)
                      }
                    }}
                    aria-label={`Pasar "${a.title}" a hoy`}
                    title="Pasar a hoy"
                    className="shrink-0 min-h-7 rounded-full border border-border bg-panel px-2.5 text-2xs font-bold text-fg-muted hover:text-accent disabled:opacity-50"
                  >
                    {moviendo === a.id ? '…' : 'Hoy'}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {panel.atrasadas.length > 5 && (
            <p className="text-xs text-fg-faint">
              y {panel.atrasadas.length - 5} más en Actividades.
            </p>
          )}
        </section>
      )}

      {/* Historial de conversaciones */}
      <section className="vidrio rounded-3xl p-4 flex flex-col gap-2" aria-label="Conversaciones">
        <div className="flex items-center justify-between gap-2 px-1">
          <Etiqueta>Conversaciones</Etiqueta>
          <button
            type="button"
            onClick={onNueva}
            className="min-h-8 px-3 rounded-full border border-dashed border-border-strong text-xs font-bold text-accent hover:bg-accent-soft"
          >
            + Nueva
          </button>
        </div>
        {sesiones.length === 0 ? (
          <p className="px-1 text-sm text-fg-faint">Aún no hay conversaciones.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {sesiones.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onSesion(s.id)}
                  className={cx(
                    'w-full text-left px-3 py-2 rounded-xl border-l-[3px] transition-colors',
                    'border-transparent hover:bg-surface hover:border-accent',
                  )}
                >
                  <span className="block truncate text-sm font-medium text-fg">{s.titulo}</span>
                  <span className="block text-xs text-fg-faint">
                    {new Date(s.cuando).toLocaleString('es-CL', {
                      weekday: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {s.acciones > 0 && ` · ${s.acciones} acci${s.acciones === 1 ? 'ón' : 'ones'}`}
                    {i === 0 && ' · la más reciente'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  )
}

function TextoCarga({ semana }: { semana: Panel['semana'] }) {
  const hoy = semana.find((d) => d.esHoy)
  const libre = semana.find((d) => d.nivel === 'libre' && (!hoy || d.ymd > hoy.ymd))
  if (!hoy)
    return <p className="text-xs text-fg-muted">Carga de tus actividades que vencen cada día.</p>
  return (
    <p className="text-xs text-fg-muted">
      Hoy vienes con{' '}
      <b className={hoy.nivel === 'saturado' || hoy.nivel === 'alta' ? 'text-danger' : 'text-fg'}>
        {fmtHoras(hoy.horas)}
      </b>{' '}
      de 8,4 h.
      {libre && ` El ${libre.dia} ${libre.numero} está libre.`}
    </p>
  )
}
