// Hoja de compromisos: la reunion semanal del equipo.
//
// QUE PROBLEMA RESUELVE
//
// Hoy la reunion se hace sobre la minuta completa: 112 temas abiertos de los cuales solo 18
// vencen esta semana. Se revisa todo, se avanza en nada. "Periodismo en vez de gestion".
//
// Esta hoja muestra UNA ventana: lo que se comprometio para esta semana. Ni lo de mas
// adelante ni lo que no tiene fecha.
//
// Y SOLO lo que nacio de la minuta. Un compromiso es algo que alguien tomo delante del
// equipo en la reunion; una actividad creada desde el chat es trabajo propio y no se le
// rinde cuentas a nadie en la reunion semanal. Mezclarlas volvia la hoja otra lista de
// tareas mas, que es justo lo que se queria evitar.
//
// DE DONDE SALE EL MODELO
//
// Del Level 10 Meeting de EOS, que es el estandar de la industria para esta reunion:
//   * el repaso es BINARIO -hecho / no hecho-, sin explicaciones, en unos 5 minutos
//   * la meta sana es 90% de cumplimiento semanal
//   * lo no hecho se mueve a la semana siguiente o baja a "temas a discutir" si hay un
//     bloqueo de fondo que merece conversacion
//   * nada deberia quedar mas de dos semanas dando vueltas
//
// Por eso la UI prioriza la velocidad de marcar por sobre la riqueza de datos: en una
// reunion de 5 minutos, un formulario mata la dinamica.
//
// NO HAY TABLA NUEVA. Un compromiso es una actividad con fecha de entrega en la ventana.
// Los datos ya existen (due_date, completed_at que pone un trigger), y duplicarlos en otra
// tabla habria creado justamente el problema que estamos tratando de deshacer.

import { useState, useEffect, useCallback, useRef } from 'react'
import { activitiesService } from '@infrastructure/supabase/activities.service'
import { profilesService } from '@infrastructure/supabase/profiles.service'
import { minutesService } from '@infrastructure/supabase/minutes.service'
import { teamsService, type GrupoTrabajo } from '@infrastructure/supabase/teams.service'
import { useAuth } from '@core/auth/hooks/useAuth'
import { useCapabilities } from '@core/auth/hooks/useCapabilities'
import {
  compromisosEnVentana,
  compromisosVencidosAbiertos,
  compromisoStats,
} from '@shared/utils/compromisos'
import type { Activity, MinuteItem, Profile } from '@shared/types'
import {
  llevarActividadAMinuta,
  moverActividadUnaSemana,
  temaDeActividad,
} from '@features/compromisos/utils/operaciones'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** Lunes a domingo de la semana desplazada N semanas desde hoy. */
export function semanaDe(offset: number): { desde: Date; hasta: Date; etiqueta: string } {
  const d = new Date()
  d.setDate(d.getDate() + offset * 7)
  const aLunes = (d.getDay() + 6) % 7
  const desde = new Date(d)
  desde.setDate(d.getDate() - aLunes)
  desde.setHours(0, 0, 0, 0)
  const hasta = new Date(desde)
  hasta.setDate(desde.getDate() + 6)
  hasta.setHours(23, 59, 59, 999)
  return {
    desde,
    hasta,
    etiqueta: `${desde.getDate()} ${MESES[desde.getMonth()]} – ${hasta.getDate()} ${MESES[hasta.getMonth()]}`,
  }
}

export interface Compromiso extends Activity {
  /** Se cerro dentro del plazo. Solo tiene sentido si esta completada. */
  aTiempo: boolean
  /** Dias que lleva vencida sin cerrarse. 0 si no esta vencida. */
  diasVencida: number
  /** Ya se escalo a la minuta para conversarse. */
  enMinuta: boolean
  /** De donde salio: un tema suelto de minuta, un subtema de minuta (parent_item_id), o un
   * item de la hoja Proyectos (cualquier nivel). */
  origen: 'minuta' | 'subtema' | 'proyecto'
  /** Titulo del tema raiz (o nombre del proyecto), salvo origen 'minuta'. Da contexto. */
  origenProyecto?: string
  /** Id del proyecto (o tema raiz), para su punto de color. */
  origenProyectoId?: string
  /** Id del tema de Minuta que originó este compromiso (via linked_activity_ids). Los
   * comentarios de un compromiso SON los del tema, no los de la actividad -la nota real
   * ("Situación: ... Accion: ...") vive ahi, no en `observations` (bug real reportado). */
  temaId?: string
  comentariosTema: string
}

