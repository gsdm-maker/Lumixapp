// Mini linea de tiempo por fila de la lista de Proyectos (idea 12 de la propuesta UI/UX).
//
// Todas las filas comparten la MISMA escala (EscalaTiempo): asi se ve de un vistazo que
// proyecto va atrasado respecto del calendario, no solo cuantas tareas tiene vencidas.

import { cx } from '@shared/utils/cx'
import { formatDateLocal } from '@shared/utils/date'
import type { EscalaTiempo } from '@features/proyectos/utils/proyecto'

/** Encabezado de la columna: nombres de los meses ubicados sobre la misma escala. */
export function TimelineMeses({ escala }: { escala: EscalaTiempo }) {
  // Con muchos meses los nombres se pisan: se rotula uno de cada N.
  const paso = Math.ceil(escala.meses.length / 6)
  return (
    <div className="relative h-4 w-full">
      {escala.meses.map((m, i) =>
        i % paso === 0 ? (
          <span
            key={`${m.label}-${i}`}
            style={{ left: `${m.left}%` }}
            className="absolute top-0 pl-1 border-l border-border text-2xs font-normal normal-case tracking-normal text-fg-faint"
          >
            {m.label}
          </span>
        ) : null,
      )}
    </div>
  )
}

export function ProjectTimelineCell({
  escala,
  inicio,
  fin,
  avance,
  atrasado,
}: {
  escala: EscalaTiempo
  inicio: string | null
  fin: string | null
  avance: number | null
  /** Pinta el avance en rojo: el proyecto tiene trabajo vencido. */
  atrasado: boolean
}) {
  const rango = `${inicio ? formatDateLocal(inicio, 'short') : 'sin inicio'} → ${
    fin ? formatDateLocal(fin, 'short') : 'sin término'
  }`

  // Con una sola fecha no hay tramo que dibujar: se marca ese dia con un punto.
  const unaFecha = !inicio || !fin ? (inicio ?? fin) : null
  const left = inicio && fin ? escala.pos(inicio) : 0
  const right = inicio && fin ? escala.pos(fin) : 0
  // Un tramo de un dia igual tiene que verse.
  const width = Math.max(right - left, 1.5)

  return (
    <div className="relative h-3.5 w-full" title={rango} aria-label={`Fechas: ${rango}`}>
      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
      {inicio && fin && (
        <span
          style={{ left: `${left}%`, width: `${width}%` }}
          className="absolute top-[3px] h-2 rounded-[2px] bg-border-strong overflow-hidden"
        >
          <i
            style={{ width: `${avance ?? 0}%` }}
            className={cx('block h-full', atrasado ? 'bg-danger' : 'bg-fg-muted')}
          />
        </span>
      )}
      {unaFecha && (
        <span
          style={{ left: `${escala.pos(unaFecha)}%` }}
          className="absolute top-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg-muted"
        />
      )}
      <span
        style={{ left: `${escala.hoy}%` }}
        className="absolute inset-y-0 w-px bg-accent"
        aria-hidden="true"
      />
    </div>
  )
}
