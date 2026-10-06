// Campos editables de un tema (responsable, estado, plazo), los mismos en la tabla, el panel
// de detalle y el modo reunion. Antes cada vista repetia el mismo bloque con estilos propios
// (tabla y tarjeta movil tenian ~150 lineas duplicadas que ya habian empezado a divergir).
//
// Patron: se VE el dato como en una celda de solo lectura (StatusLabel, DueDate, nombre) y el
// control nativo queda encima, invisible, recibiendo el clic. Asi una tabla con 30 filas no se
// llena de selects y cajitas, pero cada celda sigue editable con un toque, como antes.

import type { ReactNode } from 'react'
import { DatePicker } from '@shared/components/ui/DatePicker'
import { MemberMultiSelect } from '@shared/components/ui/MemberMultiSelect'
import { DueDate } from '@shared/components/ui/Indicators'
import { StatusLabel } from '@shared/components/ui/StatusLabel'
import { cx } from '@shared/utils/cx'
import { formatDateLocal } from '@shared/utils/date'
import { INGESTA_ESTADO, MINUTE_ESTADO } from '@shared/utils/estados'
import type { DecoratedItem } from '@features/minuta/hooks/useMinuta'
import { plazoEfectivo } from '@features/minuta/utils/subtareas'
import { responsablesLabel } from '@features/minuta/utils/temas'
import type { EstadoIngesta, MinuteEstado, MinuteItem, Profile } from '@shared/types'

// Caja que se marca al pasar o enfocar: dice "esto se puede cambiar" sin dibujar un campo.
const EDITABLE =
  'relative inline-flex items-center min-h-7 max-w-full px-1.5 -mx-1.5 rounded-md border border-transparent hover:border-border-strong hover:bg-surface focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20'

// El control nativo encima del texto visible, transparente. Ocupa toda la caja.
const CAPA = 'absolute inset-0 w-full h-full opacity-0 cursor-pointer'

/** Plazo: fecha en palabras (DueDate); al tocarla abre el selector de fecha de siempre. */
export function PlazoCampo({
  item,
  allItems,
  canEdit,
  onChange,
  done = false,
  vacio = 'Sin plazo',
}: {
  item: DecoratedItem
  allItems: DecoratedItem[]
  canEdit: boolean
  onChange: (v: string | null) => void
  done?: boolean
  vacio?: string
}) {
  const visible = item.plazo ? (
    <DueDate date={item.plazo} done={done} className="text-sm" />
  ) : (
    <span className="text-sm text-fg-faint">{canEdit ? 'Agregar' : vacio}</span>
  )
  const derivado = !item.plazo ? plazoEfectivo(item, allItems) : null
  return (
    <div className="min-w-0">
      {canEdit ? (
        <span className={EDITABLE}>
          {visible}
          <DatePicker
            value={item.plazo}
            onChange={onChange}
            placeholder="Agregar plazo"
            className={CAPA}
          />
        </span>
      ) : (
        visible
      )}
      {derivado && (
        <span className="block text-xs text-fg-faint" title="La subtarea con el plazo más lejano">
          ≈ {formatDateLocal(derivado, 'short')} por subtareas
        </span>
      )}
      {item.plazo_change_count > 0 && (
        <span
          className="block text-xs text-warning"
          title={item.plazo_history.map((h) => formatDateLocal(h.date)).join(' → ')}
        >
          Movido {item.plazo_change_count} {item.plazo_change_count === 1 ? 'vez' : 'veces'}
        </span>
      )}
    </div>
  )
}

/**
 * Estado. Ingesta usa su propio vocabulario (estado_ingesta), no el de Minuta/Proyecto. En
 * Minuta, si el tema ya tiene actividad vinculada el estado lo manda la actividad
 * (sincronizado) y se muestra de solo lectura.
 */
