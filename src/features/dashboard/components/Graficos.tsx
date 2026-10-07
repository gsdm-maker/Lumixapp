import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cx } from '@shared/utils/cx'
import type { CompromisoSemana, Rendimiento } from '@features/dashboard/utils/metricas'

// Graficos del dashboard en SVG propio: son tres y simples, una libreria de graficos pesaria
// mas que todo el modulo. Se dibujan al ancho real del contenedor (no con viewBox escalado)
// para que el texto de los ejes mida lo mismo en el celular y en el escritorio.

const ALTO = 200
const EJE_X = 22 // espacio para las etiquetas de semana
const ARRIBA = 10

/** Ancho real del contenedor, actualizado al cambiar el tamano de la ventana. */
function useAncho<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [ancho, setAncho] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new ResizeObserver(([e]) => setAncho(Math.round(e.contentRect.width)))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return [ref, ancho] as const
}

/** Lineas guia horizontales con su valor a la izquierda. */
function Guias({
  valores,
  y,
  izq,
  ancho,
  formato = String,
}: {
  valores: number[]
  y: (v: number) => number
  izq: number
  ancho: number
  formato?: (v: number) => string
}) {
  return (
    <g aria-hidden="true">
      {valores.map((v) => (
        <g key={v}>
          <line x1={izq} x2={ancho} y1={y(v)} y2={y(v)} className="stroke-border" />
          <text x={izq - 6} y={y(v) + 4} textAnchor="end" className="fill-fg-faint text-2xs">
            {formato(v)}
          </text>
        </g>
      ))}
    </g>
  )
}

/** Hasta 4 marcas "redondas" (0, 5, 10...) que cubren el maximo. */
function marcas(max: number): number[] {
  const paso = [1, 2, 5, 10, 20, 25, 50, 100].find((p) => max / p <= 4) ?? Math.ceil(max / 4)
  const tope = Math.max(paso, Math.ceil(max / paso) * paso)
  return Array.from({ length: tope / paso + 1 }, (_, i) => i * paso)
}

