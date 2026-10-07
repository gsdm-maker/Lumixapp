import { useCallback, useEffect, useMemo, useState } from 'react'
import { activitiesService } from '@infrastructure/supabase/activities.service'
import { minutesService } from '@infrastructure/supabase/minutes.service'
import { getDaysRemainingLocal } from '@shared/utils/date'
import type { Activity, MinuteItem } from '@shared/types'

export type Plazo = 'vencidas' | 'hoy' | 'proximas'

/** Cuantos dias hacia adelante cuenta "por vencer". */
export const DIAS_POR_VENCER = 7

export function plazoDe(fecha: string | null | undefined): Plazo | null {
  if (!fecha) return null
  const d = getDaysRemainingLocal(fecha)
  if (d < 0) return 'vencidas'
  if (d === 0) return 'hoy'
  if (d <= DIAS_POR_VENCER) return 'proximas'
  return null
}

interface Opciones {
  teamId: string
  userId: string | undefined
  /** true: todo el equipo (quien puede ver todo); false: solo lo propio. */
  verEquipo: boolean
  /** Cambia cuando hay que releer (ej. llego un mensaje: quizas se creo o cerro algo). */
  version: number
}

/**
 * Trabajo abierto con fecha cercana, para el panel lateral del chat: actividades, items de
 * proyectos y temas de minuta que vencieron, vencen hoy o en los proximos 7 dias.
 *
 * Mismo criterio de visibilidad que el resto: quien no ve todo el equipo ve solo lo suyo.
 */
export function useTrabajoPendiente({ teamId, userId, verEquipo, version }: Opciones) {
  const [datos, setDatos] = useState<{
    actividades: Activity[]
    proyectos: MinuteItem[]
    minuta: MinuteItem[]
  } | null>(null)

  const cargar = useCallback(async () => {
    if (!teamId) return
    const [acts, proyectos, minuta] = await Promise.all([
      activitiesService.getByTeam(teamId),
      minutesService.getByTeam(teamId, 'proyecto'),
      minutesService.getByTeam(teamId, 'minuta'),
    ])
    setDatos({ actividades: acts, proyectos, minuta })
  }, [teamId])

  useEffect(() => {
    // cargar() es async: el setState ocurre despues del await, no sincronico en el efecto.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar().catch(() => {
      /* sin conexion: el panel queda con lo ultimo que tenia */
    })
  }, [cargar, version])

  const resultado = useMemo(() => {
    if (!datos) return null

    const mia = (ids: string[]) => verEquipo || (!!userId && ids.includes(userId))

    const actividades: Record<Plazo, Activity[]> = { vencidas: [], hoy: [], proximas: [] }
    for (const a of datos.actividades) {
      if (a.status === 'completado' || !mia([a.responsible_id])) continue
      const p = plazoDe(a.due_date)
      if (p) actividades[p].push(a)
    }

    // Items con plazo propio y todavia abiertos. Los que ya tienen actividad vinculada se
    // siguen mostrando: en Proyectos/Minuta lo que se mira es el tema, no la actividad.
    const agrupar = (items: MinuteItem[]) => {
      const out: Record<Plazo, MinuteItem[]> = { vencidas: [], hoy: [], proximas: [] }
      for (const it of items) {
        if (it.estado === 'resuelto' || !mia(it.responsables)) continue
        const p = plazoDe(it.plazo)
        if (p) out[p].push(it)
      }
      return out
    }

    const porFecha = <T>(lista: T[], fecha: (x: T) => string | null) =>
      [...lista].sort((a, b) => (fecha(a) ?? '').localeCompare(fecha(b) ?? ''))

    const ordenar = <T>(g: Record<Plazo, T[]>, fecha: (x: T) => string | null) => ({
      vencidas: porFecha(g.vencidas, fecha),
      hoy: porFecha(g.hoy, fecha),
      proximas: porFecha(g.proximas, fecha),
    })

    return {
      actividades: ordenar(actividades, (a) => a.due_date),
      proyectos: ordenar(agrupar(datos.proyectos), (i) => i.plazo),
      minuta: ordenar(agrupar(datos.minuta), (i) => i.plazo),
      /** Para dar contexto a un item de proyecto: el proyecto raiz. */
      raizProyecto: (it: MinuteItem) => {
        let r = it
        const vistos = new Set<string>()
        while (r.parent_item_id && !vistos.has(r.id)) {
          vistos.add(r.id)
          const p = datos.proyectos.find((x) => x.id === r.parent_item_id)
          if (!p) break
          r = p
        }
        return r
      },
    }
  }, [datos, verEquipo, userId])

  return { trabajo: resultado, recargar: cargar }
}
