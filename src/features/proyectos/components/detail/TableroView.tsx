// Vista Tablero del detalle de proyecto: cuatro columnas por estado, con arrastrar y soltar.
//
// Tarjetas de dos lineas, sin borde de color ni glifos (antes ⠿⠿ y 🔒): el asa es un icono que
// solo aparece cuando la tarjeta se puede mover, y el bloqueo se lee en el estado y el tooltip.

import { useState, type CSSProperties, type ReactNode } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import type { DecoratedItem } from '@features/minuta/hooks/useMinuta'
import { plazoEfectivo } from '@features/minuta/utils/subtareas'
import { Button } from '@shared/components/ui/Button'
import { Icon } from '@shared/components/ui/Icon'
import { StatusLabel } from '@shared/components/ui/StatusLabel'
import { DueDate, PriorityBars } from '@shared/components/ui/Indicators'
import { useToast } from '@shared/components/ui/Toast'
import { MINUTE_ESTADO } from '@shared/utils/estados'
import { cx } from '@shared/utils/cx'
import type { MinuteEstado } from '@shared/types'
import { ESTADOS, descendientes, estadoItem } from '@features/proyectos/utils/proyecto'
import { Responsables } from './ListaView'

// Solo se puede arrastrar una tarjeta que NO tiene actividad vinculada: si la tiene, su
// columna la calcula el estado de esa actividad (deriveEstado), no el campo `estado` propio
// -arrastrarla no tendria un significado claro (¿marcar la actividad completada? ¿volverla a
// pendiente aunque este en curso?). Decision tomada con Sebastian: esas quedan fijas.
const puedeArrastrar = (it: DecoratedItem) => it.linkedActivities.length === 0

const MOTIVO_FIJA = 'Su columna la decide la actividad vinculada; no se puede arrastrar.'

interface TableroViewProps {
  proyectoId: string
  allItems: DecoratedItem[]
  memberName: (id: string) => string
  canAssign: boolean
  selectedId: string | null
  onOpen: (itemId: string) => void
  onAsignar: (itemId: string) => void
  onMover: (itemId: string, estado: MinuteEstado) => Promise<void>
}

export function TableroView({
  proyectoId,
  allItems,
  memberName,
  canAssign,
  selectedId,
  onOpen,
  onAsignar,
  onMover,
}: TableroViewProps) {
  const toast = useToast()
  const [arrastrandoId, setArrastrandoId] = useState<string | null>(null)

  // Touch + mouse con el mismo sensor (Pointer Events unifica los dos). activationConstraint
  // evita que un simple toque (para abrir el detalle) se confunda con un arrastre -hace falta
  // moverse 8px antes de que empiece a arrastrar de verdad.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const todos = descendientes(proyectoId, allItems)

  const alSoltar = async (e: DragEndEvent) => {
    setArrastrandoId(null)
    const { active, over } = e
    if (!over) return
    const nuevoEstado = over.id as MinuteEstado
    const item = allItems.find((it) => it.id === active.id)
    if (!item || item.effectiveEstado === nuevoEstado) return
    try {
      await onMover(item.id, nuevoEstado)
    } catch {
      toast.error('No se pudo mover la tarjeta')
    }
  }

  const arrastrando = arrastrandoId ? allItems.find((i) => i.id === arrastrandoId) : undefined

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e: DragStartEvent) => setArrastrandoId(e.active.id as string)}
      onDragEnd={alSoltar}
      onDragCancel={() => setArrastrandoId(null)}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {ESTADOS.map((estado) => {
          const items = todos.filter((it) => it.effectiveEstado === estado)
          return (
            <Columna key={estado} estado={estado} cantidad={items.length}>
              {items.map((it) => (
                <Tarjeta
                  key={it.id}
                  item={it}
                  allItems={allItems}
                  memberName={memberName}
                  seleccionada={selectedId === it.id}
                  puedeAsignar={
                    it.linkedActivities.length === 0 && canAssign && it.responsables.length > 0
                  }
                  onOpen={() => onOpen(it.id)}
                  onAsignar={() => onAsignar(it.id)}
                />
              ))}
              {items.length === 0 && (
                <p className="py-4 text-center text-xs text-fg-faint">Sin tarjetas</p>
              )}
            </Columna>
          )
        })}
      </div>
      <DragOverlay>
        {arrastrando && (
          <TarjetaContenido
            item={arrastrando}
            allItems={allItems}
            memberName={memberName}
            className="shadow-lg border-border-strong"
          />
        )}
      </DragOverlay>
    </DndContext>
  )
}

