// Calculos del dashboard, sin React ni Supabase: entran listas, salen numeros. Asi se pueden
// leer (y probar) sin montar la pagina.
//
// NO HAY HISTORIAL GUARDADO. Las series semanales se reconstruyen con las fechas que ya tiene
// cada actividad: created_at, completed_at (la pone un trigger) y due_date. Es una
// aproximacion honesta: si a una actividad le movieron la fecha, cuenta con la fecha de hoy.

import { semanaDe } from '@features/compromisos/hooks/useCompromisos'
import { compromisosEnVentana, compromisoStats } from '@shared/utils/compromisos'
import { parseDateLocal } from '@shared/utils/date'
import type { Activity, AppError, MinuteItem } from '@shared/types'

export type Periodo = 'semana' | 'mes' | 'trimestre'

/** Semanas que suma cada periodo en los indicadores y semanas que muestran los graficos. */
export const PERIODO: Record<Periodo, { semanas: number; grafico: number; label: string }> = {
  semana: { semanas: 1, grafico: 8, label: 'Semana' },
  mes: { semanas: 4, grafico: 12, label: '4 semanas' },
  trimestre: { semanas: 13, grafico: 13, label: 'Trimestre' },
}

/** Capacidad semanal de una persona (la misma de siempre en Lumix). */
export const CAPACIDAD_HORAS = 42
/** Horas que se asumen cuando la actividad no tiene estimacion. */
const HORAS_POR_DEFECTO = 3

export interface Semana {
  desde: Date
  hasta: Date
  /** "S41": como el equipo nombra la semana en la reunion. */
  label: string
}

/** Semana ISO del ano. */
export function semanaISO(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dia = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dia)
  const inicio = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil(((t.getTime() - inicio.getTime()) / 86400000 + 1) / 7)
}

/** Las ultimas `n` semanas (lunes a domingo), la actual al final. */
export function ultimasSemanas(n: number): Semana[] {
  return Array.from({ length: n }, (_, i) => {
    const { desde, hasta } = semanaDe(i - n + 1)
    return { desde, hasta, label: `S${semanaISO(desde)}` }
  })
}

const entre = (iso: string | null | undefined, desde: Date, hasta: Date) => {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return t >= desde.getTime() && t <= hasta.getTime()
}

/** Fin del dia de una fecha de entrega (vence al terminar ese dia, no al empezar). */
const finDeEntrega = (a: Activity) => {
  const d = parseDateLocal(a.due_date)
  d.setHours(23, 59, 59, 999)
  return d
}

/** Seguia abierta en el instante `t`: ya existia y no se habia cerrado. */
function abiertaEn(a: Activity, t: Date): boolean {
  if (new Date(a.created_at) > t) return false
  if (a.status !== 'completado') return true
  // Completada sin fecha de cierre (datos antiguos): no se sabe cuando, no se cuenta.
  return !!a.completed_at && new Date(a.completed_at) > t
}

export interface Rendimiento {
  label: string
  completadas: number
  creadas: number
}

/** Completadas vs creadas por semana: dice si el equipo cierra mas de lo que entra. */
export function rendimientoSemanal(acts: Activity[], semanas: Semana[]): Rendimiento[] {
  return semanas.map((s) => ({
    label: s.label,
    completadas: acts.filter(
      (a) => a.status === 'completado' && entre(a.completed_at, s.desde, s.hasta),
    ).length,
    creadas: acts.filter((a) => entre(a.created_at, s.desde, s.hasta)).length,
  }))
}

/** Pendientes y vencidas al cierre de cada semana (para la mini curva y la comparacion). */
export function fotosSemanales(acts: Activity[], semanas: Semana[]) {
  const ahora = new Date()
  return semanas.map((s) => {
    const t = s.hasta < ahora ? s.hasta : ahora
    const abiertas = acts.filter((a) => abiertaEn(a, t))
    return {
      pendientes: abiertas.length,
      vencidas: abiertas.filter((a) => finDeEntrega(a) < t).length,
    }
  })
}

