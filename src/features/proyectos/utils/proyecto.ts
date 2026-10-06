// Lecturas derivadas de un proyecto (estado general, alertas, avance, escala de tiempo).
//
// Viven aca y no en cada pantalla porque la lista de Proyectos y el encabezado del detalle
// muestran EXACTAMENTE los mismos numeros: si cada una los calculaba a su manera, terminaban
// diciendo cosas distintas del mismo proyecto (la lista usaba barra y el detalle un anillo).
// Nada se persiste: se calcula al vuelo sobre allItems, igual que plazoEfectivo.

import type { DecoratedItem } from '@features/minuta/hooks/useMinuta'
import {
  plazoEfectivo,
  fechaInicioEfectiva,
  resumenProyecto,
} from '@features/minuta/utils/subtareas'
import { MINUTE_ESTADO, type StatusInfo } from '@shared/utils/estados'
import { parseDateLocal } from '@shared/utils/date'
import type { MinuteEstado } from '@shared/types'

/** Columnas del Tablero y opciones del selector de estado, en este orden. */
export const ESTADOS: MinuteEstado[] = ['pendiente', 'en_desarrollo', 'resuelto', 'definir']

export type EstadoGeneral = 'completado' | 'atrasado' | 'en_curso' | 'sin_actividad'

// Estado de alto nivel del conjunto, no el `estado` de la fila (ese es un detalle interno).
export const ESTADO_PROYECTO: Record<EstadoGeneral, StatusInfo> = {
  completado: { label: 'Completado', tone: 'done' },
  atrasado: { label: 'Atrasado', tone: 'danger' },
  en_curso: { label: 'En curso', tone: 'progress' },
  sin_actividad: { label: 'Sin actividades', tone: 'idle' },
}

const DIA_MS = 86_400_000

