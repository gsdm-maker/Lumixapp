import { SIDE_PANEL_OFFSET } from '@shared/components/ui/SidePanel'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { activitiesService } from '@infrastructure/supabase/activities.service'
import { useAuth } from '@core/auth/hooks/useAuth'
import { useCapabilities } from '@core/auth/hooks/useCapabilities'
import { Button } from '@shared/components/ui/Button'
import { useConfirm } from '@shared/components/ui/ConfirmDialog'
import { EmptyState } from '@shared/components/ui/EmptyState'
import { PageHeader } from '@shared/components/ui/PageHeader'
import { SkeletonRows } from '@shared/components/ui/Skeleton'
import { useToast } from '@shared/components/ui/Toast'
import { exportToCSV } from '@shared/utils/export'
import { formatDateLocal, parseDateLocal } from '@shared/utils/date'
import { cx } from '@shared/utils/cx'
import type { Activity, ActivityStatus } from '@shared/types'
import { useActivities, statusLabels } from '@features/activities/hooks/useActivities'
import { useAgrupacion } from '@features/activities/hooks/useVistasGuardadas'
import { armarArbol } from '@features/activities/utils/arbol'
import { agruparFilas } from '@features/activities/utils/urgencia'
import { filaDomId, siguienteAccion } from '@features/activities/utils/ui'
import { ActivitiesFilters } from './ActivitiesFilters'
import { ActivitiesTable } from './ActivitiesTable'
import { ActivityDetailPanel } from './ActivityDetailPanel'
import { AssignActivityModal } from './AssignActivityModal'
import { VistasRapidas } from './VistasRapidas'

