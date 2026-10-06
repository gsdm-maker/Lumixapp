// Detalle de un proyecto: Lista (arbol de actividades/subtareas) / Tablero (columnas por
// estado) / Cronograma (Gantt). Las tres vistas muestran el MISMO objeto (un minute_item
// tipo='proyecto') sin duplicar logica: click en cualquiera de las tres abre el mismo panel
// lateral de detalle (`ItemPanel`), y los datos (estado, fechas, avance) se calculan una
// sola vez y se leen igual en las tres.
//
// Esta pagina solo orquesta: estado de la vista, item abierto y modal de asignar. Cada vista
// vive en components/detail/ y los calculos en utils/proyecto.ts.

import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, IconButton } from '@shared/components/ui/Button'
import { PageHeader } from '@shared/components/ui/PageHeader'
import { SegmentedControl } from '@shared/components/ui/SegmentedControl'
import { EditableText } from '@shared/components/ui/EditableText'
import { EmptyState } from '@shared/components/ui/EmptyState'
import { LoadingState } from '@shared/components/ui/Spinner'
import { Icon } from '@shared/components/ui/Icon'
import { useToast } from '@shared/components/ui/Toast'
import { formatDateLocal } from '@shared/utils/date'
import { useMinuta } from '@features/minuta/hooks/useMinuta'
import { GanttChart } from '@features/minuta/components/MinutaPage'
import { AsignarActividadModal } from '@features/minuta/components/AsignarActividadModal'
import { plazoEfectivo, fechaInicioEfectiva } from '@features/minuta/utils/subtareas'
import { plural, resumirProyecto, type ResumenProyecto } from '@features/proyectos/utils/proyecto'
import { useEscalarAMinuta } from '@features/proyectos/hooks/useEscalarAMinuta'
import { AlertasTexto, AvanceProyecto } from './ProyectoIndicadores'
import { ListaView } from './detail/ListaView'
import { TableroView } from './detail/TableroView'
import { ItemPanel } from './detail/ItemPanel'

type Vista = 'lista' | 'tablero' | 'cronograma'

const VISTAS = [
  {
    value: 'lista' as const,
    label: (
      <>
        <Icon name="list" size={14} /> Lista
      </>
    ),
  },
  {
    value: 'tablero' as const,
    label: (
      <>
        <Icon name="board" size={14} /> Tablero
      </>
    ),
  },
  {
    value: 'cronograma' as const,
    label: (
      <>
        <Icon name="timeline" size={14} /> Cronograma
      </>
    ),
  },
]

