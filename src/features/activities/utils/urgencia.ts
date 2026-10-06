// Agrupacion de la lista de Actividades (idea 6 de la propuesta): por urgencia, persona o
// proyecto. Trabaja SOBRE las filas del arbol (utils/arbol.ts), nunca las reordena por dentro:
// una subtarea siempre queda pegada debajo de su padre.

import type { Activity, MinuteItem } from '@shared/types'
import { getDaysRemainingLocal } from '@shared/utils/date'
import type { FilaArbol } from './arbol'

export type Agrupacion = 'urgencia' | 'persona' | 'proyecto' | 'ninguno'

export type Urgencia = 'vencidas' | 'hoy' | 'semana' | 'despues' | 'sin_fecha' | 'completadas'

// Orden de los grupos = orden de urgencia. Tambien sirve de "rango" para comparar.
const ORDEN_URGENCIA: Urgencia[] = [
  'vencidas',
  'hoy',
  'semana',
  'despues',
  'sin_fecha',
  'completadas',
]

const ETIQUETA_URGENCIA: Record<Urgencia, string> = {
  vencidas: 'Vencidas',
  hoy: 'Hoy',
  semana: 'Esta semana',
  despues: 'Después',
  sin_fecha: 'Sin fecha',
  completadas: 'Completadas',
}

export type FiltroPlazo = 'todos' | 'vencidas' | 'hoy' | 'semana'

export const ETIQUETA_PLAZO: Record<FiltroPlazo, string> = {
  todos: 'Cualquier plazo',
  vencidas: 'Vencidas',
  hoy: 'Vencen hoy',
  semana: 'Esta semana',
}

/** Dias que faltan hasta el domingo de esta semana (lunes = inicio, como en Chile). */
function diasHastaDomingo(): number {
  const dow = (new Date().getDay() + 6) % 7 // lunes = 0
  return 6 - dow
}

export function urgenciaDe(a: Activity): Urgencia {
  if (a.status === 'completado') return 'completadas'
  if (!a.due_date) return 'sin_fecha'
  const d = getDaysRemainingLocal(a.due_date)
  if (d < 0) return 'vencidas'
  if (d === 0) return 'hoy'
  if (d <= diasHastaDomingo()) return 'semana'
  return 'despues'
}

/**
 * Filtro de plazo relativo. "Esta semana" es de lunes a domingo de la semana actual, incluidas
 * las que vencieron a principio de semana: es la pregunta "que tiene que cerrar el equipo esta
 * semana", no "que viene".
 */
export function enPlazo(a: Activity, plazo: FiltroPlazo): boolean {
  if (plazo === 'todos') return true
  if (!a.due_date) return false
  const d = getDaysRemainingLocal(a.due_date)
  if (plazo === 'vencidas') return a.status !== 'completado' && d < 0
  if (plazo === 'hoy') return d === 0
  const hastaDomingo = diasHastaDomingo()
  return d >= hastaDomingo - 6 && d <= hastaDomingo
}

export interface GrupoFilas {
  clave: string
  titulo: string
  filas: FilaArbol[]
}

/** Corta las filas del arbol en bloques: una raiz (depth 0) con todos sus descendientes. */
function bloques(filas: FilaArbol[]): FilaArbol[][] {
  const out: FilaArbol[][] = []
  for (const f of filas) {
    if (f.depth === 0 || out.length === 0) out.push([f])
    else out[out.length - 1].push(f)
  }
  return out
}

/** Tema del item raiz del proyecto al que pertenece la actividad (null si no viene de uno). */
export function proyectoDe(a: Activity, items: MinuteItem[]): string | null {
  let item = items.find((i) => i.linked_activity_ids.includes(a.id))
  if (!item) return null
  const vistos = new Set<string>()
  while (item.parent_item_id && !vistos.has(item.id)) {
    vistos.add(item.id)
    const padre = items.find((i) => i.id === item!.parent_item_id)
    if (!padre) break
    item = padre
  }
  return item.tema || null
}

/**
 * Agrupa las filas del arbol. Cada bloque (actividad raiz + sus subtareas) va entero a UN solo
 * grupo, para no partir la jerarquia en dos lugares de la pantalla.
 *
 * Por urgencia, el bloque cae en el grupo MAS urgente de cualquiera de sus integrantes (no en el
 * del padre): si una subtarea vencio y el padre vence el mes que viene, agrupar por el padre la
 * esconderia en "Despues", justo lo contrario de lo que esta vista quiere responder ("que tengo
 * que mover hoy"). Cada fila sigue mostrando su propia fecha y estado, asi que el padre no
 * aparenta estar vencido. Un bloque solo va a "Completadas" si todo el bloque esta cerrado.
 *
 * Por persona y por proyecto manda la raiz: las subtareas de otra persona siguen bajo su
 * padre (la responsable de cada una se ve en su fila).
 */
export function agruparFilas(
  filas: FilaArbol[],
  modo: Agrupacion,
  opts: { nombrePersona: (id: string) => string; items: MinuteItem[] },
): GrupoFilas[] {
  if (modo === 'ninguno') return [{ clave: 'todas', titulo: '', filas }]

  const grupos = new Map<string, GrupoFilas>()
  const agregar = (clave: string, titulo: string, bloque: FilaArbol[]) => {
    if (!grupos.has(clave)) grupos.set(clave, { clave, titulo, filas: [] })
    grupos.get(clave)!.filas.push(...bloque)
  }

  for (const bloque of bloques(filas)) {
    const raiz = bloque[0].activity
    if (modo === 'urgencia') {
      const rango = Math.min(...bloque.map((f) => ORDEN_URGENCIA.indexOf(urgenciaDe(f.activity))))
      const u = ORDEN_URGENCIA[rango]
      agregar(u, ETIQUETA_URGENCIA[u], bloque)
    } else if (modo === 'persona') {
      agregar(raiz.responsible_id || 'nadie', opts.nombrePersona(raiz.responsible_id), bloque)
    } else {
      const p = proyectoDe(raiz, opts.items)
      agregar(p ?? '', p ?? 'Sin proyecto', bloque)
    }
  }

  const lista = [...grupos.values()]
  if (modo === 'urgencia') {
    return lista.sort(
      (a, b) =>
        ORDEN_URGENCIA.indexOf(a.clave as Urgencia) - ORDEN_URGENCIA.indexOf(b.clave as Urgencia),
    )
  }
  // Persona y proyecto: alfabetico; "Sin proyecto" al final.
  return lista.sort((a, b) => {
    if (!a.clave !== !b.clave) return a.clave ? -1 : 1
    return a.titulo.localeCompare(b.titulo, 'es')
  })
}
