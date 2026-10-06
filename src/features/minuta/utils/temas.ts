import type { DecoratedItem } from '@features/minuta/hooks/useMinuta'

// Reglas de lectura de un tema que antes vivian como closures dentro de MinutaPage. Se sacan a
// funciones puras porque ahora las usan cuatro vistas distintas (tabla, lista movil, panel de
// detalle y modo reunion) y tienen que decir exactamente lo mismo en las cuatro.

/**
 * Personas que figuran como responsables del tema pero NO tienen actividad creada.
 *
 * Pasa cuando alguien agrega gente DESPUES de haber generado las actividades: el tema dice
 * que son responsables, pero para el sistema no existen -sin notificacion, sin carga, sin
 * aparecer en Compromisos-. Habia 4 casos asi cuando se reviso. No se crea nada solo: se
 * muestra y se ofrece el boton.
 */
export const sinActividad = (it: DecoratedItem): string[] =>
  it.responsables.filter((rid) => !it.linkedActivities.some((a) => a.responsible_id === rid))

/**
 * Actividades vivas de gente que YA NO figura como responsable del tema.
 *
 * Es el reverso de "Falta la actividad de X": alguien saca a una persona del desplegable y
 * su actividad sigue existiendo a su nombre, con su fecha y su carga. Nadie se entera. No
 * se toca sola -borrar trabajo asignado en silencio seria peor que el problema-, se avisa
 * y quien corresponda decide si la reasigna, la cierra o la deja.
 */
export const huerfanas = (it: DecoratedItem) =>
  it.linkedActivities.filter(
    (a) =>
      a.status !== 'completado' && a.responsible_id && !it.responsables.includes(a.responsible_id),
  )

/**
 * Un tema que volvio desde Compromisos queda "Definir en reunion" para que se converse.
 * Como al tener actividad vinculada el selector de estado se reemplaza por una etiqueta de
 * solo lectura, sin "Ya lo conversamos" no habia forma de sacarlo: quedaba dando vueltas en
 * la reunion para siempre, justamente el tema que estaba trancado.
 */
export const esEscalado = (it: DecoratedItem): boolean =>
  it.estado === 'definir' && it.linkedActivities.length > 0

/** Se le puede crear la actividad desde la Minuta: tiene responsable propio y aun no la tiene. */
export const puedeAsignarse = (it: DecoratedItem): boolean =>
  !it.para_todos && it.responsables.length > 0 && it.linkedActivities.length === 0

export const tieneSubtareas = (it: DecoratedItem, allItems: DecoratedItem[]): boolean =>
  allItems.some((d) => d.parent_item_id === it.id)

export function responsablesLabel(it: DecoratedItem, memberName: (id: string) => string): string {
  if (it.para_todos) return 'Todos'
  const names = it.responsables.map(memberName)
  if (it.responsables_text) names.push(it.responsables_text)
  return names.length ? names.join(', ') : 'Sin asignar'
}