export function EstadoCampo({
  item,
  esIngesta,
  canEdit,
  onChange,
}: {
  item: DecoratedItem
  esIngesta: boolean
  canEdit: boolean
  onChange: (patch: Partial<MinuteItem>) => void
}) {
  if (esIngesta) {
    const actual = item.estado_ingesta ?? 'no_iniciado'
    const label = <StatusLabel {...INGESTA_ESTADO[actual]} />
    if (!canEdit) return label
    return (
      <span className={EDITABLE}>
        {label}
        <select
          aria-label="Estado de la solicitud"
          value={actual}
          onChange={(e) => onChange({ estado_ingesta: e.target.value as EstadoIngesta })}
          className={CAPA}
        >
          {(Object.keys(INGESTA_ESTADO) as EstadoIngesta[]).map((s) => (
            <option key={s} value={s}>
              {INGESTA_ESTADO[s].label}
            </option>
          ))}
        </select>
      </span>
    )
  }

  const label = <StatusLabel {...MINUTE_ESTADO[item.effectiveEstado]} />
  if (item.linkedActivities.length > 0) {
    return (
      <span title="Sincronizado con las actividades del tema" className="inline-flex min-h-7">
        {label}
      </span>
    )
  }
  if (!canEdit) return label
  return (
    <span className={EDITABLE}>
      {label}
      <select
        aria-label="Estado del tema"
        value={item.estado}
        onChange={(e) => onChange({ estado: e.target.value as MinuteEstado })}
        className={CAPA}
      >
        {(Object.keys(MINUTE_ESTADO) as MinuteEstado[]).map((s) => (
          <option key={s} value={s}>
            {MINUTE_ESTADO[s].label}
          </option>
        ))}
      </select>
    </span>
  )
}

/**
 * Responsable(s). En Ingesta puede ser alguien de OTRO equipo: texto libre
 * (responsables_text) en vez del selector de miembros del equipo activo.
 */
export function ResponsableCampo({
  item,
  esIngesta,
  canEdit,
  members,
  single,
  memberName,
  onChange,
}: {
  item: DecoratedItem
  esIngesta: boolean
  canEdit: boolean
  members: Profile[]
  // Minuta: un tema puntual tiene un solo responsable (ver MinutaPage).
  single: boolean
  memberName: (id: string) => string
  onChange: (patch: Partial<MinuteItem>) => void
}) {
  if (esIngesta) {
    if (!canEdit) return <Texto vacio={!item.responsables_text}>{item.responsables_text}</Texto>
    return (
      <input
        // key: si el valor cambia desde afuera (otro guardado, recarga), el campo no
        // controlado se vuelve a montar con el valor nuevo en vez de quedar con el viejo.
        key={item.responsables_text}
        defaultValue={item.responsables_text}
        onBlur={(e) => {
          if (e.target.value !== item.responsables_text)
            onChange({ responsables_text: e.target.value })
        }}
        aria-label="Responsable"
        placeholder="Nombre y equipo"
        className="w-full h-7 -mx-1.5 px-1.5 rounded-md border border-transparent bg-transparent text-base sm:text-sm text-fg-body placeholder:text-fg-faint hover:border-border-strong hover:bg-surface focus:outline-none focus:border-accent focus:bg-field focus:ring-2 focus:ring-accent/20"
      />
    )
  }
  const label = responsablesLabel(item, memberName)
  if (!canEdit) return <Texto vacio={label === 'Sin asignar'}>{label}</Texto>
  return (
    <MemberMultiSelect
      members={members}
      selected={item.responsables}
      paraTodos={item.para_todos}
      single={single}
      onChange={(next) => onChange(next)}
      className={cx(
        'w-full h-7 -mx-1.5 px-1.5 rounded-md border border-transparent text-left text-sm truncate hover:border-border-strong hover:bg-surface',
        label === 'Sin asignar' ? 'text-fg-faint' : 'text-fg-body',
      )}
    />
  )
}

function Texto({ children, vacio }: { children: ReactNode; vacio: boolean }) {
  return (
    <span className={cx('text-sm', vacio ? 'text-fg-faint' : 'text-fg-body')}>
      {vacio ? 'Sin asignar' : children}
    </span>
  )
}
