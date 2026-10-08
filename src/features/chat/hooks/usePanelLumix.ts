import { useCallback, useEffect, useMemo, useState } from 'react'
import { activitiesService } from '@infrastructure/supabase/activities.service'
import { minutesService } from '@infrastructure/supabase/minutes.service'
import { semanaDe } from '@features/compromisos/hooks/useCompromisos'
import { rachaCompromisos } from '@features/compromisos/utils/racha'
import { CAPACIDAD_DIA, horasDe, hoyYMD } from '@features/gantt/utils/carga'
import { compromisoStats, compromisosEnVentana } from '@shared/utils/compromisos'
import type { Activity, MinuteItem } from '@shared/types'

export type NivelCarga = 'libre' | 'normal' | 'alta' | 'saturado'

export interface DiaCarga {
  ymd: string
  /** "lun", "mar"... */
  dia: string
  numero: number
  horas: number
  nivel: NivelCarga
  esHoy: boolean
}

export interface Sugerencia {
  actividad: Activity
  hacia: DiaCarga
  hoy: DiaCarga
}

const DIAS = ['lun', 'mar', 'mié', 'jue', 'vie']
const ymdDe = (iso: string) => iso.split('T')[0]

/** Carga del dia contra la capacidad (8,4 h): mismos cortes que la Planificacion. */
function nivelDe(horas: number): NivelCarga {
  if (horas < CAPACIDAD_DIA * 0.5) return 'libre'
  if (horas <= CAPACIDAD_DIA) return 'normal'
  if (horas <= CAPACIDAD_DIA * 1.3) return 'alta'
  return 'saturado'
}

function fechaLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * Datos del panel de Lumix al lado del chat: el saludo (avance de compromisos y temas por
 * conversar), la carga de la semana de la persona, los compromisos que faltan, la racha de
 * semanas sobre la meta y la sugerencia de equilibrar el dia. Se relee cuando cambia `version`
 * (cada mensaje nuevo: algo se pudo crear o cerrar).
 */
export function usePanelLumix({
  teamId,
  userId,
  veTodo,
  version,
}: {
  teamId: string
  userId: string | undefined
  veTodo: boolean
  version: number
}) {
  const [datos, setDatos] = useState<{ actividades: Activity[]; temas: MinuteItem[] } | null>(null)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    if (!teamId) return
    let cancelado = false
    Promise.all([
      activitiesService.getByTeam(teamId),
      minutesService.getByTeam(teamId, 'minuta'),
      minutesService.getByTeam(teamId, 'proyecto'),
    ])
      .then(([actividades, minuta, proyectos]) => {
        if (!cancelado) setDatos({ actividades, temas: [...minuta, ...proyectos] })
      })
      .catch((err) => console.error('Panel de Lumix:', err))
    return () => {
      cancelado = true
    }
  }, [teamId, version, recarga])

  const panel = useMemo(() => {
    if (!datos || !userId) return null
    const { actividades, temas } = datos
    const visibles = veTodo ? actividades : actividades.filter((a) => a.responsible_id === userId)

    // Compromisos de la semana en curso.
    const { desde, hasta } = semanaDe(0)
    const compromisos = compromisosEnVentana(visibles, temas, desde, hasta)
    const stats = compromisoStats(compromisos)
    const hoy = hoyYMD()
    const pendientes = compromisos
      .filter((c) => c.status !== 'completado')
      .sort((a, b) => a.due_date.localeCompare(b.due_date))

    // Carga de la semana: lo abierto de la persona que vence cada dia habil.
    const mias = actividades.filter((a) => a.responsible_id === userId && a.status !== 'completado')
    const semana: DiaCarga[] = DIAS.map((dia, i) => {
      const d = new Date(desde)
      d.setDate(desde.getDate() + i)
      const ymd = fechaLocal(d)
      const horas = mias
        .filter((a) => ymdDe(a.due_date) === ymd)
        .reduce((s, a) => s + horasDe(a), 0)
      return { ymd, dia, numero: d.getDate(), horas, nivel: nivelDe(horas), esHoy: ymd === hoy }
    })

    // Sugerencia: hoy pasado de la capacidad y un dia libre mas adelante en la semana. Se
    // propone mover lo de menor prioridad que quepa (nunca algo bloqueado).
    let sugerencia: Sugerencia | null = null
    const diaHoy = semana.find((d) => d.esHoy)
    const libre = semana.find((d) => d.ymd > hoy && d.nivel === 'libre')
    if (diaHoy && diaHoy.horas > CAPACIDAD_DIA && libre) {
      const candidata = mias
        .filter((a) => ymdDe(a.due_date) === hoy && a.status !== 'bloqueado')
        .sort((a, b) => b.priority - a.priority || horasDe(b) - horasDe(a))[0]
      if (candidata) sugerencia = { actividad: candidata, hacia: libre, hoy: diaHoy }
    }

    return {
      porcentaje: stats.porcentaje,
      cumplidos: stats.cumplidos,
      total: stats.total,
      meta: stats.meta,
      pendientes,
      porConversar: temas.filter((t) => t.tipo === 'minuta' && t.estado === 'definir').length,
      semana,
      racha: rachaCompromisos(visibles, temas),
      sugerencia,
      temas,
    }
  }, [datos, userId, veTodo])

  const recargar = useCallback(() => setRecarga((n) => n + 1), [])
  return { panel, recargar }
}
