// Piezas de arrastrar y soltar de Planificacion: la actividad (arrastrable) y el dia (zona
// donde se suelta). dnd-kit con Pointer Events: funciona igual con mouse que con touch -antes
// era HTML5 drag nativo, invisible en celular-.

import type { HTMLAttributes, ReactNode } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { PriorityBars } from '@shared/components/ui/Indicators'
import { cx } from '@shared/utils/cx'
import type { Activity } from '@shared/types'
import { fmtHoras, horasDe } from '@features/gantt/utils/carga'

/** Un dia de una persona: el id de la zona es la fecha, que es lo unico que cambia al soltar. */
export function DiaDroppable({
  date,
  className,
  children,
}: {
  date: string
  className?: string
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: date })
  return (
    <div
      ref={setNodeRef}
      className={cx(
        'rounded-md transition-colors',
        isOver && 'bg-accent-soft ring-1 ring-inset ring-accent',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Actividad dentro de un dia: se arrastra a otro dia o se toca para ver su detalle. */
export function ActividadChip({
  activity,
  onSelect,
}: {
  activity: Activity
  onSelect: (a: Activity) => void
}) {
  // Una completada ya no se reprograma: queda fija donde se entrego.
  const completada = activity.status === 'completado'
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: activity.id,
    disabled: completada,
  })

  return (
    <ChipContenido
      ref={setNodeRef}
      activity={activity}
      {...(completada ? {} : attributes)}
      {...(completada ? {} : listeners)}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(activity)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSelect(activity)
      }}
      title={
        completada
          ? `${activity.title} (completada)`
          : `${activity.title} · arrastra para cambiar de día`
      }
      className={cx(
        isDragging && 'opacity-40',
        !completada && 'cursor-grab active:cursor-grabbing touch-none hover:border-border-strong',
      )}
    />
  )
}

/** Dibujo del chip, compartido con la copia que sigue al cursor al arrastrar. */
export function ChipContenido({
  activity,
  className,
  ...rest
}: { activity: Activity } & HTMLAttributes<HTMLDivElement> & {
    ref?: (el: HTMLElement | null) => void
  }) {
  const completada = activity.status === 'completado'
  return (
    <div
      role="button"
      tabIndex={0}
      {...rest}
      className={cx(
        'flex items-start gap-1.5 w-full rounded-md border border-border bg-panel px-1.5 py-1 text-xs text-left',
        className,
      )}
    >
      <PriorityBars priority={activity.priority} className="mt-0.5" />
      <span
        className={cx(
          'flex-1 min-w-0 line-clamp-2 break-words',
          completada ? 'text-fg-faint line-through' : 'text-fg-body',
        )}
      >
        {activity.title}
      </span>
      <span className="shrink-0 tabular-nums text-fg-faint">{fmtHoras(horasDe(activity))}</span>
    </div>
  )
}
