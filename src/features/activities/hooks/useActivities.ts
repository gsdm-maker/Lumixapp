import { useState, useEffect, useCallback, useRef } from 'react'
import { activitiesService } from '@infrastructure/supabase/activities.service'
import { notificationsService } from '@infrastructure/supabase/notifications.service'
import { profilesService } from '@infrastructure/supabase/profiles.service'
import { minutesService } from '@infrastructure/supabase/minutes.service'
import { teamsService, type GrupoTrabajo } from '@infrastructure/supabase/teams.service'
import { useAuth } from '@core/auth/hooks/useAuth'
import { parseDateLocal } from '@shared/utils/date'
import { useToast } from '@shared/components/ui/Toast'
import type { Activity, ActivityStatus, MinuteItem, Profile } from '@shared/types'
import { enPlazo, type FiltroPlazo } from '@features/activities/utils/urgencia'

export type FiltroEstado = ActivityStatus | 'todas' | 'activas'
export type TipoFecha = 'creadas' | 'cerradas' | 'entrega'

/**
 * Combinacion completa de filtros de la lista. Existe como objeto (y no solo como estados
 * sueltos) para poder guardarla como "vista" y volver a aplicarla de una vez.
 */
export interface FiltrosActividades {
  status: FiltroEstado
  team: string
  member: string
  grupo: string
  plazo: FiltroPlazo
  dateType: TipoFecha
  dateFrom: string
  dateTo: string
}