/** Columna: es el area donde se puede soltar una tarjeta (useDroppable). */
function Columna({
  estado,
  cantidad,
  children,
}: {
  estado: MinuteEstado
  cantidad: number
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: estado })
  return (
    <section
      ref={setNodeRef}
      aria-label={MINUTE_ESTADO[estado].label}
      className={cx(
        'rounded-lg border p-2 transition-colors',
        isOver ? 'border-accent bg-accent-soft' : 'border-border bg-surface-soft',
      )}
    >
      <header className="flex items-center gap-2 px-1 pb-2">
        <StatusLabel {...MINUTE_ESTADO[estado]} className="font-medium" />
        <span className="ml-auto text-xs tabular-nums text-fg-faint">{cantidad}</span>
      </header>
      <div className="space-y-1.5">{children}</div>
    </section>
  )
}

/**
 * Tarjeta: resumen de solo lectura. Editar se hace desde el mismo panel de detalle que Lista y
 * Cronograma (tocar la tarjeta lo abre), para que las tres vistas compartan exactamente el
 * mismo camino de edicion en vez de que el Tablero sea "otra aplicacion".
 */
function Tarjeta({
  item,
  allItems,
  memberName,
  seleccionada,
  puedeAsignar,
  onOpen,
  onAsignar,
}: {
  item: DecoratedItem
  allItems: DecoratedItem[]
  memberName: (id: string) => string
  seleccionada: boolean
  puedeAsignar: boolean
  onOpen: () => void
  onAsignar: () => void
}) {
  const movible = puedeArrastrar(item)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    disabled: !movible,
  })

  return (
    <TarjetaContenido
      ref={setNodeRef}
      item={item}
      allItems={allItems}
      memberName={memberName}
      onClick={onOpen}
      style={
        transform
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 20 }
          : undefined
      }
      className={cx(
        'cursor-pointer hover:border-border-strong',
        seleccionada && 'border-accent',
        isDragging && 'opacity-30',
      )}
      asa={
        movible ? (
          <button
            type="button"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            aria-label="Arrastrar para cambiar de columna"
            title="Arrastrar para cambiar de columna"
            className="-mr-1 p-0.5 rounded text-fg-faint hover:text-fg-muted cursor-grab active:cursor-grabbing touch-none"
          >
            <Icon name="grip" size={14} />
          </button>
        ) : null
      }
      accion={
        puedeAsignar ? (
          <Button
            size="xs"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              onAsignar()
            }}
            className="-my-1 -mr-1"
          >
            Asignar
          </Button>
        ) : null
      }
    />
  )
}

/** Dibujo de la tarjeta, compartido por la tarjeta real y la que sigue al cursor al arrastrar. */
function TarjetaContenido({
  ref,
  item,
  allItems,
  memberName,
  className,
  style,
  onClick,
  asa,
  accion,
}: {
  ref?: (el: HTMLElement | null) => void
  item: DecoratedItem
  allItems: DecoratedItem[]
  memberName: (id: string) => string
  className?: string
  style?: CSSProperties
  onClick?: () => void
  asa?: ReactNode
  accion?: ReactNode
}) {
  const fin = plazoEfectivo(item, allItems)
  const subtareas = allItems.filter((d) => d.parent_item_id === item.id)
  const estado = estadoItem(item, allItems)
  const vinculadas = item.linkedActivities.length
  const resuelto = item.effectiveEstado === 'resuelto'
  // Bloqueo/vencimiento: el estado derivado lo dice mejor que un icono.
  const alerta = estado.tone === 'blocked' || estado.tone === 'danger'

  return (
    <article
      ref={ref}
      style={style}
      onClick={onClick}
      className={cx('rounded-md border border-border bg-panel px-2.5 py-2 text-sm', className)}
    >
      <div className="flex items-start gap-2">
        {item.prioridad ? <PriorityBars priority={item.prioridad} className="mt-1" /> : null}
        <p
          className={cx(
            'flex-1 min-w-0 leading-snug line-clamp-2',
            resuelto ? 'text-fg-faint' : 'text-fg',
          )}
        >
          {item.tema || <span className="text-fg-faint italic">Sin nombre</span>}
        </p>
        {asa}
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-xs text-fg-faint min-w-0">
        <Responsables ids={item.responsables} memberName={memberName} />
        {fin && <DueDate date={fin} done={resuelto} />}
        {subtareas.length > 0 && <span>{subtareas.length} sub.</span>}
        {alerta ? (
          <span title={vinculadas > 0 ? MOTIVO_FIJA : undefined}>
            <StatusLabel {...estado} />
          </span>
        ) : (
          vinculadas > 0 && (
            <span title={MOTIVO_FIJA} className="truncate">
              {item.linkedActivities.filter((a) => a.status === 'completado').length}/{vinculadas}{' '}
              {vinculadas === 1 ? 'actividad' : 'actividades'}
            </span>
          )
        )}
        <span className="ml-auto" />
        {accion}
      </div>
    </article>
  )
}