/** Completadas (verde) contra creadas (gris) por semana. */
export function BarrasRendimiento({ datos }: { datos: Rendimiento[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const guias = marcas(Math.max(1, ...datos.map((d) => Math.max(d.completadas, d.creadas))))
  const max = guias.at(-1)!
  const izq = 28
  const y = (v: number) => ARRIBA + (ALTO - ARRIBA - EJE_X) * (1 - v / max)
  const resumen = datos.map((d) => `${d.label}: ${d.completadas} de ${d.creadas}`).join(', ')
  const tip = (ancho: number) => {
    if (hover === null) return null
    const col = (ancho - izq) / datos.length
    const d = datos[hover]
    return {
      x: izq + col * hover + col / 2,
      texto: `${d.label} · ${d.completadas} completadas · ${d.creadas} creadas`,
    }
  }
  return (
    <AnchoConTip label={`Completadas y creadas por semana. ${resumen}`} tip={tip}>
      {(ancho) => {
        const col = (ancho - izq) / datos.length
        const barra = Math.max(4, Math.min(18, col / 3))
        return (
          <>
            <Guias valores={guias} y={y} izq={izq} ancho={ancho} />
            {datos.map((d, i) => {
              const cx0 = izq + col * i + col / 2
              return (
                <g
                  key={d.label}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                >
                  <rect
                    x={izq + col * i}
                    y={ARRIBA}
                    width={col}
                    height={ALTO - ARRIBA - EJE_X}
                    className={cx('fill-transparent', hover === i && 'fill-surface')}
                  />
                  <rect
                    x={cx0 - barra - 1.5}
                    y={y(d.creadas)}
                    width={barra}
                    height={y(0) - y(d.creadas)}
                    rx={3}
                    className="fill-border-strong"
                  />
                  <rect
                    x={cx0 + 1.5}
                    y={y(d.completadas)}
                    width={barra}
                    height={y(0) - y(d.completadas)}
                    rx={3}
                    className="fill-tag-green"
                  />
                  {(col >= 34 || i % 2 === datos.length % 2 || i === datos.length - 1) && (
                    <text
                      x={cx0}
                      y={ALTO - 6}
                      textAnchor="middle"
                      className={cx(
                        'text-2xs',
                        i === datos.length - 1 ? 'fill-fg font-medium' : 'fill-fg-faint',
                      )}
                    >
                      {d.label}
                    </text>
                  )}
                </g>
              )
            })}
          </>
        )
      }}
    </AnchoConTip>
  )
}

/** % semanal de compromisos cumplidos, con la meta punteada. */
export function LineaCompromisos({ datos, meta }: { datos: CompromisoSemana[]; meta: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const valores = datos.map((d) => d.porcentaje).filter((v): v is number => v !== null)
  // El piso baja si alguna semana estuvo muy por debajo; si no, se ve el detalle entre 60 y 100.
  const min = Math.min(60, Math.floor(Math.min(100, ...valores) / 20) * 20)
  const guias = Array.from({ length: (100 - min) / 10 + 1 }, (_, i) => min + i * 10).filter(
    (v, _, arr) => arr.length <= 6 || v % 20 === 0,
  )
  const izq = 34
  const y = (v: number) => ARRIBA + (ALTO - ARRIBA - EJE_X) * (1 - (v - min) / (100 - min))
  const x = (ancho: number, i: number) =>
    izq + 8 + ((ancho - izq - 16) / Math.max(1, datos.length - 1)) * i
  const resumen = datos.map((d) => `${d.label}: ${d.porcentaje ?? 'sin compromisos'}`).join(', ')
  const tip = (ancho: number) => {
    if (hover === null) return null
    const d = datos[hover]
    return {
      x: x(ancho, hover),
      texto:
        d.porcentaje === null
          ? `${d.label} · sin compromisos`
          : `${d.label} · ${d.porcentaje}% (${d.cumplidos} de ${d.total})`,
    }
  }

  if (valores.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-fg-faint">
        Aún no hay compromisos con fecha en estas semanas.
      </p>
    )
  }

  return (
    <AnchoConTip label={`Cumplimiento semanal de compromisos, meta ${meta}%. ${resumen}`} tip={tip}>
      {(ancho) => {
        const pts = datos.map((d, i) =>
          d.porcentaje === null ? null : ([x(ancho, i), y(d.porcentaje)] as const),
        )
        const linea = pts.filter(Boolean) as (readonly [number, number])[]
        const area =
          linea.length > 1
            ? `M${linea.map((p) => p.join(',')).join(' L')} L${linea.at(-1)![0]},${y(min)} L${linea[0][0]},${y(min)} Z`
            : ''
        const cada = Math.ceil(datos.length / Math.max(1, Math.floor((ancho - izq) / 44)))
        return (
          <>
            <Guias valores={guias} y={y} izq={izq} ancho={ancho} formato={(v) => `${v}%`} />
            <line
              x1={izq}
              x2={ancho}
              y1={y(meta)}
              y2={y(meta)}
              strokeDasharray="4 4"
              strokeWidth={1.25}
              className="stroke-fg-muted"
            />
            <text x={ancho} y={y(meta) - 5} textAnchor="end" className="fill-fg-muted text-2xs">
              meta {meta}%
            </text>
            {area && <path d={area} className="fill-tag-violet-soft" opacity={0.8} />}
            <polyline
              points={linea.map((p) => p.join(',')).join(' ')}
              fill="none"
              strokeWidth={2.25}
              strokeLinejoin="round"
              strokeLinecap="round"
              className="stroke-tag-violet"
            />
            {datos.map((d, i) => {
              const p = pts[i]
              const ultima = i === datos.length - 1
              return (
                <g
                  key={d.label}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                >
                  <rect
                    x={x(ancho, i) - 14}
                    y={ARRIBA}
                    width={28}
                    height={ALTO - ARRIBA - EJE_X}
                    className="fill-transparent"
                  />
                  {p && (
                    <circle
                      cx={p[0]}
                      cy={p[1]}
                      r={ultima || hover === i ? 5 : 3.5}
                      strokeWidth={2}
                      className={cx(
                        'stroke-panel',
                        d.porcentaje! >= meta
                          ? 'fill-tag-green'
                          : ultima
                            ? 'fill-tag-amber'
                            : 'fill-tag-violet',
                      )}
                    />
                  )}
                  {(datos.length - 1 - i) % cada === 0 && (
                    <text
                      x={x(ancho, i)}
                      y={ALTO - 6}
                      textAnchor="middle"
                      className={cx('text-2xs', ultima ? 'fill-fg font-medium' : 'fill-fg-faint')}
                    >
                      {d.label}
                    </text>
                  )}
                </g>
              )
            })}
          </>
        )
      }}
    </AnchoConTip>
  )
}

/** Marco comun: mide el ancho, dibuja y muestra el globo del punto bajo el mouse. */
function AnchoConTip({
  label,
  tip,
  children,
}: {
  label: string
  tip: (ancho: number) => { x: number; texto: string } | null
  children: (ancho: number) => ReactNode
}) {
  const [ref, ancho] = useAncho<HTMLDivElement>()
  const globo = ancho > 0 ? tip(ancho) : null
  return (
    <div ref={ref} className="relative">
      {ancho > 0 && (
        <svg
          width={ancho}
          height={ALTO}
          role="img"
          aria-label={label}
          className="block overflow-visible"
        >
          {children(ancho)}
        </svg>
      )}
      {globo && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-fg px-2 py-1 text-xs text-panel shadow-md"
          style={{ left: Math.min(Math.max(globo.x, 90), ancho - 90) }}
        >
          {globo.texto}
        </div>
      )}
    </div>
  )
}

/** Mini curva de las ultimas semanas, para los indicadores. */
export function Sparkline({ serie, className }: { serie: number[]; className?: string }) {
  const W = 96
  const H = 28
  const max = Math.max(...serie)
  const min = Math.min(...serie)
  const rango = max - min || 1
  const puntos = serie
    .map(
      (v, i) =>
        `${(W / Math.max(1, serie.length - 1)) * i},${3 + (H - 6) * (1 - (v - min) / rango)}`,
    )
    .join(' ')
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden="true"
      className={cx('w-24 h-7 shrink-0 overflow-visible', className)}
    >
      <polyline
        points={puntos}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