// Actividades PERSONALES + de los equipos que lidero (cross-equipo). Privacidad:
// veo TODAS las mias (en cualquier equipo) y, de terceros, solo en equipos donde soy jefe.
export function useActivities() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [members, setMembers] = useState<Profile[]>([])
  // Items de Proyectos de mis equipos: solo para agrupar en la lista las actividades de
  // subtareas bajo la de su item padre (ver utils/arbol.ts).
  const [proyectoItems, setProyectoItems] = useState<MinuteItem[]>([])
  const [teamNames, setTeamNames] = useState<Record<string, string>>({})
  const [managedIds, setManagedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<FiltroEstado>('activas')
  // Plazo relativo ("vencidas", "esta semana"): a diferencia del rango de fechas, sigue
  // valiendo manana, por eso es lo que usan las vistas rapidas.
  const [filterPlazo, setFilterPlazo] = useState<FiltroPlazo>('todos')
  const [dateType, setDateType] = useState<TipoFecha>('entrega')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  // Arranca en el equipo activo del selector de arriba, no en "todas".
  //
  // Esta pantalla es la unica que no seguia ese selector: cargaba mis actividades de todos
  // los equipos mas las de los que lidero, y dejaba el filtro en "todas". Como usuario
  // cambiabas de equipo arriba, no pasaba nada aca, y tenias que volver a filtrar adentro.
  // Eran dos ideas distintas de "equipo actual" conviviendo en la misma app.
  //
  // La vista cruzada NO se pierde: sigue estando a un clic en la opcion "Todos los equipos".
  // Lo que cambia es cual es el punto de partida.
  const [filterTeam, setFilterTeam] = useState<string>('todas')
  const [filterMember, setFilterMember] = useState<string>('todas')
  const [filterGrupo, setFilterGrupo] = useState<string>('todas')
  const [gruposDisponibles, setGruposDisponibles] = useState<GrupoTrabajo[]>([])
  const [grupoPorUsuario, setGrupoPorUsuario] = useState<Record<string, string | null>>({})
  const [search, setSearch] = useState('')
  const { user, profile } = useAuth()
  const toast = useToast()

  // El perfil llega despues del primer render, asi que el default se aplica cuando aparece.
  // Con un ref y no con un estado para no re-renderizar de mas, y para que se aplique UNA
  // sola vez: si no, cada recarga del perfil pisaria el filtro que el usuario acaba de elegir.
  const defaultAplicado = useRef(false)
  useEffect(() => {
    if (defaultAplicado.current || !profile?.team_id) return
    defaultAplicado.current = true
    setFilterTeam(profile.team_id)
  }, [profile?.team_id])

  const load = useCallback(async () => {
    if (!user) return
    const [myTeams, managed] = await Promise.all([
      teamsService.getMyTeams(user.id),
      teamsService.getManagedTeams(user.id),
    ])
    const mIds = managed.map((t) => t.id)
    setManagedIds(mIds)
    const names: Record<string, string> = {}
    ;[...myTeams, ...managed].forEach((t) => (names[t.id] = t.name))
    setTeamNames(names)

    // Mis actividades (todos los equipos) + todas las de los equipos que lidero. Deduplicado.
    const [mine, managedActs] = await Promise.all([
      activitiesService.getByResponsibleAll(user.id),
      activitiesService.getByTeams(mIds),
    ])
    const map = new Map<string, Activity>()
    ;[...mine, ...managedActs].forEach((a) => map.set(a.id, a))
    setActivities([...map.values()].filter((a) => !a.title.startsWith('[Ingesta]')))

    // Si falla (ej. un equipo sin permiso de lectura de proyectos), la lista se ve plana como
    // antes: el agrupado es un extra, no algo de lo que dependa la pantalla.
    const proyectos = await Promise.all(
      Object.keys(names).map((id) =>
        minutesService.getByTeam(id, 'proyecto').catch(() => [] as MinuteItem[]),
      ),
    )
    setProyectoItems(proyectos.flat())

    // Miembros (para nombres/filtro): de los equipos que lidero + yo mismo.
    const memberLists = await Promise.all(mIds.map((id) => profilesService.getByTeam(id)))
    const memberMap = new Map<string, Profile>()
    memberLists.flat().forEach((m) => memberMap.set(m.id, m))
    if (profile && !memberMap.has(profile.id)) memberMap.set(profile.id, profile as Profile)
    setMembers([...memberMap.values()])
    setLoading(false)
  }, [user, profile])

  useEffect(() => {
    if (!user) return
    // load() es async: los setState ocurren tras el await, no sincronicamente en el effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [user, load])

  // Grupos de trabajo (alias "foco", migracion 043) del equipo elegido: solo tiene sentido
  // resolverlos cuando hay UN equipo especifico seleccionado (el grupo es un concepto por
  // equipo). Si se vuelve a "todas", se limpia para no dejar un filtro fantasma aplicado.
  useEffect(() => {
    if (filterTeam === 'todas') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGruposDisponibles([])
      setGrupoPorUsuario({})
      setFilterGrupo('todas')
      return
    }
    let cancelled = false
    Promise.all([teamsService.getGrupos(filterTeam), teamsService.getMembers(filterTeam)]).then(
      ([grupos, miembros]) => {
        if (cancelled) return
        setGruposDisponibles(grupos)
        const map: Record<string, string | null> = {}
        miembros.forEach((m) => {
          map[m.user_id] = m.grupo_id ?? null
        })
        setGrupoPorUsuario(map)
      },
    )
    return () => {
      cancelled = true
    }
  }, [filterTeam])

  const isManager = managedIds.length > 0

  let filtered = activities

  if (filterStatus === 'activas') {
    filtered = filtered.filter((a) => a.status !== 'completado')
  } else if (filterStatus !== 'todas') {
    filtered = filtered.filter((a) => a.status === filterStatus)
  }

  // Base para contadores: aplica equipo/miembro/fecha/busqueda, pero NO el filtro de estado.
  let countBase = activities

  if (filterTeam !== 'todas') {
    filtered = filtered.filter((a) => a.team_id === filterTeam)
    countBase = countBase.filter((a) => a.team_id === filterTeam)
  }

  if (filterMember !== 'todas') {
    filtered = filtered.filter((a) => a.responsible_id === filterMember)
    countBase = countBase.filter((a) => a.responsible_id === filterMember)
  }

  if (filterGrupo !== 'todas') {
    const enGrupo = (a: Activity) => (grupoPorUsuario[a.responsible_id] ?? null) === filterGrupo
    filtered = filtered.filter(enGrupo)
    countBase = countBase.filter(enGrupo)
  }

  if (dateFrom && dateTo) {
    const datePredicate = (a: Activity) => {
      const field =
        dateType === 'creadas'
          ? a.created_at
          : dateType === 'cerradas'
            ? a.completed_at
            : a.due_date
      if (!field) return false
      const d = parseDateLocal(field)
      const from = parseDateLocal(dateFrom + 'T00:00:00')
      const to = parseDateLocal(dateTo + 'T23:59:59')
      return d >= from && d <= to
    }
    filtered = filtered.filter(datePredicate)
    countBase = countBase.filter(datePredicate)
  }

  if (filterPlazo !== 'todos') {
    const porPlazo = (a: Activity) => enPlazo(a, filterPlazo)
    filtered = filtered.filter(porPlazo)
    countBase = countBase.filter(porPlazo)
  }

  if (search.trim()) {
    const q = search.trim().toLowerCase()
    const matches = (a: Activity) =>
      `${a.title} ${a.description ?? ''} ${a.observations ?? ''}`.toLowerCase().includes(q)
    filtered = filtered.filter(matches)
    countBase = countBase.filter(matches)
  }

  /**
   * Elimina una actividad. La RLS decide quien puede (migracion 038) y un trigger limpia el
   * vinculo con la minuta y las notificaciones. Se saca de la lista al tiro para que la
   * pantalla no muestre algo que ya no existe.
   */
  const deleteActivity = async (id: string) => {
    const anterior = activities
    setActivities((cur) => cur.filter((a) => a.id !== id))
    try {
      await activitiesService.remove(id)
      toast.success('Actividad eliminada')
    } catch {
      setActivities(anterior)
      toast.error('No se pudo eliminar')
    }
  }

  /**
   * Cambia el estado y recarga. Devuelve si funciono. `silent` evita el aviso generico para
   * que quien llama muestre el suyo (ej. "Completada" con Deshacer).
   */
  /**
   * Revierte un "Completar" (boton Deshacer del aviso). No alcanza con volver el status: el
   * trigger set_completed_at (migracion 009) solo PONE completed_at, nunca lo limpia, y la
   * actividad quedaria abierta con fecha de cierre (se ve en exportaciones y el Dashboard).
   */
  const deshacerCompletar = async (id: string, statusAnterior: ActivityStatus) => {
    try {
      await activitiesService.update(id, { status: statusAnterior, completed_at: null })
      await load()
      return true
    } catch {
      toast.error('No se pudo deshacer')
      return false
    }
  }

  const changeStatus = async (
    id: string,
    newStatus: ActivityStatus,
    opts?: { silent?: boolean },
  ): Promise<boolean> => {
    try {
      await activitiesService.update(id, { status: newStatus })
      const previa = activities.find((a) => a.id === id)
      if (newStatus === 'falta_informacion' && previa && previa.status !== 'falta_informacion') {
        // A quien puede destrabarla: el lider y quien la creo (suele ser quien tiene el dato).
        await notificationsService.sendToTeam(
          previa.team_id,
          {
            title: 'Falta información',
            body: `"${previa.title}" está esperando información`,
            type: 'missing_info',
            metadata: { activity_id: id },
          },
          {
            exceptUserId: user?.id,
            roles: ['admin', 'lider'],
            alsoUserIds: [previa.created_by, previa.responsible_id],
          },
        )
      }
      if (newStatus === 'bloqueado') {
        const activity = activities.find((a) => a.id === id)
        if (activity) {
          // Solo a quien puede desbloquearla: el lider del equipo y el responsable.
          await notificationsService.sendToTeam(
            activity.team_id,
            {
              title: 'Actividad bloqueada',
              body: `"${activity.title}" ha sido bloqueada`,
              type: 'activity_blocked',
              metadata: { activity_id: id },
            },
            {
              exceptUserId: user?.id,
              roles: ['admin', 'lider'],
              alsoUserIds: [activity.responsible_id],
            },
          )
        }
      }
      await load()
      if (!opts?.silent) toast.success('Estado actualizado')
      return true
    } catch {
      toast.error('No se pudo actualizar el estado')
      return false
    }
  }

  const filtros: FiltrosActividades = {
    status: filterStatus,
    team: filterTeam,
    member: filterMember,
    grupo: filterGrupo,
    plazo: filterPlazo,
    dateType,
    dateFrom,
    dateTo,
  }

  // Aplica una vista guardada de una vez. El grupo se respeta aunque cambie el equipo: el
  // effect de grupos solo lo limpia cuando el equipo pasa a "todas".
  const aplicarFiltros = (f: FiltrosActividades) => {
    setFilterStatus(f.status)
    setFilterTeam(f.team)
    setFilterMember(f.member)
    setFilterGrupo(f.team === 'todas' ? 'todas' : f.grupo)
    setFilterPlazo(f.plazo)
    setDateType(f.dateType)
    setDateFrom(f.dateFrom)
    setDateTo(f.dateTo)
  }

  filtered = [...filtered].sort((a, b) => {
    const dateA = parseDateLocal(a.due_date).getTime()
    const dateB = parseDateLocal(b.due_date).getTime()
    if (dateA !== dateB) return dateA - dateB
    return a.priority - b.priority
  })

  const allStatuses: FiltroEstado[] = [
    'todas',
    'activas',
    'pendiente',
    'en_proceso',
    'bloqueado',
    'falta_informacion',
    'esperando_aprobacion',
    'completado',
  ]

  const counts = {} as Record<FiltroEstado, number>
  for (const s of allStatuses) {
    if (s === 'activas') {
      counts[s] = countBase.filter((a) => a.status !== 'completado').length
    } else {
      counts[s] = s === 'todas' ? countBase.length : countBase.filter((a) => a.status === s).length
    }
  }

  return {
    activities: filtered,
    allActivities: activities,
    proyectoItems,
    members,
    teamNames,
    managedIds,
    isManager,
    loading,
    filterStatus,
    setFilterStatus,
    changeStatus,
    deshacerCompletar,
    deleteActivity,
    counts,
    filterTeam,
    setFilterTeam,
    filterMember,
    setFilterMember,
    filterGrupo,
    setFilterGrupo,
    filterPlazo,
    setFilterPlazo,
    gruposDisponibles,
    filtros,
    aplicarFiltros,
    search,
    setSearch,
    dateType,
    setDateType,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    reload: load,
  }
}

export function getDaysRemaining(dueDate: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const due = parseDateLocal(dueDate)
  due.setHours(0, 0, 0, 0)
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

// Tokens semanticos (no colores de Tailwind): asi el Cronograma, que tambien lo usa, sigue
// el tema claro/oscuro sin cambios propios.
export function getDaysColor(days: number): string {
  if (days < 0) return 'text-danger'
  if (days <= 2) return 'text-warning'
  return 'text-fg-faint'
}

export const statusLabels: Record<ActivityStatus, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  bloqueado: 'Bloqueado',
  falta_informacion: 'Falta info',
  esperando_aprobacion: 'Esperando aprobación',
  completado: 'Completado',
}