export function ProyectoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const escalarAMinuta = useEscalarAMinuta()
  const {
    allItems,
    members,
    canManage,
    canAssign,
    canDelete,
    updateItem,
    changePlazo,
    createActivitiesFromItem,
    addItem,
    removeItem,
    loading,
    reload,
  } = useMinuta('proyecto')

  const [vista, setVista] = useState<Vista>('lista')
  const [createForId, setCreateForId] = useState<string | null>(null)
  const [detalleId, setDetalleId] = useState<string | null>(null)

  const proyecto = allItems.find((it) => it.id === id)
  const memberName = (mid: string) => members.find((m) => m.id === mid)?.full_name || 'Desconocido'
  const createItem = createForId ? (allItems.find((i) => i.id === createForId) ?? null) : null
  const detalleItem = detalleId ? (allItems.find((i) => i.id === detalleId) ?? null) : null

  // "Nueva actividad": crea un hijo directo del proyecto y abre su detalle de una, para
  // nombrarla ahi mismo -sin esto, quedaba una fila en blanco perdida en la Lista hasta que
  // alguien la encontraba y le ponia nombre.
  const crearActividad = async () => {
    if (!proyecto) return
    const nuevoId = await addItem('', proyecto.id)
    if (nuevoId) setDetalleId(nuevoId)
  }

  const volver = (
    <IconButton
      icon="arrowLeft"
      label="Volver a proyectos"
      onClick={() => navigate('/proyectos')}
      className="-ml-1.5"
    />
  )

  if (loading) return <LoadingState className="h-full" />

  if (!proyecto) {
    return (
      <EmptyState
        icon="folder"
        title="Ese proyecto ya no existe"
        action={
          <Button
            size="sm"
            variant="secondary"
            icon="arrowLeft"
            onClick={() => navigate('/proyectos')}
          >
            Volver a proyectos
          </Button>
        }
      />
    )
  }

  const resumen = resumirProyecto(proyecto, allItems)
  const rango =
    resumen.inicio || resumen.fin
      ? `${resumen.inicio ? formatDateLocal(resumen.inicio, 'short') : 'sin inicio'} → ${
          resumen.fin ? formatDateLocal(resumen.fin, 'short') : 'sin término'
        }`
      : null
  const vacio = resumen.actividades === 0

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        leading={volver}
        title={
          <EditableText
            as="span"
            value={proyecto.tema}
            canEdit={canManage}
            onSave={(next) => updateItem(proyecto.id, { tema: next })}
            textClassName="text-lg font-semibold text-fg"
            preventEmpty
          />
        }
        meta={rango}
        actions={
          canManage && (
            <Button size="sm" icon="plus" onClick={crearActividad}>
              <span className="hidden sm:inline">Nueva actividad</span>
              <span className="sm:hidden">Nueva</span>
            </Button>
          )
        }
      >
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <SegmentedControl<Vista>
            label="Vista del proyecto"
            options={VISTAS}
            value={vista}
            onChange={setVista}
          />
          <LineaResumen resumen={resumen} rango={rango} />
        </div>
      </PageHeader>

      <div className="flex-1 overflow-y-auto p-3 sm:p-5">
        {vista === 'lista' ? (
          vacio ? (
            <EmptyState
              icon="list"
              title="Todavía no hay actividades"
              description={canManage ? 'Agrega la primera con "Nueva actividad".' : undefined}
            />
          ) : (
            <ListaView
              proyectoId={proyecto.id}
              allItems={allItems}
              memberName={memberName}
              selectedId={detalleId}
              onOpen={setDetalleId}
            />
          )
        ) : vista === 'tablero' ? (
          <TableroView
            proyectoId={proyecto.id}
            allItems={allItems}
            memberName={memberName}
            canAssign={canAssign}
            selectedId={detalleId}
            onOpen={setDetalleId}
            onAsignar={setCreateForId}
            onMover={(itemId, estado) => updateItem(itemId, { estado })}
          />
        ) : (
          <GanttChart
            root={proyecto}
            allItems={allItems}
            memberName={memberName}
            onOpen={setDetalleId}
          />
        )}
      </div>

      <AsignarActividadModal
        key={createItem?.id ?? 'closed'}
        item={createItem}
        memberName={memberName}
        fechasObligatorias={
          createItem
            ? {
                inicio: fechaInicioEfectiva(createItem.id, allItems),
                termino: plazoEfectivo(createItem, allItems),
              }
            : undefined
        }
        onClose={() => {
          setCreateForId(null)
          reload()
        }}
        // Las fechas elegidas al asignar (inicio y termino) las guarda la misma RPC que vincula
        // la actividad: asi alcanza con el permiso de asignar, sin exigir el de gestionar.
        onCreate={createActivitiesFromItem}
      />

      {detalleItem && (
        <ItemPanel
          key={detalleItem.id}
          item={detalleItem}
          proyecto={proyecto}
          allItems={allItems}
          members={members}
          canManage={canManage}
          canAssign={canAssign}
          canDelete={canDelete}
          onClose={() => setDetalleId(null)}
          onGuardar={(patch) => updateItem(detalleItem.id, patch)}
          onGuardarPlazo={(v) =>
            changePlazo(detalleItem, v).catch(() => toast.error('No se pudo guardar la fecha'))
          }
          onAdd={(tema) => addItem(tema, detalleItem.id)}
          onAsignar={() => {
            setDetalleId(null)
            setCreateForId(detalleItem.id)
          }}
          onDiscutir={() => escalarAMinuta(detalleItem)}
          onEliminar={async () => {
            await removeItem(detalleItem.id)
            setDetalleId(null)
          }}
          onAbrir={setDetalleId}
        />
      )}
    </div>
  )
}

/** Una sola linea de estadisticas, con el mismo dibujo de avance que la lista de proyectos. */
function LineaResumen({ resumen, rango }: { resumen: ResumenProyecto; rango: string | null }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
      <AvanceProyecto avance={resumen.avance} barClassName="w-24" />
      <span className="text-fg-faint">·</span>
      <span>{plural(resumen.actividades, 'actividad', 'actividades')}</span>
      {resumen.subtareas > 0 && (
        <>
          <span className="text-fg-faint">·</span>
          <span>
            {resumen.subtareasResueltas}/{resumen.subtareas} subtareas resueltas
          </span>
        </>
      )}
      {(resumen.alertas.vencidas > 0 ||
        resumen.alertas.hoy > 0 ||
        resumen.alertas.proximas > 0 ||
        resumen.alertas.bloqueadas > 0) && (
        <>
          <span className="text-fg-faint">·</span>
          <AlertasTexto alertas={resumen.alertas} conBloqueadas />
        </>
      )}
      {/* En el celular PageHeader esconde el meta: las fechas se repiten aca. */}
      {rango && <span className="sm:hidden text-fg-faint">{rango}</span>}
    </div>
  )
}
