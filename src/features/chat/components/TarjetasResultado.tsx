import { useNavigate } from 'react-router-dom'
import { cx } from '@shared/utils/cx'
import type { Tarjeta } from '@features/chat/agente/tipos'

// Cabecera de color solido por tipo de resultado (texto blanco: cada color da >= 4.5 de contraste).
const CABECERA: Record<Tarjeta['tono'], string> = {
  violeta: '#5b3fd9',
  verde: '#0b7a4f',
  ambar: '#9a5800',
  rojo: '#b23a29',
}

/**
 * Lo que el agente dejo hecho, como tarjetas con cabecera de color (rediseno Orbita): asignada,
 * hecho, movida, vencida... Cada una lleva a lo suyo: la actividad o la hoja.
 */
export function TarjetasResultado({ tarjetas }: { tarjetas: Tarjeta[] }) {
  const navigate = useNavigate()
  if (!tarjetas.length) return null
  const abrir = (t: Tarjeta) =>
    t.activityId
      ? navigate('/activities', { state: { activityId: t.activityId } })
      : t.ruta && navigate(t.ruta)
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {tarjetas.map((t, i) => (
        <button
          key={`${t.etiqueta}-${t.titulo}-${i}`}
          type="button"
          onClick={() => abrir(t)}
          disabled={!t.activityId && !t.ruta}
          className={cx(
            'flex flex-col text-left rounded-2xl overflow-hidden border border-border bg-surface-soft transition-colors',
            (t.activityId || t.ruta) && 'hover:border-border-strong cursor-pointer',
          )}
        >
          <span
            className="flex items-center justify-between gap-2 px-3 py-1 text-2xs font-semibold text-white"
            style={{ background: CABECERA[t.tono] }}
          >
            <span>{t.etiqueta}</span>
            {t.valor && <span>{t.valor}</span>}
          </span>
          <span className="flex flex-col gap-0.5 px-3 py-2">
            <b className="text-sm font-semibold text-fg line-clamp-2">{t.titulo}</b>
            {t.detalle && <span className="text-xs text-fg-faint">{t.detalle}</span>}
          </span>
        </button>
      ))}
    </div>
  )
}
