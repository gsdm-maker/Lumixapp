import { useNavigate } from 'react-router-dom'
import { Nucleo } from '@shared/components/ui/Nucleo'
import { Icon } from '@shared/components/ui/Icon'
import { fechaRelativa } from '@shared/utils/date'
import { cx } from '@shared/utils/cx'
import { fmtHoras } from '@features/gantt/utils/carga'
import type { Sesion } from '@features/chat/components/log/sesiones'
import type { NivelCarga, usePanelLumix } from '@features/chat/hooks/usePanelLumix'

type Panel = NonNullable<ReturnType<typeof usePanelLumix>['panel']>

const SUGERENCIAS = ['Cerrar la semana', '¿Qué está vencido?', '¿Cómo vamos con los compromisos?']

const CARITA: Record<NivelCarga, { fondo: string; texto: string }> = {
  libre: { fondo: 'radial-gradient(circle at 35% 30%, #c8f5df, #2fbf85 70%)', texto: 'libre' },
  normal: { fondo: 'radial-gradient(circle at 35% 30%, #e3d9ff, #7b5cff 70%)', texto: 'normal' },
  alta: { fondo: 'radial-gradient(circle at 35% 30%, #ffe2b8, #f59e0b 70%)', texto: 'carga alta' },
  saturado: {
    fondo: 'radial-gradient(circle at 35% 30%, #ffd0c8, #e5533d 70%)',
    texto: 'saturado',
  },
}

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
 * sugerencias, el historial de conversaciones, la carga de la semana y los compromisos. Es el
 * tablero de la persona al lado de donde le da ordenes a Lumix. Solo en pantallas anchas.
 */
export function PanelLumix({
  panel,
  nombre,
  sesiones,
  onSugerencia,
  onSesion,
  onNueva,
}: {
  panel: Panel | null
  nombre: string
  sesiones: Sesion[]
  onSugerencia: (texto: string) => void
  onSesion: (id: string) => void
  onNueva: () => void
}) {
  const navigate = useNavigate()
  const pct = panel?.porcentaje
  const faltanMeta =
    panel && panel.total
      ? Math.max(0, Math.ceil((panel.meta / 100) * panel.total) - panel.cumplidos)
      : 0

  return (
    <aside
      aria-label="Lumix y accesos rápidos"
      className="hidden xl:grid flex-1 min-w-[360px] content-start grid-cols-[repeat(auto-fit,minmax(340px,1fr))] gap-3.5 overflow-y-auto pl-2 pr-5 py-4"
    >
      {/* Saludo de Lumix */}
      <section className="vidrio rounded-3xl p-5 flex flex-col gap-3">
        <Nucleo size={60} flotar chispas={!!panel?.sugerencia} />
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
                    i === 0
                      ? 'border-accent bg-accent-soft/60'
                      : 'border-transparent hover:bg-surface',
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
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Tu semana: carga por dia */}
      {panel && (
        <section className="vidrio rounded-3xl p-4 flex flex-col gap-3" aria-label="Tu semana">
          <Etiqueta>Tu semana · carga</Etiqueta>
          <div className="grid grid-cols-5 gap-1.5">
            {panel.semana.map((d) => (
              <button
                key={d.ymd}
                type="button"
                onClick={() => navigate('/gantt')}
                aria-label={`${d.dia} ${d.numero}: ${CARITA[d.nivel].texto}, ${fmtHoras(d.horas)}`}
                title={`${fmtHoras(d.horas)} · ${CARITA[d.nivel].texto}`}
                aria-current={d.esHoy ? 'date' : undefined}
                className={cx(
                  'flex flex-col items-center gap-1 rounded-2xl border border-border bg-panel py-2 text-2xs text-fg-faint',
                  d.esHoy &&
                    'text-accent shadow-[inset_0_0_0_2px_rgb(var(--accent)),0_0_16px_rgb(var(--accent)/0.3)]',
                )}
              >
                {d.dia}
                <Carita nivel={d.nivel} />
                <b className="text-sm text-fg">{d.numero}</b>
              </button>
            ))}
          </div>
          <TextoCarga semana={panel.semana} />
        </section>
      )}

      {/* Compromisos */}
      {panel && (
        <section className="vidrio rounded-3xl p-4 flex flex-col gap-3" aria-label="Compromisos">
          <Etiqueta>Compromisos · esta semana</Etiqueta>
          <div className="flex items-center gap-4">
            <div
              role="img"
              aria-label={`${pct ?? 0} por ciento cumplido`}
              className="w-20 h-20 rounded-full grid place-items-center shrink-0"
              style={{
                background: `conic-gradient(from -90deg, rgb(var(--a-600)), rgb(61 107 255) ${pct ?? 0}%, rgb(var(--surface-2)) ${pct ?? 0}%)`,
              }}
            >
              <span className="w-16 h-16 rounded-full bg-panel grid place-items-center text-lg font-extrabold text-fg">
                {pct ?? 0}%
              </span>
            </div>
            <p className="text-sm text-fg-muted leading-relaxed">
              {panel.cumplidos} de {panel.total} cumplidos
              <br />
              meta <b className="text-warning">{panel.meta}%</b>
              {panel.pendientes.length > 0 && ` · faltan ${panel.pendientes.length}`}
            </p>
          </div>
          {panel.pendientes.length > 0 && (
            <ul className="divide-y divide-border">
              {panel.pendientes.slice(0, 4).map((c) => {
                const f = fechaRelativa(c.due_date)
                const vencida = f.tone === 'late'
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => navigate('/activities', { state: { activityId: c.id } })}
                      className="w-full flex items-center justify-between gap-2 py-2 text-left text-sm hover:text-accent"
                    >
                      <span className="truncate">{c.title}</span>
                      <span
                        className={cx(
                          'shrink-0 text-2xs font-bold px-2 py-0.5 rounded-full',
                          vencida ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning',
                        )}
                      >
                        {vencida ? 'vencida' : f.text}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <button
            type="button"
            onClick={() => navigate('/compromisos')}
            className="self-start text-xs font-bold text-accent hover:underline"
          >
            Abrir Compromisos
          </button>
        </section>
      )}
    </aside>
  )
}

export function Carita({ nivel, size = 22 }: { nivel: NivelCarga; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="relative inline-block rounded-full"
      style={{ width: size, height: size, background: CARITA[nivel].fondo }}
    >
      <i
        className="absolute bg-white/95 rounded-sm"
        style={{ top: size * 0.32, left: size * 0.27, width: size * 0.16, height: size * 0.2 }}
      />
      <i
        className="absolute bg-white/95 rounded-sm"
        style={{ top: size * 0.32, right: size * 0.27, width: size * 0.16, height: size * 0.2 }}
      />
    </span>
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