function hoyLocal(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

/** Todos los descendientes (cualquier nivel), aplanados en orden de arbol. */
export function descendientes(raizId: string, allItems: DecoratedItem[]): DecoratedItem[] {
  const hijos = allItems.filter((d) => d.parent_item_id === raizId)
  return hijos.flatMap((h) => [h, ...descendientes(h.id, allItems)])
}

export interface AlertasDetalle {
  vencidas: number
  /** Vencen hoy: se separan de "por vencer" porque son lo siguiente que hay que mirar. */
  hoy: number
  /** Vencen en los proximos 3 dias, sin contar hoy. */
  proximas: number
  bloqueadas: number
}

/**
 * Mismo criterio que alertasProyecto (minuta/utils/subtareas), pero separando "vence hoy" de
 * "por vencer": la lista pide decir "1 vence hoy", que es mas accionable que "1 por vencer".
 */
export function alertasDetalle(proyectoId: string, allItems: DecoratedItem[]): AlertasDetalle {
  const hoy = hoyLocal()
  const limite = new Date(hoy.getTime() + 3 * DIA_MS)
  const res: AlertasDetalle = { vencidas: 0, hoy: 0, proximas: 0, bloqueadas: 0 }
  for (const it of descendientes(proyectoId, allItems)) {
    if (it.linkedActivities.some((a) => a.status === 'bloqueado')) res.bloqueadas++
    if (it.effectiveEstado === 'resuelto') continue
    const f = plazoEfectivo(it, allItems)
    if (!f) continue
    const fecha = parseDateLocal(f)
    if (fecha < hoy) res.vencidas++
    else if (fecha.getTime() === hoy.getTime()) res.hoy++
    else if (fecha <= limite) res.proximas++
  }
  return res
}

export interface ResumenProyecto {
  actividades: number
  subtareas: number
  subtareasResueltas: number
  /** null si no hay subtareas: sin denominador no hay avance que mostrar. */
  avance: number | null
  inicio: string | null
  fin: string | null
  alertas: AlertasDetalle
  estado: EstadoGeneral
  /** Ids de todas las personas responsables de algo dentro del proyecto (sin repetir). */
  responsables: string[]
}

/**
 * Todo lo que la lista y el encabezado del detalle muestran de un proyecto. El avance sigue el
 * criterio de siempre (subtareas resueltas / subtareas) para que el numero no cambie con el
 * rediseno.
 */
export function resumirProyecto(p: DecoratedItem, allItems: DecoratedItem[]): ResumenProyecto {
  const { actividades, subtareas, subtareasResueltas } = resumenProyecto(p.id, allItems)
  const avance = subtareas > 0 ? Math.round((subtareasResueltas / subtareas) * 100) : null
  const alertas = alertasDetalle(p.id, allItems)
  const estado: EstadoGeneral =
    actividades === 0
      ? 'sin_actividad'
      : avance === 100
        ? 'completado'
        : alertas.vencidas > 0
          ? 'atrasado'
          : 'en_curso'
  const responsables = new Set<string>(p.responsables)
  descendientes(p.id, allItems).forEach((d) => d.responsables.forEach((r) => responsables.add(r)))
  return {
    actividades,
    subtareas,
    subtareasResueltas,
    avance,
    inicio: fechaInicioEfectiva(p.id, allItems),
    fin: plazoEfectivo(p, allItems),
    alertas,
    estado,
    responsables: [...responsables],
  }
}

/**
 * Estado a mostrar de un item del arbol. El estado propio manda, salvo dos casos que conviene
 * ver primero: una actividad vinculada bloqueada, o un plazo ya vencido sin resolver.
 */
export function estadoItem(it: DecoratedItem, allItems: DecoratedItem[]): StatusInfo {
  if (it.effectiveEstado !== 'resuelto') {
    if (it.linkedActivities.some((a) => a.status === 'bloqueado')) {
      return { label: 'Bloqueado', tone: 'blocked' }
    }
    const f = plazoEfectivo(it, allItems)
    if (f && parseDateLocal(f) < hoyLocal()) return { label: 'Vencido', tone: 'danger' }
  }
  return MINUTE_ESTADO[it.effectiveEstado]
}

/** "Tomás Vergara" -> "Tomás V.": en filas densas el apellido completo no aporta. */
export function nombreCorto(full: string): string {
  const partes = full.trim().split(/\s+/)
  if (partes.length < 2) return partes[0] ?? ''
  return `${partes[0]} ${partes[1][0]}.`
}

/** "Tomás V.", "Tomás V. y Diego P.", "Tomás V. y 3 más". */
export function resumenPersonas(ids: string[], memberName: (id: string) => string): string {
  if (ids.length === 0) return 'Sin responsables'
  const primero = nombreCorto(memberName(ids[0]))
  if (ids.length === 1) return primero
  if (ids.length === 2) return `${primero} y ${nombreCorto(memberName(ids[1]))}`
  return `${primero} y ${ids.length - 1} más`
}

export const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

// --- Escala de tiempo compartida por las mini lineas de tiempo de la lista ---------------

export interface EscalaTiempo {
  inicio: number
  fin: number
  /** Posicion (0-100) de una fecha dentro de la escala. */
  pos: (iso: string | Date) => number
  meses: { label: string; left: number; width: number }[]
  hoy: number
}

/**
 * Una sola escala de meses para todas las filas visibles (del primer inicio al ultimo
 * termino, incluyendo hoy): asi las barras se comparan entre si, que es el punto de ponerlas
 * en la tabla. null si ningun proyecto tiene fechas.
 */
export function escalaTiempo(fechas: (string | null)[]): EscalaTiempo | null {
  const ms = fechas.filter((f): f is string => !!f).map((f) => parseDateLocal(f).getTime())
  if (ms.length === 0) return null
  const hoy = hoyLocal().getTime()
  const min = new Date(Math.min(...ms, hoy))
  const max = new Date(Math.max(...ms, hoy))
  const inicio = new Date(min.getFullYear(), min.getMonth(), 1).getTime()
  const fin = new Date(max.getFullYear(), max.getMonth() + 1, 1).getTime()
  const total = fin - inicio
  const pos = (f: string | Date) => {
    const t = typeof f === 'string' ? parseDateLocal(f).getTime() : f.getTime()
    return Math.max(0, Math.min(100, ((t - inicio) / total) * 100))
  }
  const meses: EscalaTiempo['meses'] = []
  for (let d = new Date(inicio); d.getTime() < fin; d.setMonth(d.getMonth() + 1)) {
    const sig = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    const left = pos(d)
    meses.push({
      label: d.toLocaleDateString('es-CL', { month: 'short' }).replace('.', ''),
      left,
      width: pos(sig) - left,
    })
  }
  return { inicio, fin, pos, meses, hoy: pos(new Date(hoy)) }
}
