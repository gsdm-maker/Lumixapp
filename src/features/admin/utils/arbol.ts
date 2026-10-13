import type { EquipoAdmin } from '@infrastructure/supabase/admin.service'

/** Unidad con su profundidad en el arbol, en el orden en que se dibuja. */
export type Fila = EquipoAdmin & { nivelArbol: number }

/**
 * Ordena las unidades como arbol (cada una bajo la que depende), por nombre dentro de cada
 * nivel. Una unidad cuya superior no esta en la lista se trata como de primer nivel.
 */
export function enArbol(equipos: EquipoAdmin[]): Fila[] {
  const ids = new Set(equipos.map((e) => e.id))
  const hijos = new Map<string | null, EquipoAdmin[]>()
  for (const e of equipos) {
    const padre = e.superior && ids.has(e.superior) ? e.superior : null
    hijos.set(padre, [...(hijos.get(padre) ?? []), e])
  }
  const filas: Fila[] = []
  const vistos = new Set<string>()
  const recorrer = (padre: string | null, nivelArbol: number) => {
    const lista = [...(hijos.get(padre) ?? [])].sort((a, b) => a.nombre.localeCompare(b.nombre))
    for (const e of lista) {
      if (vistos.has(e.id)) continue
      vistos.add(e.id)
      filas.push({ ...e, nivelArbol })
      recorrer(e.id, nivelArbol + 1)
    }
  }
  recorrer(null, 0)
  return filas
}

/** Ids de la unidad y de todo lo que cuelga de ella (no puede depender de ninguno). */
export function rama(id: string, equipos: EquipoAdmin[]): Set<string> {
  const fuera = new Set([id])
  let crecio = true
  while (crecio) {
    crecio = false
    for (const e of equipos) {
      if (e.superior && fuera.has(e.superior) && !fuera.has(e.id)) {
        fuera.add(e.id)
        crecio = true
      }
    }
  }
  return fuera
}

/** "Gerencia de Operaciones › Equipo Datos": la unidad con todas las de arriba. */
export function ruta(id: string, equipos: EquipoAdmin[]): string {
  const porId = new Map(equipos.map((e) => [e.id, e]))
  const nombres: string[] = []
  const vistos = new Set<string>()
  for (
    let u = porId.get(id);
    u && !vistos.has(u.id);
    u = u.superior ? porId.get(u.superior) : undefined
  ) {
    vistos.add(u.id)
    nombres.unshift(u.nombre)
  }
  return nombres.join(' › ')
}

/** Texto de una opcion de un select de unidades: sangria segun su lugar en el arbol. */
export function etiquetaOpcion(f: Fila): string {
  return `${'   '.repeat(f.nivelArbol)}${f.nombre}`
}
