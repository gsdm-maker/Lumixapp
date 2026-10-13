import { useState, useEffect, useMemo } from 'react'
import { activitiesService } from '@infrastructure/supabase/activities.service'
import { errorsService } from '@infrastructure/supabase/errors.service'
import { profilesService } from '@infrastructure/supabase/profiles.service'
import { minutesService } from '@infrastructure/supabase/minutes.service'
import { teamsService } from '@infrastructure/supabase/teams.service'
import { useAuth } from '@core/auth/hooks/useAuth'
import { useCapabilities } from '@core/auth/hooks/useCapabilities'
import { deriveEstado } from '@shared/utils/compromisos'
import { parseDateLocal } from '@shared/utils/date'
import { resumirProyecto, type ResumenProyecto } from '@features/proyectos/utils/proyecto'
import type { DecoratedItem } from '@features/minuta/hooks/useMinuta'
import type { Activity, AppError, MinuteItem, Profile } from '@shared/types'
import {
  PERIODO,
  cargaPorPersona,
  compromisosSemanales,
  delta,
  edadErrores,
  fotosSemanales,
  rendimientoSemanal,
  sumarCompromisos,
  ultimasSemanas,
  type Periodo,
} from '@features/dashboard/utils/metricas'

interface Datos {
  actividades: Activity[]
  errores: AppError[]
  miembros: Profile[]
  temas: MinuteItem[]
}

export interface ProyectoFila {
  id: string
  nombre: string
  resumen: ResumenProyecto
}

/** De donde salio una actividad, para dar contexto en las listas ("Minuta", el proyecto). */
export type Origenes = Record<string, string>

const VACIO: Datos = { actividades: [], errores: [], miembros: [], temas: [] }

// Orden de la tarjeta Proyectos: lo que necesita atencion primero.
const PRIORIDAD_ESTADO = { atrasado: 0, en_curso: 1, sin_actividad: 2, completado: 3 }

/**
 * Datos del dashboard. Carga una vez (actividades, errores, personas, temas de Minuta y
 * Proyectos) y calcula todo lo demas al vuelo segun el periodo elegido: cambiar de periodo no
 * vuelve a pedir nada a la base.
 */
