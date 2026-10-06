// Agrupa la lista de Actividades con la misma forma de arbol que tiene el proyecto: la
// actividad de una subtarea va debajo de la actividad de su item padre (pedido real: en
// Actividades las subtareas de un proyecto quedaban sueltas, como si no tuvieran relacion).
//
// Es SOLO visual. No se usa activities.parent_activity_id para las subtareas de proyecto: ese
// campo dispara el trigger de la migracion 025 (al completar todas las hijas se completa el
// padre), y aca cada actividad se cierra por su cuenta. El arbol se deduce de minute_items
// (parent_item_id + linked_activity_ids). Las subtareas creadas dentro de Actividades, que si
// usan parent_activity_id, se agrupan igual.

import type { Activity, MinuteItem } from '@shared/types'

export interface FilaArbol {
  activity: Activity
  depth: number
  // Nombre del nivel inmediatamente superior (padre -> hijo): la tarea de primer nivel
  // muestra el proyecto, su subtarea muestra la tarea, y asi. Va donde iria el nombre del
  // equipo, sin carpetas aparte (pedido de Sebastian).
  nivelSuperior: string | null
}

export function armarArbol(visibles: Activity[], items: MinuteItem[]): FilaArbol[] {
  const actPorId = new Map(visibles.map((a) => [a.id, a]))
  const itemPorId = new Map(items.map((i) => [i.id, i]))
  const itemDeActividad = new Map<string, MinuteItem>()
  items.forEach((i) => i.linked_activity_ids.forEach((aid) => itemDeActividad.set(aid, i)))

  // Actividad visible que representa a un item padre (preferentemente del mismo responsable
  // que la hija; si no, la primera). Si el item no tiene ninguna visible (ej. el proyecto
  // raiz, o un padre aun sin asignar), se sube al siguiente ancestro; si no hay, queda raiz.
  const actividadDeItem = (item: MinuteItem, responsable: string): string | null => {
    const vistos = new Set<string>()
    let actual: MinuteItem | undefined = item
    while (actual && !vistos.has(actual.id)) {
      vistos.add(actual.id)
      const acts = actual.linked_activity_ids.filter((id) => actPorId.has(id))
      const propia = acts.find((id) => actPorId.get(id)!.responsible_id === responsable)
      const elegida = propia ?? acts[0]
      if (elegida) return elegida
      actual = actual.parent_item_id ? itemPorId.get(actual.parent_item_id) : undefined
    }
    return null
  }

  const padreDe = (id: string): string | null => {
    const a = actPorId.get(id)!
    if (a.parent_activity_id && actPorId.has(a.parent_activity_id)) return a.parent_activity_id
    const item = itemDeActividad.get(id)
    const padre = item?.parent_item_id ? itemPorId.get(item.parent_item_id) : undefined
    return padre ? actividadDeItem(padre, a.responsible_id) : null
  }

  const nivelSuperiorDe = (id: string): string | null => {
    const a = actPorId.get(id)!
    const item = itemDeActividad.get(id)
    const padreItem = item?.parent_item_id ? itemPorId.get(item.parent_item_id) : undefined
    if (padreItem) return padreItem.tema || null
    const padreAct = a.parent_activity_id ? actPorId.get(a.parent_activity_id) : undefined
    return padreAct?.title || null
  }

  // Hijos en orden de aparicion: se respeta el orden que ya trae la lista (filtros, orden
  // por fecha), solo que cada grupo se arma donde aparece su primer integrante.
  const hijos = new Map<string | null, string[]>()
  const registrados = new Set<string>()
  for (const a of visibles) {
    let clave: string | null = a.id
    const camino = new Set<string>()
    while (clave && !registrados.has(clave) && !camino.has(clave)) {
      camino.add(clave)
      registrados.add(clave)
      let padre = padreDe(clave)
      // Proteccion contra ciclos en datos raros: se corta y queda como raiz.
      if (padre && camino.has(padre)) padre = null
      if (!hijos.has(padre)) hijos.set(padre, [])
      hijos.get(padre)!.push(clave)
      clave = padre
    }
  }

  const filas: FilaArbol[] = []
  const emitir = (id: string, depth: number) => {
    filas.push({ activity: actPorId.get(id)!, depth, nivelSuperior: nivelSuperiorDe(id) })
    for (const h of hijos.get(id) ?? []) emitir(h, depth + 1)
  }
  for (const r of hijos.get(null) ?? []) emitir(r, 0)
  return filas
}
