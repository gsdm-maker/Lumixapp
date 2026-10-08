// Vista Lista del detalle de proyecto: arbol de actividades y subtareas en filas compactas.
//
// Una fila = caret, prioridad, titulo, subtareas, estado, responsables, termino y avance, en
// columnas alineadas para poder recorrerlas con la vista (antes era una pastilla por dato y una
// segunda linea de metadatos con emojis). En el celular la fila pasa a dos lineas.

import { useState } from 'react'
import type { DecoratedItem } from '@features/minuta/hooks/useMinuta'
import { plazoEfectivo, avanceDe } from '@features/minuta/utils/subtareas'
import { Avatar } from '@shared/components/ui/Avatar'
import { Icon } from '@shared/components/ui/Icon'
import { StatusLabel } from '@shared/components/ui/StatusLabel'
import { DueDate, PriorityBars, ProgressBar } from '@shared/components/ui/Indicators'
import { cx } from '@shared/utils/cx'
import { estadoItem, plural } from '@features/proyectos/utils/proyecto'

// Mismas columnas en el encabezado y en cada fila.
const COLUMNAS = 'sm:grid sm:grid-cols-[minmax(0,1fr)_9.5rem_5rem_4.5rem_6.5rem] sm:gap-x-3'

interface ListaViewProps {
  proyectoId: string
  allItems: DecoratedItem[]
  memberName: (id: string) => string
  selectedId: string | null
  onOpen: (itemId: string) => void
}

export function ListaView({
  proyectoId,
  allItems,
  memberName,
  selectedId,
  onOpen,
}: ListaViewProps) {
  return (
    <div className="lamina overflow-hidden">
      <div
        className={cx(
          'hidden items-center px-3 py-2 border-b border-border text-2xs font-semibold uppercase tracking-wide text-fg-faint',
          COLUMNAS,
        )}
      >
        <span className="pl-6">Actividad</span>
        <span>Estado</span>
        <span>Responsables</span>
        <span>Término</span>
        <span>Avance</span>
      </div>
      <Ramas
        parentId={proyectoId}
        allItems={allItems}
        depth={0}
        memberName={memberName}
        selectedId={selectedId}
        onOpen={onOpen}
      />
    </div>
  )
}

function Ramas({
  parentId,
  depth,
  ...rest
}: Omit<ListaViewProps, 'proyectoId'> & { parentId: string; depth: number }) {
  const hijos = rest.allItems.filter((d) => d.parent_item_id === parentId)
  return (
    <>
      {hijos.map((it) => (
        <Fila key={it.id} item={it} depth={depth} {...rest} />
      ))}
    </>
  )
}

function Fila({
  item,
  depth,
  allItems,
  memberName,
  selectedId,
  onOpen,
}: Omit<ListaViewProps, 'proyectoId'> & { item: DecoratedItem; depth: number }) {
  // Colapsado por defecto: revelar bajo demanda en vez de mostrar todo el arbol de una.
  const [expandido, setExpandido] = useState(false)
  const hijos = allItems.filter((d) => d.parent_item_id === item.id)
  const tieneHijos = hijos.length > 0
  const fin = plazoEfectivo(item, allItems)
  const avance = tieneHijos ? avanceDe(item, allItems) : null
  const estado = estadoItem(item, allItems)
  const resuelto = item.effectiveEstado === 'resuelto'

  return (
    <>
      <div
        onClick={() => onOpen(item.id)}
        className={cx(
          'items-center px-3 py-1.5 border-b border-border last:border-b-0 cursor-pointer text-sm',
          COLUMNAS,
          selectedId === item.id ? 'bg-surface' : 'hover:bg-surface',
        )}
      >
        {/* Titulo: la sangria marca el nivel del arbol. */}
        <div className="flex items-center gap-2 min-w-0" style={{ paddingLeft: depth * 20 }}>
          <button
            type="button"
            onClick={(e) => {
              // El caret SOLO expande/colapsa; abrir el detalle es tocar el resto de la fila.
              e.stopPropagation()
              setExpandido((v) => !v)
            }}
            aria-expanded={tieneHijos ? expandido : undefined}
            aria-label={expandido ? 'Ocultar subtareas' : 'Mostrar subtareas'}
            className={cx(
              'w-5 h-5 -ml-0.5 flex items-center justify-center rounded text-fg-faint hover:text-fg hover:bg-surface-2',
              !tieneHijos && 'invisible',
            )}
          >
            <Icon
              name="chevronRight"
              size={14}
              className={cx('transition-transform', expandido && 'rotate-90')}
            />
          </button>
          {item.prioridad ? (
            <PriorityBars priority={item.prioridad} />
          ) : (
            <span className="w-[13px]" aria-hidden="true" />
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onOpen(item.id)
            }}
            className={cx(
              'min-w-0 truncate text-left',
              resuelto
                ? 'text-fg-faint line-through'
                : depth > 0
                  ? 'text-fg-body'
                  : 'text-fg font-medium',
            )}
          >
            {item.tema || <span className="text-fg-faint italic">Sin nombre</span>}
          </button>
          {tieneHijos && (
            <span className="shrink-0 text-xs text-fg-faint hidden sm:inline">
              {plural(hijos.length, 'subtarea', 'subtareas')}
            </span>
          )}
        </div>

        {/* Movil: segunda linea con lo esencial. */}
        <div
          className="sm:hidden mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-fg-muted"
          style={{ paddingLeft: depth * 20 + 46 }}
        >
          <StatusLabel {...estado} />
          {fin && <DueDate date={fin} done={resuelto} />}
          {avance !== null && <span className="tabular-nums">{avance}%</span>}
          {tieneHijos && (
            <span className="text-fg-faint">{plural(hijos.length, 'subtarea', 'subtareas')}</span>
          )}
        </div>

        <div className="hidden sm:block min-w-0">
          <StatusLabel {...estado} />
        </div>
        <div className="hidden sm:block">
          <Responsables ids={item.responsables} memberName={memberName} />
        </div>
        <div className="hidden sm:block text-xs">
          {fin ? <DueDate date={fin} done={resuelto} /> : <span className="text-fg-faint">—</span>}
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs">
          {avance !== null ? (
            <>
              <span className="tabular-nums text-fg-muted w-8">{avance}%</span>
              <ProgressBar value={avance} className="w-12" label={`Avance ${avance}%`} />
            </>
          ) : (
            <span className="text-fg-faint">—</span>
          )}
        </div>
      </div>
      {expandido && (
        <Ramas
          parentId={item.id}
          depth={depth + 1}
          allItems={allItems}
          memberName={memberName}
          selectedId={selectedId}
          onOpen={onOpen}
        />
      )}
    </>
  )
}

/** Avatares apilados (hasta 3) con el resto como "+N"; los nombres en el tooltip. */
export function Responsables({
  ids,
  memberName,
}: {
  ids: string[]
  memberName: (id: string) => string
}) {
  if (ids.length === 0) return <span className="text-xs text-fg-faint">—</span>
  const visibles = ids.slice(0, 3)
  return (
    <span className="inline-flex items-center" title={ids.map(memberName).join(', ')}>
      {visibles.map((id, i) => (
        <Avatar
          key={id}
          name={memberName(id)}
          size="xs"
          className={cx(i > 0 && '-ml-1.5', 'ring-2 ring-panel')}
        />
      ))}
      {ids.length > 3 && <span className="ml-1 text-xs text-fg-faint">+{ids.length - 3}</span>}
    </span>
  )
}
