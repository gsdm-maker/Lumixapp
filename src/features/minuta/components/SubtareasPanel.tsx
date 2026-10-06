import { useRef, useState } from 'react'
import { Button, IconButton } from '@shared/components/ui/Button'
import { EditableText } from '@shared/components/ui/EditableText'
import { Icon } from '@shared/components/ui/Icon'
import { StatusLabel } from '@shared/components/ui/StatusLabel'
import { MINUTE_ESTADO } from '@shared/utils/estados'
import type { DecoratedItem } from '@features/minuta/hooks/useMinuta'
import { PlazoCampo, ResponsableCampo } from '@features/minuta/components/CamposTema'
import type { Profile } from '@shared/types'

/**
 * Sub-temas de un tema (ej. "Ver faena" bajo "Revisar capacidad").
 *
 * Reusa las mismas funciones que ya gobiernan un tema de nivel superior (guardar,
 * openCreate) en vez de reimplementar la logica de asignacion: un sub-tema sigue el
 * MISMO camino para transformarse en actividad. Cada subtarea es una fila plana de dos
 * lineas (texto arriba, responsable/plazo/estado abajo), sin tarjeta propia.
 */
export function SubtareasPanel({
  parentId,
  allItems,
  members,
  canManage,
  canAssign,
  singleResponsable,
  canAddSubtareas = true,
  maxDepth,
  depth = 0,
  defaultExpanded = false,
  canDelete = false,
  onRemove,
  memberName,
  onGuardar,
  onGuardarTema,
  onGuardarPlazo,
  onOpenCreate,
  onAdd,
}: {
  parentId: string
  allItems: DecoratedItem[]
  members: Profile[]
  canManage: boolean
  canAssign: boolean
  // Minuta: una subtarea sigue siendo un tema puntual, un solo responsable.
  singleResponsable?: boolean
  // Compuerta general de "se puede agregar subtareas aca" (aparte de la profundidad).
  canAddSubtareas?: boolean
  // Minuta: un tema admite subtareas, pero de UN solo nivel -no sub-subtareas, eso ya es
  // armar un proyecto de a poco, y para eso esta Proyectos-. depth se incrementa en cada
  // llamada recursiva.
  maxDepth?: number
  depth?: number
  // El panel de detalle la abre desplegada (ahi se fue a ver justamente esto); la tabla la
  // deja plegada para no repetir filas densas en cada tema.
  defaultExpanded?: boolean
  canDelete?: boolean
  onRemove?: (id: string, tema: string) => void
  memberName: (id: string) => string
  onGuardar: (id: string, patch: { responsables: string[]; para_todos: boolean }) => void
  onGuardarTema: (id: string, tema: string) => void
  onGuardarPlazo: (item: DecoratedItem, v: string | null) => void
  onOpenCreate: (it: DecoratedItem) => void
  onAdd: (tema: string, parentItemId: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [nuevo, setNuevo] = useState('')
  const cancelandoRef = useRef(false)
  // Plegado por defecto en la tabla: revelar bajo demanda en vez de mostrar todo junto (el
  // patron que Todoist/Asana usan, y que NN/G mide como mejora real de tiempo de escaneo).
  const [expanded, setExpanded] = useState(defaultExpanded)
  const subtemas = allItems.filter((d) => d.parent_item_id === parentId)
  const puedeAgregarAca =
    canManage && canAddSubtareas && (maxDepth === undefined || depth < maxDepth)
  const puedeAnidar = maxDepth === undefined || depth + 1 < maxDepth

  // Sin subtareas y sin poder agregar, no hay nada que mostrar.
  if (subtemas.length === 0 && !(puedeAgregarAca && defaultExpanded)) return null

  const confirmarNuevo = () => {
    // Al cancelar con Escape, quitar el input dispara un blur nativo antes de desmontar -sin
    // esta bandera, ese blur llamaba a confirmarNuevo con el texto ya descartado y creaba la
    // subtarea igual que si nunca se hubiera cancelado.
    if (cancelandoRef.current) {
      cancelandoRef.current = false
      return
    }
    if (nuevo.trim()) onAdd(nuevo.trim(), parentId)
    setNuevo('')
    setAdding(false)
  }
  const cancelarNuevo = () => {
    cancelandoRef.current = true
    setNuevo('')
    setAdding(false)
  }

  const abierto = expanded || subtemas.length === 0 || (defaultExpanded && depth === 0)

  return (
    <div className={depth > 0 || !defaultExpanded ? 'mt-1.5 pl-3 border-l border-border' : ''}>
      {/* En el panel de detalle el titulo "Subtareas" ya lo pone el panel: sin pliegue. */}
      {subtemas.length > 0 && !(defaultExpanded && depth === 0) && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="inline-flex items-center gap-1 h-6 text-xs text-fg-muted hover:text-fg"
        >
          <Icon name={expanded ? 'chevronDown' : 'chevronRight'} size={13} />
          Subtareas
          <span className="tabular-nums text-fg-faint">{subtemas.length}</span>
        </button>
      )}
      {abierto && (
        <ul className="divide-y divide-border">
          {subtemas.map((s) => (
            <li key={s.id} className="py-1.5">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <EditableText
                    value={s.tema}
                    canEdit={canManage}
                    onSave={(next) => onGuardarTema(s.id, next)}
                    textClassName="text-sm text-fg-body"
                    preventEmpty
                  />
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="min-w-[8rem] max-w-[12rem]">
                      <ResponsableCampo
                        item={s}
                        esIngesta={false}
                        canEdit={canManage}
                        members={members}
                        single={!!singleResponsable}
                        memberName={memberName}
                        onChange={(p) =>
                          onGuardar(s.id, {
                            responsables: p.responsables ?? s.responsables,
                            para_todos: false,
                          })
                        }
                      />
                    </span>
                    <PlazoCampo
                      item={s}
                      allItems={allItems}
                      canEdit={canManage}
                      onChange={(v) => onGuardarPlazo(s, v)}
                      done={s.effectiveEstado === 'resuelto'}
                      vacio="Sin fecha"
                    />
                    {s.linkedActivities.length > 0 ? (
                      <StatusLabel {...MINUTE_ESTADO[s.effectiveEstado]} />
                    ) : (
                      canAssign &&
                      s.responsables.length > 0 && (
                        <Button size="xs" variant="secondary" onClick={() => onOpenCreate(s)}>
                          Asignar
                        </Button>
                      )
                    )}
                  </div>
                </div>
                {canDelete && onRemove && (
                  <IconButton
                    icon="trash"
                    size="xs"
                    label="Eliminar subtarea"
                    onClick={() => onRemove(s.id, s.tema)}
                  />
                )}
              </div>

              {/* Recursivo: una subtarea puede tener las suyas. En Minuta se corta a un solo
                  nivel (maxDepth=1): un tema puntual admite un paso mas, no un arbol entero. */}
              {puedeAnidar && (
                <SubtareasPanel
                  parentId={s.id}
                  allItems={allItems}
                  members={members}
                  canManage={canManage}
                  canAssign={canAssign}
                  singleResponsable={singleResponsable}
                  canAddSubtareas={canAddSubtareas}
                  maxDepth={maxDepth}
                  depth={depth + 1}
                  canDelete={canDelete}
                  onRemove={onRemove}
                  memberName={memberName}
                  onGuardar={onGuardar}
                  onGuardarTema={onGuardarTema}
                  onGuardarPlazo={onGuardarPlazo}
                  onOpenCreate={onOpenCreate}
                  onAdd={onAdd}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {puedeAgregarAca &&
        abierto &&
        (adding ? (
          <input
            autoFocus
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
            onBlur={confirmarNuevo}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmarNuevo()
              if (e.key === 'Escape') {
                // Que Escape cierre solo el campo, no el panel de detalle que lo contiene.
                e.stopPropagation()
                cancelarNuevo()
              }
            }}
            aria-label="Nueva subtarea"
            placeholder="Nueva subtarea…"
            className="mt-1 w-full h-8 rounded-md border border-border-strong bg-field px-2 text-base sm:text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        ) : (
          <Button
            size="xs"
            variant="ghost"
            icon="plus"
            className="mt-1 -ml-2"
            onClick={() => setAdding(true)}
          >
            Subtarea
          </Button>
        ))}
    </div>
  )
}
