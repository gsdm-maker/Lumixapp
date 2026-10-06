import { useState } from 'react'
import { Button, IconButton } from '@shared/components/ui/Button'
import { useConfirm } from '@shared/components/ui/ConfirmDialog'
import { EmptyState } from '@shared/components/ui/EmptyState'
import { PageHeader } from '@shared/components/ui/PageHeader'
import { SkeletonRows } from '@shared/components/ui/Skeleton'
import { useToast } from '@shared/components/ui/Toast'
import { exportToCSV } from '@shared/utils/export'
import { formatDateLocal } from '@shared/utils/date'
import { INGESTA_ESTADO, MINUTE_ESTADO } from '@shared/utils/estados'
import { useMinuta } from '@features/minuta/hooks/useMinuta'
import { AsignarActividadModal } from '@features/minuta/components/AsignarActividadModal'
import { CargaMasivaModal } from '@features/minuta/components/CargaMasivaModal'
import { GanttModal } from '@features/minuta/components/GanttChart'
import { MinutaLista, MinutaTabla } from '@features/minuta/components/MinutaTabla'
import { MinutaToolbar } from '@features/minuta/components/MinutaToolbar'
import { ModoReunion } from '@features/minuta/components/ModoReunion'
import { TemaDetalle } from '@features/minuta/components/TemaDetalle'
import type { Hoja } from '@features/minuta/components/hoja'
import { responsablesLabel } from '@features/minuta/utils/temas'
import type { HojaTipo } from '@shared/types'

// Proyectos importa el Cronograma desde esta ruta (@features/minuta/components/MinutaPage):
// se re-exporta para no romper ese import al mover el componente a su propio archivo.
export { GanttChart, GanttModal } from '@features/minuta/components/GanttChart'
export { SubtareasPanel } from '@features/minuta/components/SubtareasPanel'

/**
 * Hoja de temas: sirve para la minuta semanal y para la de ingesta.
 *
 * Es la misma tabla, el mismo hook y la misma UI; lo unico que cambia son las etiquetas y
 * el permiso que se exige para escribir (lo resuelve useMinuta). Ver migracion 033.
 */