export interface CompromisoSemana {
  label: string
  porcentaje: number | null
  cumplidos: number
  total: number
}

/** % de compromisos cumplidos por semana. Mismo criterio que la hoja Compromisos. */
export function compromisosSemanales(
  acts: Activity[],
  temas: MinuteItem[],
  semanas: Semana[],
): CompromisoSemana[] {
  return semanas.map((s) => {
    const st = compromisoStats(compromisosEnVentana(acts, temas, s.desde, s.hasta))
    return { label: s.label, porcentaje: st.porcentaje, cumplidos: st.cumplidos, total: st.total }
  })
}

/** Suma de compromisos de varias semanas en un solo %. */
export function sumarCompromisos(semanas: CompromisoSemana[]) {
  const total = semanas.reduce((s, x) => s + x.total, 0)
  const cumplidos = semanas.reduce((s, x) => s + x.cumplidos, 0)
  return { total, cumplidos, porcentaje: total ? Math.round((cumplidos / total) * 100) : null }
}

export interface CargaPersona {
  id: string
  nombre: string
  avatar: string | null
  enProceso: number
  pendiente: number
  /** Bloqueadas o esperando a alguien: horas que no avanzan solas. */
  detenida: number
  total: number
  actividades: number
}

const horas = (lista: Activity[]) =>
  lista.reduce((s, a) => s + (a.estimated_hours ?? HORAS_POR_DEFECTO), 0)

/** Horas abiertas por persona, separadas por estado. La mas cargada primero. */
export function cargaPorPersona(
  acts: Activity[],
  miembros: { id: string; full_name: string; avatar_url: string | null }[],
): CargaPersona[] {
  return miembros
    .map((m) => {
      const suyas = acts.filter((a) => a.responsible_id === m.id && a.status !== 'completado')
      const enProceso = horas(suyas.filter((a) => a.status === 'en_proceso'))
      const pendiente = horas(suyas.filter((a) => a.status === 'pendiente'))
      const detenida = horas(
        suyas.filter((a) => a.status !== 'en_proceso' && a.status !== 'pendiente'),
      )
      return {
        id: m.id,
        nombre: m.full_name,
        avatar: m.avatar_url,
        enProceso,
        pendiente,
        detenida,
        total: enProceso + pendiente + detenida,
        actividades: suyas.length,
      }
    })
    .sort((a, b) => b.total - a.total)
}

export interface EdadErrores {
  recientes: number
  semana: number
  antiguos: number
  porSeveridad: Record<AppError['severity'], number>
}

/** Errores abiertos por antiguedad (desde que se registraron) y por severidad. */
export function edadErrores(abiertos: AppError[]): EdadErrores {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const dias = (e: AppError) =>
    Math.floor((hoy.getTime() - parseDateLocal(e.date).getTime()) / 86400000)
  const porSeveridad = { critica: 0, alta: 0, media: 0, baja: 0 }
  abiertos.forEach((e) => porSeveridad[e.severity]++)
  return {
    recientes: abiertos.filter((e) => dias(e) <= 2).length,
    semana: abiertos.filter((e) => dias(e) >= 3 && dias(e) <= 7).length,
    antiguos: abiertos.filter((e) => dias(e) > 7).length,
    porSeveridad,
  }
}

/**
 * Comparacion contra el periodo anterior. `mejorSiBaja`: en vencidas o pendientes, bajar es
 * bueno; en completadas, subir. El color depende de eso, no de la flecha.
 */
export function delta(actual: number, anterior: number, mejorSiBaja: boolean) {
  const diff = actual - anterior
  const tono: 'good' | 'bad' | 'neutral' =
    diff === 0 ? 'neutral' : diff < 0 === mejorSiBaja ? 'good' : 'bad'
  return { diff, tono }
}