export function useDashboard(periodo: Periodo) {
  const [datos, setDatos] = useState<Datos>(VACIO)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [teamName, setTeamName] = useState<string | null>(null)
  const { user, profile } = useAuth()
  const { isIntegrante } = useCapabilities()
  const teamId = profile?.team_id ?? ''
  const userId = user?.id

  useEffect(() => {
    if (!userId || !teamId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(false)
      try {
        const [actividades, errores, miembros, minuta, proyectos] = await Promise.all([
          activitiesService.getByTeam(teamId),
          errorsService.getByTeam(teamId),
          profilesService.getByTeam(teamId),
          minutesService.getByTeam(teamId, 'minuta'),
          minutesService.getByTeam(teamId, 'proyecto'),
        ])
        if (cancelled) return
        setDatos({ actividades, errores, miembros, temas: [...minuta, ...proyectos] })
      } catch (err) {
        console.error('Dashboard load failed:', err)
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [userId, teamId, reloadKey])

  // Nombre del equipo para el encabezado. Aparte de la carga principal: si falla, el
  // dashboard se ve igual, solo sin el nombre.
  useEffect(() => {
    if (!teamId) return
    let cancelled = false
    teamsService
      .getById(teamId)
      .then((t) => {
        if (!cancelled) setTeamName(t?.name ?? null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [teamId])

  const vista = useMemo(
    () => calcular(datos, periodo, isIntegrante ? userId : undefined),
    [datos, periodo, isIntegrante, userId],
  )

  return {
    ...vista,
    teamName,
    isIntegrante,
    loading,
    error,
    reload: () => setReloadKey((k) => k + 1),
  }
}

/**
 * Todo lo que muestra la pagina. `soloDe`: un member ve solo lo suyo (mismo criterio que
 * tenia el dashboard), quien ve al equipo lo ve todo.
 */
function calcular(datos: Datos, periodo: Periodo, soloDe?: string) {
  const { semanas: n, grafico } = PERIODO[periodo]
  const propio = <T extends { responsible_id: string }>(x: T) =>
    !soloDe || x.responsible_id === soloDe
  const acts = datos.actividades.filter(propio)
  const miembros = soloDe ? datos.miembros.filter((m) => m.id === soloDe) : datos.miembros

  // Semanas suficientes para el grafico y para comparar el periodo con el anterior.
  const total = Math.max(grafico, n * 2, 7)
  const semanas = ultimasSemanas(total)
  const rend = rendimientoSemanal(acts, semanas)
  const fotos = fotosSemanales(acts, semanas)
  const comp = compromisosSemanales(acts, datos.temas, semanas)

  const abiertas = acts.filter((a) => a.status !== 'completado')
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const vencidas = abiertas
    .filter((a) => parseDateLocal(a.due_date) < hoy)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
  const enUnaSemana = new Date(hoy.getTime() + 7 * 86400000)
  const proximas = abiertas
    .filter((a) => {
      const d = parseDateLocal(a.due_date)
      return d >= hoy && d <= enUnaSemana
    })
    .sort((a, b) => a.priority - b.priority || a.due_date.localeCompare(b.due_date))

  // Comparacion: el cierre del periodo anterior (pendientes, vencidas) o la suma del periodo
  // anterior (completadas, compromisos).
  const sumar = (desde: number, hasta: number) =>
    rend.slice(desde, hasta).reduce((s, x) => s + x.completadas, 0)
  const completadas = sumar(total - n, total)
  const completadasAntes = sumar(total - 2 * n, total - n)
  const antes = fotos[total - 1 - n]
  const compromisos = sumarCompromisos(comp.slice(total - n))

  const errores = datos.errores
    .filter(propio)
    .filter((e) => e.status !== 'cerrado' && e.status !== 'resuelto')

  return {
    kpis: {
      pendientes: {
        valor: abiertas.length,
        ...delta(abiertas.length, antes.pendientes, true),
        serie: fotos.slice(-7).map((f) => f.pendientes),
        enProceso: abiertas.filter((a) => a.status === 'en_proceso').length,
        bloqueadas: abiertas.filter((a) => a.status === 'bloqueado').length,
      },
      vencidas: {
        valor: vencidas.length,
        ...delta(vencidas.length, antes.vencidas, true),
        serie: fotos.slice(-7).map((f) => f.vencidas),
        masAntigua: vencidas[0]?.due_date ?? null,
      },
      completadas: {
        valor: completadas,
        ...delta(completadas, completadasAntes, false),
        anterior: completadasAntes,
        serie: rend.slice(-7).map((r) => r.completadas),
      },
      compromisos: { ...compromisos, meta: 90 },
    },
    rendimiento: rend.slice(-grafico),
    compromisosSemana: comp.slice(-grafico),
    carga: cargaPorPersona(acts, miembros),
    proyectos: proyectosConAlertas(datos, soloDe),
    vencidas,
    proximas,
    errores,
    edadErrores: edadErrores(errores),
    origenes: origenesDe(datos.temas),
    memberNames: Object.fromEntries(datos.miembros.map((m) => [m.id, m.full_name])),
  }
}

/** Proyectos raiz abiertos con su avance y alertas: los mismos numeros que la hoja Proyectos. */
function proyectosConAlertas(datos: Datos, soloDe?: string): ProyectoFila[] {
  const porId = Object.fromEntries(datos.actividades.map((a) => [a.id, a]))
  const items: DecoratedItem[] = datos.temas
    .filter((t) => t.tipo === 'proyecto')
    .map((t) => ({
      ...t,
      effectiveEstado: deriveEstado(t, porId),
      linkedActivities: t.linked_activity_ids.map((id) => porId[id]).filter(Boolean),
    }))
  return items
    .filter((p) => !p.parent_item_id)
    .map((p) => ({ id: p.id, nombre: p.tema, resumen: resumirProyecto(p, items) }))
    .filter((p) => p.resumen.estado !== 'completado')
    .filter((p) => !soloDe || p.resumen.responsables.includes(soloDe))
    .sort(
      (a, b) =>
        PRIORIDAD_ESTADO[a.resumen.estado] - PRIORIDAD_ESTADO[b.resumen.estado] ||
        b.resumen.alertas.vencidas - a.resumen.alertas.vencidas,
    )
}

/** Actividad -> "Minuta" o el nombre del proyecto del que salio. Lo creado en el chat no tiene. */
function origenesDe(temas: MinuteItem[]): Origenes {
  const porId = new Map(temas.map((t) => [t.id, t]))
  const raiz = (t: MinuteItem) => {
    let actual = t
    while (actual.parent_item_id && porId.has(actual.parent_item_id))
      actual = porId.get(actual.parent_item_id)!
    return actual
  }
  const res: Origenes = {}
  // Minuta primero y proyecto despues: si una actividad esta en los dos, gana el proyecto
  // (mismo criterio que la hoja Compromisos).
  const esProyecto = (t: MinuteItem) => (t.tipo === 'proyecto' ? 1 : 0)
  for (const t of [...temas].sort((a, b) => esProyecto(a) - esProyecto(b))) {
    const nombre = t.tipo === 'proyecto' ? raiz(t).tema : 'Minuta'
    t.linked_activity_ids.forEach((id) => (res[id] = nombre))
  }
  return res
}