export function ActivitiesPage() {
  const act = useActivities()
  const { activities, allActivities, members, teamNames, proyectoItems, loading } = act
  const { profile, user } = useAuth()
  const { canAssignOthers } = useCapabilities()
  const { agrupacion, setAgrupacion } = useAgrupacion(user?.id)
  const toast = useToast()
  const confirm = useConfirm()
  const location = useLocation()
  const navigate = useNavigate()

  const [selected, setSelected] = useState<Activity | null>(null)
  // Pila de "desde donde entre": permite bajar N niveles (proyecto -> subtarea ->
  // sub-subtarea) y volver, reusando el mismo panel de detalle en cada nivel.
  const [parentStack, setParentStack] = useState<Activity[]>([])
  // Fila marcada con el teclado mientras el panel esta cerrado (Enter la abre).
  const [cursorId, setCursorId] = useState<string | null>(null)
  const [showAssign, setShowAssign] = useState(false)

  const nombrePersona = (id: string) => members.find((m) => m.id === id)?.full_name || 'Sin asignar'

  // Misma forma de arbol que el proyecto: subtareas bajo la actividad de su item padre.
  const filas = armarArbol(activities, proyectoItems)
  const grupos = agruparFilas(filas, agrupacion, { nombrePersona, items: proyectoItems })
  const orden = grupos.flatMap((g) => g.filas.map((f) => f.activity))

  // keepStack=true cuando se navega DESDE otro nivel (bajar a una hija o volver a la
  // anterior): ahi la pila no se reinicia, solo cuando se abre una actividad de cero.
  const openActivity = (a: Activity, opts?: { keepStack?: boolean }) => {
    if (!opts?.keepStack) setParentStack([])
    setSelected(a)
    setCursorId(a.id)
  }

  const openChild = (c: Activity) => {
    if (selected) setParentStack((s) => [...s, selected])
    openActivity(c, { keepStack: true })
  }

  const goBackToParent = () => {
    const prev = parentStack[parentStack.length - 1]
    if (!prev) return
    setParentStack((s) => s.slice(0, -1))
    openActivity(prev, { keepStack: true })
  }

  const closePanel = () => {
    setSelected(null)
    setParentStack([])
  }

  // Llegada desde una notificacion: abre esa actividad concreta.
  // Se busca en la base y no en el listado ya cargado, porque puede estar filtrada fuera
  // de la vista actual (completada, de otro equipo) y aun asi hay que poder verla.
  // Sin bandera de cancelacion a proposito: abrir el detalle es idempotente, y con
  // StrictMode (doble montaje en desarrollo) tanto un `cancelled` como un ref de "ya lo
  // hice" se comen la unica ejecucion util. El state se limpia recien DESPUES de abrir:
  // limpiarlo antes reejecuta este effect y aborta la apertura.
  useEffect(() => {
    const activityId = (location.state as { activityId?: string } | null)?.activityId
    if (!activityId) return
    activitiesService
      .getById(activityId)
      .then((a) => {
        if (a) openActivity(a)
        else toast.info('Esa actividad ya no existe')
        navigate(location.pathname, { replace: true, state: null })
      })
      .catch(() => toast.error('No pude abrir la actividad'))
    // openActivity/toast se recrean en cada render; solo importa el state de la ruta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, location.pathname, navigate])

  // Trae de nuevo la actividad abierta tras un cambio de estado (completed_at, etc.), sin
  // cerrar el panel: antes el modal se cerraba en cada accion y habia que volver a abrirlo.
  const refrescarAbierta = (id: string) => {
    activitiesService
      .getById(id)
      .then((a) => {
        if (a) setSelected((cur) => (cur?.id === id ? a : cur))
      })
      .catch(() => {})
  }

  // Completar es reversible: se hace al tiro y el aviso ofrece Deshacer (vuelve al estado
  // que tenia), en vez de pedir confirmacion antes.
  const completar = async (a: Activity) => {
    const anterior = a.status
    const ok = await act.changeStatus(a.id, 'completado', { silent: true })
    if (!ok) return
    refrescarAbierta(a.id)
    toast.success('Completada', {
      action: {
        label: 'Deshacer',
        onClick: () => {
          void act.changeStatus(a.id, anterior).then((bien) => bien && refrescarAbierta(a.id))
        },
      },
    })
  }

  const cambiarEstado = async (a: Activity, status: ActivityStatus) => {
    if (status === 'completado') return completar(a)
    const ok = await act.changeStatus(a.id, status)
    if (ok) refrescarAbierta(a.id)
  }

  const accionDeFila = (a: Activity) => {
    const accion = siguienteAccion(a)
    if (accion) void cambiarEstado(a, accion.status)
  }

  const eliminar = async (a: Activity) => {
    const ok = await confirm({
      title: 'Eliminar actividad',
      message: (
        <div className="space-y-2">
          <p>
            ¿Eliminar <span className="font-medium text-fg">"{a.title}"</span>?
          </p>
          <p className="text-xs text-fg-faint">
            No se puede deshacer. Si estaba vinculada a un tema de la minuta, el tema queda sin ese
            vínculo. Las actividades delegadas a partir de esta no se borran.
          </p>
        </div>
      ),
      confirmLabel: 'Eliminar',
      tone: 'danger',
    })
    if (!ok) return
    if (selected?.id === a.id) closePanel()
    await act.deleteActivity(a.id)
  }

  // Teclado (idea 8): flechas para recorrer la lista (con el panel abierto, el panel la
  // sigue), Enter para abrir. Esc lo maneja el propio panel. Un solo listener con los datos
  // frescos en un ref, para no re-suscribirlo en cada render.
  const teclado = useRef({ orden, selected, cursorId, openActivity })
  useLayoutEffect(() => {
    teclado.current = { orden, selected, cursorId, openActivity }
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) return
      // Con un dialogo encima (confirmar, asignar, guardar vista) el teclado es de el.
      if (document.querySelector('[aria-modal="true"]')) return
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, select, [contenteditable="true"]')) return
      const {
        orden: lista,
        selected: abierta,
        cursorId: cursor,
        openActivity: abrir,
      } = teclado.current
      if (lista.length === 0) return

      if (e.key === 'Enter') {
        // Enter sobre un boton es de ese boton.
        if (t?.closest('button, a, [role="radio"]')) return
        const fila = lista.find((a) => a.id === cursor)
        if (fila && !abierta) {
          e.preventDefault()
          abrir(fila)
        }
        return
      }

      e.preventDefault()
      const actual = abierta?.id ?? cursor
      const idx = lista.findIndex((a) => a.id === actual)
      const sig =
        idx === -1
          ? lista[0]
          : lista[Math.max(0, Math.min(lista.length - 1, idx + (e.key === 'ArrowDown' ? 1 : -1)))]
      if (abierta) abrir(sig)
      else setCursorId(sig.id)
      document.getElementById(filaDomId(sig.id))?.scrollIntoView({ block: 'nearest' })
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const exportar = () =>
    exportToCSV(
      activities.map((a) => ({
        Titulo: a.title,
        Descripcion: a.description,
        Prioridad: a.priority,
        Estado: statusLabels[a.status],
        Entrega: formatDateLocal(a.due_date),
        Creado: formatDateLocal(a.created_at),
        Cerrado: a.completed_at ? formatDateLocal(a.completed_at) : '-',
        'Dias para cerrar': a.completed_at
          ? Math.ceil(
              (parseDateLocal(a.completed_at).getTime() - parseDateLocal(a.created_at).getTime()) /
                86400000,
            )
          : '-',
        Observaciones: a.observations,
      })),
      'actividades',
    )

  const equipoMeta = act.filterTeam === 'todas' ? 'Todos los equipos' : teamNames[act.filterTeam]

  return (
    <div className="flex flex-col h-full bg-panel">
      <PageHeader
        title="Actividades"
        meta={[equipoMeta, activities.length].filter((x) => x !== undefined).join(' · ')}
        actions={
          <>
            <Button
              size="sm"
              variant="secondary"
              icon="download"
              title="Exportar a Excel"
              onClick={exportar}
            >
              <span className="hidden sm:inline">Exportar</span>
            </Button>
            {canAssignOthers && (
              <Button size="sm" icon="plus" onClick={() => setShowAssign(true)}>
                Asignar
              </Button>
            )}
          </>
        }
      >
        <VistasRapidas
          userId={user?.id}
          profileId={profile?.id}
          teamId={profile?.team_id}
          filtros={act.filtros}
          aplicar={act.aplicarFiltros}
        />
      </PageHeader>

      <ActivitiesFilters
        filtros={act.filtros}
        counts={act.counts}
        setFilterStatus={act.setFilterStatus}
        setFilterTeam={act.setFilterTeam}
        setFilterMember={act.setFilterMember}
        setFilterGrupo={act.setFilterGrupo}
        setFilterPlazo={act.setFilterPlazo}
        setDateType={act.setDateType}
        setDateFrom={act.setDateFrom}
        setDateTo={act.setDateTo}
        search={act.search}
        setSearch={act.setSearch}
        teamNames={teamNames}
        members={members}
        isManager={act.isManager}
        gruposDisponibles={act.gruposDisponibles}
        agrupacion={agrupacion}
        setAgrupacion={setAgrupacion}
      />

      {/* Con el panel abierto en pantallas grandes, la lista deja su espacio en vez de quedar
          tapada (el panel mide 400px, ver SidePanel). */}
      <div className={cx('flex-1 overflow-y-auto', selected && SIDE_PANEL_OFFSET)}>
        {loading ? (
          <div className="px-3 sm:px-5 py-3">
            <SkeletonRows rows={8} />
          </div>
        ) : activities.length === 0 ? (
          <ListaVacia
            hayOtras={allActivities.length > 0}
            filtroEquipo={act.filterTeam !== 'todas' ? teamNames[act.filterTeam] : null}
            sinEnEquipo={
              act.filterTeam !== 'todas' && !allActivities.some((a) => a.team_id === act.filterTeam)
            }
            total={allActivities.length}
            verTodosLosEquipos={() => act.setFilterTeam('todas')}
          />
        ) : (
          <ActivitiesTable
            grupos={grupos}
            plano={agrupacion === 'ninguno'}
            selectedId={selected?.id ?? cursorId}
            nombrePersona={nombrePersona}
            teamNames={teamNames}
            onOpen={(a) => openActivity(a)}
            onAccion={accionDeFila}
          />
        )}
      </div>

      <ActivityDetailPanel
        activity={selected}
        parentStack={parentStack}
        onBack={goBackToParent}
        onOpenChild={openChild}
        onClose={closePanel}
        onUpdated={setSelected}
        proyectoItems={proyectoItems}
        allActivities={allActivities}
        managedIds={act.managedIds}
        teamNames={teamNames}
        nombrePersona={nombrePersona}
        reload={act.reload}
        cambiarEstado={cambiarEstado}
        eliminar={eliminar}
      />

      {/* Montado solo mientras esta abierto: el formulario parte limpio cada vez. */}
      {showAssign && (
        <AssignActivityModal
          open
          onClose={() => setShowAssign(false)}
          userId={user?.id}
          teamId={profile?.team_id}
          members={members}
          onAssigned={act.reload}
        />
      )}
    </div>
  )
}

function ListaVacia({
  hayOtras,
  filtroEquipo,
  sinEnEquipo,
  total,
  verTodosLosEquipos,
}: {
  hayOtras: boolean
  filtroEquipo: string | null | undefined
  sinEnEquipo: boolean
  total: number
  verTodosLosEquipos: () => void
}) {
  if (!hayOtras) {
    return (
      <EmptyState
        icon="checkCircle"
        title="No hay actividades"
        description="Escribe en el chat para crear una."
      />
    )
  }
  // El listado parte filtrado por el equipo activo. Si ese equipo no tiene nada pero SI hay
  // actividades en otros, decirlo: "escribe en el chat para crear una" mandaria a crear algo
  // que ya existe al lado.
  if (sinEnEquipo) {
    return (
      <EmptyState
        icon="checkCircle"
        title={`No hay actividades en ${filtroEquipo ?? 'este equipo'}`}
        action={
          <Button size="sm" variant="secondary" onClick={verTodosLosEquipos}>
            Ver las de todos los equipos ({total})
          </Button>
        }
      />
    )
  }
  return (
    <EmptyState
      icon="filter"
      title="Ninguna actividad coincide con los filtros"
      description="Quita alguna ficha de filtro o cambia el estado."
    />
  )
}