export interface GrupoPersona {
  id: string
  nombre: string
  avatar: string | null
  compromisos: Compromiso[]
  cumplidos: number
  /** Mismo resumen que el general de arriba, pero de esta persona. */
  total: number
  porcentaje: number | null
  vencidos: number
}

/** Agrupa personas por su grupo de trabajo (alias "foco", migracion 043). `id: null` es el
 *  balde de quien no tiene grupo asignado -no se descarta, solo no encaja en ningun grupo-. */
export interface GrupoDeTrabajoCompromisos {
  id: string | null
  nombre: string
  personas: GrupoPersona[]
}

export function useCompromisos() {
  const [todas, setTodas] = useState<Activity[]>([])
  const [temas, setTemas] = useState<MinuteItem[]>([])
  // Copia sincronica de `temas` para las acciones en lote (Cerrar semana): un bucle de
  // moverUnaSemana leia siempre el `temas` del render en que empezo, y dos actividades del mismo
  // tema calculaban plazo_history/plazo_change_count desde el mismo valor viejo, pisandose.
  const temasRef = useRef<MinuteItem[]>([])
  useEffect(() => {
    temasRef.current = temas
  }, [temas])
  const [miembros, setMiembros] = useState<Profile[]>([])
  // Actividades que ya tienen un tema de minuta esperando conversacion. Sin esto la fila no
  // cambiaba al escalarla y la gente volvia a apretar el boton: pasó de verdad, tres temas
  // identicos en 25 segundos.
  const [escaladas, setEscaladas] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [gruposDisponibles, setGruposDisponibles] = useState<GrupoTrabajo[]>([])
  const [grupoPorUsuario, setGrupoPorUsuario] = useState<Record<string, string | null>>({})
  const { profile } = useAuth()
  const { canViewAllActivities, isGlobalAdmin } = useCapabilities()
  const teamId = profile?.team_id ?? ''

  // Grupos de trabajo (alias "foco", migracion 043): solo para ofrecer la vista "por grupo"
  // -si el equipo no usa grupos, esto queda vacio y la pantalla se ve exactamente igual que
  // siempre (agrupada por persona, sin nada nuevo que aprender).
  useEffect(() => {
    if (!teamId) return
    let cancelled = false
    Promise.all([teamsService.getGrupos(teamId), teamsService.getMembers(teamId)]).then(
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
  }, [teamId])

  const load = useCallback(async () => {
    if (!teamId) return
    // Compromiso = lo que alguien asumio con el equipo: nacio de un tema de Minuta o de un
    // item de Proyectos (pedido de Sebastian). Lo creado como actividad propia por el chat no
    // tiene tema y queda fuera solo.
    const [acts, gente, minuta, proyectos] = await Promise.all([
      activitiesService.getByTeam(teamId),
      profilesService.getByTeam(teamId),
      minutesService.getByTeam(teamId, 'minuta'),
      minutesService.getByTeam(teamId, 'proyecto'),
    ])
    const temas = [...minuta, ...proyectos]
    setTodas(acts)
    setTemas(temas)
    setMiembros(gente)
    setEscaladas(
      new Set(
        minuta
          .filter((t) => t.estado === 'definir')
          .flatMap((t) => t.linked_activity_ids as string[]),
      ),
    )
    setLoading(false)
  }, [teamId])

  useEffect(() => {
    if (!profile) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [profile, load])

  const { desde, hasta, etiqueta } = semanaDe(offset)
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  // Quien ve a quien: la misma regla del resto de la app. Un colaborador ve lo suyo; quien
  // puede ver todo el equipo, ve a todos. La reunion la conduce esa persona.
  //
  // El filtro "nacio de un tema de minuta + cae en esta semana" es el mismo que usa el chat
  // (ver buildTeamData en useChatMessages.ts) para no responder con numeros distintos a los
  // que muestra esta pantalla; vive en shared/utils/compromisos.ts.
  const puedeVer = (a: Activity) =>
    canViewAllActivities || isGlobalAdmin || a.responsible_id === profile?.id
  const visibles = compromisosEnVentana(todas, temas, desde, hasta).filter(puedeVer)

  // Tema que trajo esta actividad (prefiere el proyecto): ver temaDeActividad.
  const temaDe = (activityId: string) => temaDeActividad(temas, activityId)

  // Sube por parent_item_id hasta el tema raiz. Todos los ancestros estan en `temas` -mismo
  // equipo, y la cadena nunca cruza de hoja-, asi que nunca queda cortada a mitad.
  const raizDe = (item: MinuteItem): MinuteItem => {
    let actual = item
    while (actual.parent_item_id) {
      const padre = temas.find((t) => t.id === actual.parent_item_id)
      if (!padre) break
      actual = padre
    }
    return actual
  }

  const decorar = (a: Activity): Compromiso => {
    const vence = new Date(a.due_date)
    vence.setHours(0, 0, 0, 0)
    const completada = a.status === 'completado'
    const origenTema = temaDe(a.id)
    const origen: Compromiso['origen'] =
      origenTema?.tipo === 'proyecto'
        ? 'proyecto'
        : origenTema?.parent_item_id
          ? 'subtema'
          : 'minuta'
    return {
      ...a,
      aTiempo: completada && !!a.completed_at && new Date(a.completed_at) <= new Date(a.due_date),
      diasVencida:
        !completada && vence < hoy ? Math.floor((hoy.getTime() - vence.getTime()) / 86_400_000) : 0,
      enMinuta: escaladas.has(a.id),
      origen,
      origenProyecto: origen !== 'minuta' ? raizDe(origenTema!).tema : undefined,
      origenProyectoId: origen === 'proyecto' ? raizDe(origenTema!).id : undefined,
      temaId: origenTema?.id,
      comentariosTema: origenTema?.comentarios ?? '',
    }
  }

  const compromisos = visibles.map(decorar)

  // Agrupado por persona: la reunion recorre "que te toco a ti", no una lista plana.
  const agruparPorPersona = (lista: Compromiso[]): GrupoPersona[] =>
    miembros
      .map((m) => {
        const suyos = lista.filter((c) => c.responsible_id === m.id)
        const cumplidos = suyos.filter((c) => c.status === 'completado').length
        return {
          id: m.id,
          nombre: m.full_name,
          avatar: m.avatar_url ?? null,
          // Lo no cumplido primero: en la reunion es lo que hay que conversar.
          compromisos: suyos.sort((a, b) => {
            const ha = a.status === 'completado' ? 1 : 0
            const hb = b.status === 'completado' ? 1 : 0
            return ha !== hb ? ha - hb : a.due_date.localeCompare(b.due_date)
          }),
          cumplidos,
          total: suyos.length,
          porcentaje: suyos.length ? Math.round((cumplidos / suyos.length) * 100) : null,
          vencidos: suyos.filter((c) => c.diasVencida > 0).length,
        }
      })
      .filter((g) => g.compromisos.length > 0)
      .sort((a, b) => b.compromisos.length - a.compromisos.length)

  const porPersona = agruparPorPersona(compromisos)

  // Vencidos y no cerrados de CUALQUIER semana (ver compromisosVencidosAbiertos). No dependen
  // de la semana elegida: el boton de la cabecera los cuenta siempre, para que lo no cumplido
  // no se esconda solo al pasar de semana. No suman al % semanal: son otra pregunta.
  const vencidosAbiertos = compromisosVencidosAbiertos(todas, temas).filter(puedeVer).map(decorar)
  const vencidosPorPersona = agruparPorPersona(vencidosAbiertos)

  // Mismo `porPersona`, reagrupado por su grupo de trabajo. Solo tiene datos si el equipo
  // efectivamente definio y asigno grupos -si no, queda [] y la UI ofrece solo "por persona".
  const porGrupo: GrupoDeTrabajoCompromisos[] = (() => {
    if (gruposDisponibles.length === 0) return []
    const porGrupoId = new Map<string | null, GrupoPersona[]>()
    porPersona.forEach((p) => {
      const gId = grupoPorUsuario[p.id] ?? null
      porGrupoId.set(gId, [...(porGrupoId.get(gId) ?? []), p])
    })
    const nombrados = gruposDisponibles
      .map((g) => ({ id: g.id, nombre: g.nombre, personas: porGrupoId.get(g.id) ?? [] }))
      .filter((g) => g.personas.length > 0)
    const sinGrupo = porGrupoId.get(null) ?? []
    return sinGrupo.length > 0
      ? [...nombrados, { id: null, nombre: 'Sin grupo', personas: sinGrupo }]
      : nombrados
  })()

  const resumen = {
    ...compromisoStats(compromisos),
    aTiempo: compromisos.filter((c) => c.aTiempo).length,
  }

  /** Marca hecho o deshecho. El trigger de la base pone completed_at. */
  const marcar = async (id: string, hecha: boolean) => {
    const anterior = todas
    setTodas((cur) =>
      cur.map((a) => (a.id === id ? { ...a, status: hecha ? 'completado' : 'pendiente' } : a)),
    )
    try {
      await activitiesService.update(id, { status: hecha ? 'completado' : 'pendiente' })
      await load() // para traer el completed_at que puso el trigger
    } catch (err) {
      setTodas(anterior)
      throw err
    }
  }

  /** Mueve el compromiso a la semana siguiente (regla de EOS: se arrastra o se discute). */
  const moverUnaSemana = async (a: Activity) => {
    const nueva = new Date(a.due_date)
    nueva.setDate(nueva.getDate() + 7)
    setTodas((cur) => cur.map((x) => (x.id === a.id ? { ...x, due_date: nueva.toISOString() } : x)))
    try {
      // Sincroniza tambien el plazo del tema que la origino (ver moverActividadUnaSemana).
      // Se lee temasRef y no `temas`: en un lote, dos actividades del mismo tema calculaban el
      // historial desde el mismo valor viejo y se pisaban.
      const { tema } = await moverActividadUnaSemana(a, temasRef.current)
      if (tema) {
        temasRef.current = temasRef.current.map((t) => (t.id === tema.id ? tema : t))
        setTemas(temasRef.current)
      }
    } catch (err) {
      // Se revierte SOLO esta actividad: en un lote, una foto de todas tomada al principio
      // desharia en pantalla las que si se guardaron.
      setTodas((cur) => cur.map((x) => (x.id === a.id ? { ...x, due_date: a.due_date } : x)))
      throw err
    }
  }

  /** Comentarios del compromiso: son los del TEMA de Minuta que lo originó
   * (`minute_items.comentarios`), no los de la actividad -ahi vive la nota real ("Situación:
   * ... Accion: ..."), no en `observations` (bug real reportado: primera version editaba el
   * campo equivocado, que siempre estaba vacio). Hoy no se mostraba en absoluto en esta hoja,
   * a pedido de Sebastian se agrega editable. */
  const guardarComentario = async (temaId: string, next: string) => {
    const anterior = temas
    setTemas((cur) => cur.map((t) => (t.id === temaId ? { ...t, comentarios: next } : t)))
    try {
      await minutesService.update(temaId, { comentarios: next })
    } catch (err) {
      setTemas(anterior)
      throw err
    }
  }

  /**
   * Baja el compromiso a la minuta como tema a discutir.
   *
   * Es la valvula de escape del modelo: si algo no se hizo porque hay un bloqueo de fondo,
   * moverlo de semana otra vez no resuelve nada. Vuelve a la minuta, que es donde se
   * conversa, y la actividad queda vinculada para no perder el hilo.
   */
  const llevarAMinuta = async (a: Activity) => {
    if (!profile) return
    // Idempotente: si ya hay un tema esperando conversacion para esta actividad, no se crea
    // otro. La UI ademas desactiva el boton, pero la guardia va aca por si se hace doble
    // clic antes de que el estado se actualice.
    if (escaladas.has(a.id)) return
    setEscaladas((cur) => new Set(cur).add(a.id))
    await llevarActividadAMinuta(a, { teamId, userId: profile.id }).catch((err) => {
      setEscaladas((cur) => {
        const n = new Set(cur)
        n.delete(a.id)
        return n
      })
      throw err
    })
  }

  return {
    porPersona,
    porGrupo,
    vencidosPorPersona,
    totalVencidos: vencidosAbiertos.length,
    resumen,
    loading,
    offset,
    setOffset,
    etiqueta,
    esSemanaActual: offset === 0,
    marcar,
    moverUnaSemana,
    llevarAMinuta,
    guardarComentario,
    reload: load,
  }
}
