import { useState } from 'react'
import { Modal } from '@shared/components/ui/Modal'
import { SegmentedControl } from '@shared/components/ui/SegmentedControl'
import { cx } from '@shared/utils/cx'
import { formatDateLocal, parseDateLocal } from '@shared/utils/date'
import { MINUTE_ESTADO, type StatusTone } from '@shared/utils/estados'
import type { DecoratedItem } from '@features/minuta/hooks/useMinuta'
import { plazoEfectivo, avanceDe } from '@features/minuta/utils/subtareas'
import type { MinuteEstado } from '@shared/types'

// Color de la barra por estado, derivado del MISMO tono que usa <StatusLabel> (estados.ts):
// asi el Cronograma, la Lista y el Tablero de Proyectos dicen lo mismo con el mismo color, y
// todo cambia junto con el tema claro/oscuro y el acento (antes eran amber/blue/emerald fijos).
const RELLENO: Partial<Record<StatusTone, string>> = {
  idle: 'bg-fg-faint',
  progress: 'bg-accent',
  done: 'bg-success',
  discuss: 'bg-warning',
}
// Fondo tenue de la barra: el color solido de arriba es solo la franja de AVANCE (`avanceDe`).
// Sin esto, una tarea al 20% se veia identica a una al 90%.
const FONDO: Partial<Record<StatusTone, string>> = {
  idle: 'bg-fg-faint/15',
  progress: 'bg-accent/15',
  done: 'bg-success/15',
  discuss: 'bg-warning/15',
}

const relleno = (e: MinuteEstado) => RELLENO[MINUTE_ESTADO[e].tone] ?? 'bg-fg-faint'
const fondo = (e: MinuteEstado) => FONDO[MINUTE_ESTADO[e].tone] ?? 'bg-fg-faint/15'

type ZoomGantt = 'dia' | 'semana' | 'mes'
const DIA_MS = 86_400_000

/**
 * Contenido del Cronograma (Gantt), sin el `Modal` que lo envolvia -Proyectos lo usa como
 * pestaña de pantalla completa; `GanttModal` (mas abajo) lo envuelve para el uso puntual de
 * Minuta. Barras reales (inicio-fin) cuando la tarea tiene `fecha_inicio` (migracion 047); si
 * no la tiene, se muestra un punto en la entrega, honesto sobre el dato que existe. Cada barra
 * ademas muestra una franja de avance real (subtareas resueltas), y un zoom Dia/Semana/Mes
 * cambia el tamaño de los tramos del eje.
 */
