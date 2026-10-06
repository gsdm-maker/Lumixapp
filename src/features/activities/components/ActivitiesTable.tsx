import { Button } from '@shared/components/ui/Button'
import { Icon } from '@shared/components/ui/Icon'
import { DueDate, PriorityBars } from '@shared/components/ui/Indicators'
import { StatusLabel } from '@shared/components/ui/StatusLabel'
import { estadoActividad } from '@shared/utils/estados'
import { cx } from '@shared/utils/cx'
import type { Activity } from '@shared/types'
import type { GrupoFilas } from '@features/activities/utils/urgencia'
import type { FilaArbol } from '@features/activities/utils/arbol'
import { filaDomId, siguienteAccion } from '@features/activities/utils/ui'

// Columnas en escritorio: Actividad | Responsable | Prioridad | Entrega | Estado | Accion.
// Un solo template para encabezado y filas, asi nunca se desalinean.
const COLUMNAS = '@3xl:grid-cols-[minmax(0,1fr)_9.5rem_4rem_5.5rem_8.5rem_6.5rem]'

interface ActivitiesTableProps {
  grupos: GrupoFilas[]
  /** Sin encabezados de grupo (agrupar: ninguno). */
  plano: boolean
  selectedId: string | null
  nombrePersona: (id: string) => string
  teamNames: Record<string, string>
  onOpen: (a: Activity) => void
  onAccion: (a: Activity) => void
}

/**
 * Lista de actividades. Con espacio es una tabla compacta; angosta, cada fila pasa a ser un
 * item de dos lineas (titulo / contexto, responsable y entrega) y tocarla abre el panel.
 * Es un solo marcado con grid responsivo en vez de tabla + lista duplicadas.
 *
 * El corte es por container query (@3xl) y no por ancho de pantalla: con el panel de detalle
 * abierto la lista se angosta en escritorio, y ahi conviene la forma de lista aunque la
 * pantalla sea ancha, en vez de columnas apretadas o scroll horizontal.
 */
export function ActivitiesTable({
  grupos,
  plano,
  selectedId,
  nombrePersona,
  teamNames,
  onOpen,
  onAccion,
}: ActivitiesTableProps) {
  return (
    <div role="grid" aria-label="Actividades" className="@container text-sm">
      <div
        role="row"
        className={cx(
          'hidden @3xl:grid sticky top-0 z-[2] items-center gap-x-3 h-8 px-5 bg-panel border-b border-border text-xs font-medium text-fg-faint',
          COLUMNAS,
        )}
      >
        <span role="columnheader">Actividad</span>
        <span role="columnheader">Responsable</span>
        <span role="columnheader">Prioridad</span>
        <span role="columnheader">Entrega</span>
        <span role="columnheader">Estado</span>
        <span role="columnheader" className="sr-only">
          Acción
        </span>
      </div>

      {grupos.map((g) => (
        <div key={g.clave} role="rowgroup">
          {!plano && (
            <div
              role="row"
              className="sticky top-0 @3xl:top-8 z-[1] flex items-center gap-2 h-7 px-3 sm:px-5 bg-surface border-b border-border text-xs font-medium"
            >
              <span
                role="gridcell"
                className={g.clave === 'vencidas' ? 'text-danger' : 'text-fg-muted'}
              >
                {g.titulo}
              </span>
              <span className="text-fg-faint tabular-nums">{g.filas.length}</span>
            </div>
          )}
          {g.filas.map((fila) => (
            <Fila
              key={fila.activity.id}
              fila={fila}
              selected={fila.activity.id === selectedId}
              responsable={nombrePersona(fila.activity.responsible_id)}
              contexto={fila.nivelSuperior ?? teamNames[fila.activity.team_id] ?? null}
              onOpen={onOpen}
              onAccion={onAccion}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function Fila({
  fila,
  selected,
  responsable,
  contexto,
  onOpen,
  onAccion,
}: {
  fila: FilaArbol
  selected: boolean
  responsable: string
  contexto: string | null
  onOpen: (a: Activity) => void
  onAccion: (a: Activity) => void
}) {
  const { activity: a, depth } = fila
  const cerrada = a.status === 'completado'
  const estado = estadoActividad(a.status, a.due_date)
  const accion = siguienteAccion(a)
  const movida = a.plazo_change_count ?? 0

  return (
    <div
      role="row"
      id={filaDomId(a.id)}
      aria-selected={selected}
      onClick={() => onOpen(a)}
      className={cx(
        'group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-3 sm:px-5 py-2 @3xl:py-1.5 border-b border-border cursor-pointer transition-colors',
        COLUMNAS,
        selected ? 'bg-accent-soft' : 'hover:bg-surface',
      )}
    >
      {/* Actividad: la sangria y el codo dibujan el arbol de subtareas. */}
      <div role="gridcell" className="flex items-start gap-1.5 min-w-0">
        {depth > 0 && (
          <span
            aria-hidden="true"
            style={{ marginLeft: 4 + (depth - 1) * 16 }}
            className="shrink-0 w-2.5 h-2.5 mt-0.5 border-l border-b border-border-strong rounded-bl-sm"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              title={a.title}
              className={cx(
                'line-clamp-2 @3xl:line-clamp-none @3xl:truncate',
                cerrada ? 'text-fg-muted' : 'text-fg',
              )}
            >
              {a.title}
            </span>
            {a.observations && (
              <span title={a.observations} className="shrink-0 text-fg-faint">
                <Icon name="info" size={13} />
                <span className="sr-only">Tiene observaciones</span>
              </span>
            )}
          </div>
          {/* Escritorio: solo el contexto. Movil: contexto, responsable y entrega. */}
          <div className="flex items-center gap-1.5 min-w-0 text-xs text-fg-faint">
            {contexto && <span className="truncate">{contexto}</span>}
            <span className="@3xl:hidden shrink-0">
              {contexto && '· '}
              {responsable}
            </span>
            <span className="@3xl:hidden shrink-0">
              · <DueDate date={a.due_date} done={cerrada} />
            </span>
          </div>
        </div>
      </div>

      {/* Movil: estado a la derecha del item. */}
      <div role="gridcell" className="@3xl:hidden self-start pt-0.5">
        <StatusLabel {...estado} />
      </div>

      <div role="gridcell" className="hidden @3xl:block truncate text-fg-muted">
        {responsable}
      </div>
      <div role="gridcell" className="hidden @3xl:block">
        <PriorityBars priority={a.priority} />
      </div>
      <div role="gridcell" className="hidden @3xl:flex items-center gap-1">
        <DueDate date={a.due_date} done={cerrada} />
        {movida > 0 && (
          <span
            title={`Fecha movida ${movida} ${movida === 1 ? 'vez' : 'veces'}`}
            className="text-fg-faint"
          >
            <Icon name="calendarMove" size={13} />
            <span className="sr-only">Fecha movida {movida} veces</span>
          </span>
        )}
      </div>
      <div role="gridcell" className="hidden @3xl:block">
        <StatusLabel {...estado} />
      </div>
      {/* Accion siguiente: aparece al pasar el mouse, con foco o en la fila elegida. En
          pantallas tactiles anchas (tablet) no hay hover, asi que se muestra siempre. */}
      <div role="gridcell" className="hidden @3xl:flex justify-end">
        {accion && (
          <Button
            size="xs"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation()
              onAccion(a)
            }}
            className={cx(
              'transition-opacity',
              selected
                ? 'opacity-100'
                : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100',
            )}
          >
            {accion.label}
          </Button>
        )}
      </div>
    </div>
  )
}