export function MinutaPage({ tipo = 'minuta' }: { tipo?: HojaTipo } = {}) {
  const esIngesta = tipo === 'ingesta'
  // Minuta es un tema puntual de la reunion semanal, no un reparto de tareas -eso es
  // Proyectos-: un solo responsable por tema/subtarea, para que no se acumulen varias
  // actividades detras de un mismo tema (caso real reportado).
  const esMinuta = tipo === 'minuta'
  // Sustantivo que nombra lo que se sigue, igual que el menu lateral ("hoja" era jerga de
  // planilla y no decia que hay adentro).
  const titulo = esIngesta ? 'Ingestas' : 'Minuta semanal'
  const h = useMinuta(tipo)
  const {
    items,
    allItems,
    counts,
    porConversar,
    members,
    loading,
    view,
    canManage,
    canDelete,
    canAssign,
    addItem,
    bulkAdd,
    updateItem,
    changePlazo,
    removeItem,
    createActivitiesFromItem,
  } = h

  const [cargaMasiva, setCargaMasiva] = useState(false)
  const [ganttForId, setGanttForId] = useState<string | null>(null)
  const [detalleId, setDetalleId] = useState<string | null>(null)
  const [createForId, setCreateForId] = useState<string | null>(null)
  // Cuando se abre desde "Crear actividad faltante", acota a esas personas (no duplicarle la
  // actividad a quien ya la tiene). undefined = todos los responsables del tema.
  const [createSoloResp, setCreateSoloResp] = useState<string[] | undefined>(undefined)
  // Cola del modo reunion, congelada al empezar. null = no hay reunion en curso.
  const [reunion, setReunion] = useState<string[] | null>(null)
  const toast = useToast()
  const confirm = useConfirm()

  // El cambio se pinta al instante y se guarda despues (ver updateItem). Si el guardado
  // falla, el hook revierte: sin este aviso, el valor volveria solo y sin explicacion.
  const guardar = (id: string, patch: Parameters<typeof updateItem>[1]) =>
    updateItem(id, patch).catch(() => toast.error('No se pudo guardar el cambio'))

  const memberName = (id: string) => members.find((m) => m.id === id)?.full_name || 'Desconocido'

  const eliminar = async (id: string) => {
    const it = allItems.find((i) => i.id === id)
    if (!it) return
    const que = it.parent_item_id ? 'subtarea' : esIngesta ? 'solicitud' : 'tema'
    const ok = await confirm({
      title: `Eliminar ${que}`,
      message: (
        <>
          Se elimina "{it.tema}". No se puede deshacer.
          {it.linkedActivities.length > 0 && ' Las actividades ya creadas no se eliminan.'}
        </>
      ),
      confirmLabel: 'Eliminar',
      tone: 'danger',
    })
    if (!ok) return
    if (detalleId === id) setDetalleId(null)
    try {
      await removeItem(id)
      toast.success(`${que[0].toUpperCase()}${que.slice(1)} eliminado${que === 'tema' ? '' : 'a'}`)
    } catch {
      toast.error('No se pudo eliminar')
    }
  }

  const hoja: Hoja = {
    esIngesta,
    esMinuta,
    canManage,
    canDelete,
    canAssign,
    members,
    allItems,
    memberName,
    guardar,
    guardarPlazo: (item, v) =>
      changePlazo(item, v).catch(() => toast.error('No se pudo guardar la fecha')),
    guardarTema: (id, tema) => guardar(id, { tema }),
    guardarComentarios: (id, comentarios) => guardar(id, { comentarios }),
    addItem: (tema, parentId) => {
      addItem(tema, parentId).catch(() => toast.error('No se pudo agregar la subtarea'))
    },
    asignar: (it, soloEstos) => {
      setCreateSoloResp(soloEstos)
      setCreateForId(it.id)
    },
    eliminar,
    yaConversado: (it) =>
      guardar(it.id, { estado: 'en_desarrollo' }).then(() =>
        toast.success('Listo, sale de la lista de conversación'),
      ),
    verCronograma: (it) => setGanttForId(it.id),
    abrirDetalle: (it) => setDetalleId(it.id),
  }

  const nuevoTema = async () => {
    try {
      const id = await addItem('')
      // Se abre el detalle del tema recien creado: lo primero que hay que hacer es nombrarlo.
      if (id) setDetalleId(id)
    } catch {
      toast.error('No se pudo crear el tema')
    }
  }

  const exportar = () =>
    exportToCSV(
      items.map((it) =>
        esIngesta
          ? {
              Solicitud: it.tema,
              Responsable: it.responsables_text || 'Sin asignar',
              'Fecha de solicitud': formatDateLocal(it.created_at),
              'Fecha de compromiso': it.plazo ? formatDateLocal(it.plazo) : '-',
              Estado: INGESTA_ESTADO[it.estado_ingesta ?? 'no_iniciado'].label,
              Comentarios: it.comentarios,
            }
          : {
              Tema: it.tema,
              Responsables: responsablesLabel(it, memberName),
              Estado: MINUTE_ESTADO[it.effectiveEstado].label,
              Plazo: it.plazo ? formatDateLocal(it.plazo) : '-',
              'Cambios de plazo': it.plazo_change_count,
              Comentarios: it.comentarios,
            },
      ),
      esIngesta ? 'ingesta' : 'minuta',
    )

  // Que decir cuando no hay nada. "Por asignar" vacio es una BUENA noticia -no queda nada
  // que conversar-, no un error, y el mensaje tiene que reflejarlo.
  const textoVacio = () => {
    if (h.weekMode) return 'No hubo temas con actividad en esa semana'
    if (h.dateFrom && h.dateTo) return 'No hay solicitudes en ese rango de fechas'
    if (h.search || h.filterMember !== 'todas' || h.filterGrupo !== 'todas')
      return esIngesta
        ? 'No hay solicitudes que coincidan con el filtro'
        : 'No hay temas que coincidan con el filtro'
    if (esIngesta) {
      if (view === 'resueltos') return 'No hay solicitudes resueltas'
      if (view === 'todos') return 'No hay solicitudes registradas todavía'
      return 'No hay solicitudes activas. Todo al día.'
    }
    if (view === 'resueltos') return 'No hay temas resueltos'
    if (view === 'asignados') return 'No hay temas asignados todavía'
    if (view === 'todos') return 'No hay temas en la minuta'
    return 'Todo asignado. No queda nada por conversar.'
  }

  // OJO: se busca en allItems, no en items -este ultimo son solo los temas raiz visibles en
  // la lista principal (ver useMinuta). Un sub-tema nunca aparece ahi, asi que buscarlo en
  // items dejaba el modal de "Asignar" sin nada que mostrar y parecia que el boton no hacia nada.
  const buscar = (id: string | null) => (id ? (allItems.find((i) => i.id === id) ?? null) : null)
  const createItem = buscar(createForId)
  const ganttItem = buscar(ganttForId)
  const detalleItem = buscar(detalleId)

  const cronograma = ganttItem && (
    <GanttModal
      root={ganttItem}
      allItems={allItems}
      onClose={() => setGanttForId(null)}
      memberName={memberName}
    />
  )

  // Modo reunion: ocupa la pagina entera (no es un modal) para poder proyectarlo en la sala.
  if (reunion) {
    return (
      <>
        <ModoReunion
          ids={reunion}
          hoja={hoja}
          crearActividades={createActivitiesFromItem}
          onSalir={() => setReunion(null)}
        />
        {cronograma}
      </>
    )
  }

  const meta = esIngesta
    ? `${counts.pendientes} ${counts.pendientes === 1 ? 'activa' : 'activas'} · ${counts.todos} en total`
    : `${counts.pendientes} por asignar · ${counts.todos} temas`

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={titulo}
        meta={meta}
        actions={
          <>
            <Button
              size="sm"
              variant="secondary"
              icon="download"
              onClick={exportar}
              className="hidden md:inline-flex"
              title="Descargar la vista actual como planilla"
            >
              Exportar
            </Button>
            <IconButton icon="download" label="Exportar" onClick={exportar} className="md:hidden" />
            {canManage && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  icon="upload"
                  onClick={() => setCargaMasiva(true)}
                  className="hidden md:inline-flex"
                  title="Cargar varios temas desde una planilla"
                >
                  Carga masiva
                </Button>
                <IconButton
                  icon="upload"
                  label="Carga masiva"
                  onClick={() => setCargaMasiva(true)}
                  className="md:hidden"
                />
              </>
            )}
            {esMinuta && canManage && (
              <Button
                size="sm"
                variant="secondary"
                icon="play"
                onClick={() => {
                  setDetalleId(null)
                  setReunion(porConversar.map((i) => i.id))
                }}
                title="Recorre los temas por asignar de a uno, con atajos de teclado"
              >
                <span className="hidden sm:inline">Empezar reunión</span>
                <span className="sm:hidden">Reunión</span>
              </Button>
            )}
            {canManage && (
              <Button size="sm" icon="plus" onClick={nuevoTema}>
                <span className="hidden sm:inline">
                  {esIngesta ? 'Nueva solicitud' : 'Nuevo tema'}
                </span>
                <span className="sm:hidden">Nuevo</span>
              </Button>
            )}
          </>
        }
      />

      <MinutaToolbar esIngesta={esIngesta} h={h} />

      <div className="flex-1 min-h-0 overflow-auto bg-panel">
        {loading ? (
          <div className="p-3 sm:px-5">
            <SkeletonRows rows={6} />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={view === 'pendientes' && !esIngesta ? 'check' : 'list'}
            title={textoVacio()}
            action={
              canManage &&
              view !== 'pendientes' && (
                <Button size="sm" variant="secondary" icon="plus" onClick={nuevoTema}>
                  {esIngesta ? 'Nueva solicitud' : 'Nuevo tema'}
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className="lg:hidden">
              <MinutaLista items={items} hoja={hoja} />
            </div>
            <div className="hidden lg:block">
              <MinutaTabla items={items} hoja={hoja} seleccionado={detalleId} />
            </div>
          </>
        )}
      </div>

      <TemaDetalle item={detalleItem} hoja={hoja} onClose={() => setDetalleId(null)} />

      {/* Crear actividad(es) desde un tema/subtarea (el mismo modal que usa Proyectos) */}
      <AsignarActividadModal
        key={createItem?.id ?? 'closed'}
        item={createItem}
        soloResponsables={createSoloResp}
        memberName={memberName}
        onClose={() => setCreateForId(null)}
        onCreate={createActivitiesFromItem}
      />

      <CargaMasivaModal
        open={cargaMasiva}
        onClose={() => setCargaMasiva(false)}
        members={members}
        // allItems y no items: items esta filtrado por vista y busqueda, asi que un tema
        // resuelto u oculto no se veria como repetido y entraria igual.
        temasExistentes={allItems.map((i) => i.tema)}
        onConfirm={bulkAdd}
      />

      {cronograma}
    </div>
  )
}