export function GanttChart({
  root,
  allItems,
  memberName,
  onOpen,
}: {
  root: DecoratedItem
  allItems: DecoratedItem[]
  memberName?: (id: string) => string
  // Click en una barra/fila abre el mismo panel de detalle que Lista/Tablero (Proyectos). En
  // Minuta (GanttModal) no se pasa: las barras quedan de solo lectura, como antes.
  onOpen?: (itemId: string) => void
}) {
  const [zoom, setZoom] = useState<ZoomGantt>('semana')

  const nodes: { item: DecoratedItem; depth: number }[] = []
  const walk = (id: string, depth: number) => {
    const item = allItems.find((d) => d.id === id)
    if (!item) return
    nodes.push({ item, depth })
    allItems.filter((d) => d.parent_item_id === id).forEach((c) => walk(c.id, depth + 1))
  }
  walk(root.id, 0)

  const toTime = (f: string) => parseDateLocal(f).getTime()
  const fechas = nodes
    .flatMap((n) => [plazoEfectivo(n.item, allItems), n.item.fecha_inicio])
    .filter((f): f is string => !!f)
    .map(toTime)
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const min = fechas.length ? Math.min(...fechas, hoy.getTime()) : hoy.getTime()
  const maxRaw = fechas.length ? Math.max(...fechas, hoy.getTime()) : hoy.getTime() + 7 * DIA_MS
  // Al menos 1 dia de rango: si todo vence el mismo dia, evita dividir por cero.
  const span = Math.max(maxRaw - min, DIA_MS)
  const pctDeHoy = ((hoy.getTime() - min) / span) * 100

  const pct = (f: string) => Math.min(100, Math.max(0, ((toTime(f) - min) / span) * 100))

  // Cabecera del eje: tramos reales desde `min`, en columnas de ancho IGUAL -sin eso, una
  // etiqueta cerca del borde derecho no tenia espacio propio y se salia/superponia (bug real
  // reportado). El tamaño del tramo lo decide el zoom.
  const tramoMs = zoom === 'dia' ? DIA_MS : zoom === 'mes' ? 30 * DIA_MS : 7 * DIA_MS
  const mes = (d: Date, opts: Intl.DateTimeFormatOptions = { month: 'short' }) =>
    d.toLocaleDateString('es-CL', opts).replace('.', '')
  const tramos: string[] = []
  for (let cursor = min; cursor < maxRaw; cursor += tramoMs) {
    const ini = new Date(cursor)
    const fin = new Date(Math.min(cursor + tramoMs - DIA_MS, maxRaw))
    tramos.push(
      zoom === 'dia'
        ? `${ini.getDate()} ${mes(ini)}`
        : zoom === 'mes'
          ? mes(ini, { month: 'short', year: '2-digit' })
          : `${ini.getDate()}–${fin.getDate()} ${mes(fin)}`,
    )
  }

  const abrible = onOpen ? 'cursor-pointer' : ''

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-fg-faint max-w-prose">
          Con fecha de inicio, la barra va de inicio a entrega y la franja inferior marca el avance.
          Sin fecha de inicio, se muestra un punto en la entrega.
        </p>
        <SegmentedControl<ZoomGantt>
          label="Escala del cronograma"
          value={zoom}
          onChange={setZoom}
          options={[
            { value: 'dia', label: 'Día' },
            { value: 'semana', label: 'Semana' },
            { value: 'mes', label: 'Mes' },
          ]}
        />
      </div>
      {/* Dos columnas independientes con alto FIJO por fila (h-9) -seguro porque cada
          etiqueta mide maximo 2 lineas (tema + responsable): la fecha de inicio se edita desde
          el panel de detalle, no aca, para no romper esta alineacion (bug real reportado). */}
      <div className="overflow-x-auto">
        <div className="grid grid-cols-[160px_1fr] min-w-[600px] rounded-lg border border-border bg-panel p-3">
          {/* Columna de nombres */}
          <div className="flex flex-col gap-1 border-r border-border pr-3">
            <div className="h-6" />
            {nodes.map(({ item, depth }) => (
              <div
                key={item.id}
                className={cx('h-9 flex flex-col justify-center min-w-0', abrible)}
                style={{ paddingLeft: depth * 10 }}
                onClick={() => onOpen?.(item.id)}
              >
                <span
                  className={cx(
                    'text-xs truncate',
                    depth === 0 ? 'font-medium text-fg' : 'text-fg-body',
                  )}
                >
                  {item.tema}
                </span>
                {memberName && item.responsables.length > 0 && (
                  <span className="text-2xs text-fg-faint truncate">
                    {item.responsables.map(memberName).join(', ')}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Columna de linea de tiempo */}
          <div className="relative pl-3 min-w-0">
            <div className="grid grid-flow-col auto-cols-fr h-6 items-end pb-1 border-b border-border">
              {tramos.map((t, i) => (
                <span key={i} className="text-2xs text-fg-faint truncate">
                  {t}
                </span>
              ))}
            </div>
            <div className="relative flex flex-col gap-1">
              {/* Una sola linea de "Hoy" para todo el bloque, no una por fila. */}
              {pctDeHoy >= 0 && pctDeHoy <= 100 && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-accent z-[1] pointer-events-none"
                  style={{ left: `${pctDeHoy}%` }}
                  title="Hoy"
                />
              )}
              {nodes.map(({ item }) => {
                const fin = plazoEfectivo(item, allItems)
                const inicio = item.fecha_inicio
                const hayBarra = !!inicio && !!fin && toTime(inicio) <= toTime(fin)
                const anchoBarra = hayBarra
                  ? Math.min(Math.max(pct(fin!) - pct(inicio!), 6), 100 - pct(inicio!))
                  : 0
                const avance = avanceDe(item, allItems)
                return (
                  <div key={item.id} className="h-9 relative">
                    {hayBarra ? (
                      <div
                        className={cx(
                          'absolute top-2 h-5 rounded-sm overflow-hidden',
                          fondo(item.effectiveEstado),
                          abrible,
                        )}
                        style={{ left: `${pct(inicio!)}%`, width: `${anchoBarra}%` }}
                        title={`${formatDateLocal(inicio!)} → ${formatDateLocal(fin!)} · ${avance}%`}
                        onClick={() => onOpen?.(item.id)}
                      >
                        <span className="relative flex items-center h-full px-2 text-2xs font-medium text-fg whitespace-nowrap">
                          {item.tema}
                        </span>
                        <div
                          className={cx(
                            'absolute bottom-0 left-0 h-1',
                            relleno(item.effectiveEstado),
                          )}
                          style={{ width: `${avance}%` }}
                        />
                      </div>
                    ) : (
                      fin && (
                        <div
                          className={cx(
                            'absolute top-3.5 h-2 w-2 rounded-full',
                            relleno(item.effectiveEstado),
                            abrible,
                          )}
                          style={{ left: `calc(${pct(fin)}% - 4px)` }}
                          title={formatDateLocal(fin)}
                          onClick={() => onOpen?.(item.id)}
                        />
                      )
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-2xs text-fg-faint">
        {(Object.keys(MINUTE_ESTADO) as MinuteEstado[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={cx('w-2.5 h-2.5 rounded-sm', relleno(s))} />
            {MINUTE_ESTADO[s].label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="w-px h-3 bg-accent" />
          Hoy
        </span>
      </div>
    </div>
  )
}

/** Envoltorio en `Modal` de `GanttChart`, para el "Ver cronograma" puntual de un tema con
 * subtareas (Minuta) -ahi si tiene sentido un dialogo, a diferencia del Cronograma de
 * Proyectos, que es una pestaña de pantalla completa (ver `ProyectoDetailPage.tsx`). */
export function GanttModal({
  root,
  allItems,
  onClose,
  memberName,
}: {
  root: DecoratedItem
  allItems: DecoratedItem[]
  onClose: () => void
  memberName?: (id: string) => string
}) {
  return (
    <Modal open onClose={onClose} title={`Cronograma: ${root.tema}`} size="xl">
      <GanttChart root={root} allItems={allItems} memberName={memberName} />
    </Modal>
  )
}
