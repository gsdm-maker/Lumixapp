// Contexto que se le pasa al agente en cada mensaje: lo que la persona puede ver del equipo,
// recortado a lo que sirve para entender una orden (lo abierto, lo de esta semana).
//
// Los ids van como referencias cortas (a1, m3, p2, i7...) en vez de los uuid de la base: un
// uuid son ~20 tokens y el contexto se manda en cada mensaje. El mapa `refs` traduce de vuelta.
// Es tambien el formato con el que se midio el banco de pruebas (bench/agente).

import { semanaDe } from '@features/compromisos/hooks/useCompromisos'
import { compromisosEnVentana, deriveEstado } from '@shared/utils/compromisos'
import type { Activity, AppError, MinuteItem, Profile } from '@shared/types'

export interface DatosAgente {
  actividades: Activity[]
  /** Temas de Minuta, Proyectos e Ingesta (misma tabla). */
  temas: MinuteItem[]
  errores: AppError[]
  miembros: Profile[]
}

export type TipoRef = 'actividad' | 'tema' | 'proyecto' | 'item' | 'error' | 'ingesta'

export interface Refs {
  /** referencia corta -> id real */
  aId: Record<string, { tipo: TipoRef; id: string }>
  /** id real -> referencia corta */
  deId: Record<string, string>
}

const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
// Techos: un equipo con mucho historial no debe disparar el costo de cada mensaje.
const MAX_ACTIVIDADES = 80
const MAX_TEMAS = 60
const MAX_ITEMS_PROYECTO = 120
const MAX_ERRORES = 25

/** YYYY-MM-DD en hora local (toISOString da la fecha UTC: de noche ya es "mañana"). */
export function fechaLocal(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const dia = (iso: string | null) => (iso ? iso.split('T')[0] : null)

export function armarContexto(
  datos: DatosAgente,
  yo: { id: string; nombre: string; rol: string },
  opts: { veTodo: boolean; ultimoMencionadoId?: string | null },
) {
  const refs: Refs = { aId: {}, deId: {} }
  const contador: Record<string, number> = {}
  const ref = (tipo: TipoRef, prefijo: string, id: string) => {
    if (refs.deId[id]) return refs.deId[id]
    contador[prefijo] = (contador[prefijo] ?? 0) + 1
    const r = `${prefijo}${contador[prefijo]}`
    refs.aId[r] = { tipo, id }
    refs.deId[id] = r
    return r
  }
  const nombre = (id: string | null | undefined) =>
    datos.miembros.find((m) => m.id === id)?.full_name ?? null
  const porId = Object.fromEntries(datos.actividades.map((a) => [a.id, a]))

  // Actividades: lo abierto que la persona puede ver, lo mas urgente primero.
  const visibles = datos.actividades.filter((a) => opts.veTodo || a.responsible_id === yo.id)
  const abiertas = visibles
    .filter((a) => a.status !== 'completado')
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, MAX_ACTIVIDADES)

  // Compromisos de la semana (incluye los ya hechos: se pueden desmarcar).
  const { desde, hasta } = semanaDe(0)
  const compromisos = compromisosEnVentana(visibles, datos.temas, desde, hasta)

  const actividades = [...abiertas, ...compromisos.filter((c) => !abiertas.includes(c))].map(
    (a) => ({
      id: ref('actividad', 'a', a.id),
      titulo: a.title,
      responsable: nombre(a.responsible_id),
      entrega: dia(a.due_date),
      estado: a.status,
    }),
  )

  const minuta = datos.temas
    .filter((t) => t.tipo === 'minuta' && !t.parent_item_id)
    .filter((t) => deriveEstado(t, porId) !== 'resuelto' || t.estado === 'definir')
    .slice(0, MAX_TEMAS)
    .map((t) => ({
      id: ref('tema', 'm', t.id),
      tema: t.tema,
      responsable: nombre(t.responsables[0]),
      estado: deriveEstado(t, porId),
      plazo: t.plazo,
      tiene_actividad: t.linked_activity_ids.length > 0,
    }))

  const itemsProyecto = datos.temas.filter((t) => t.tipo === 'proyecto')
  const proyectos = itemsProyecto
    .filter((p) => !p.parent_item_id)
    .map((p) => {
      const pid = ref('proyecto', 'p', p.id)
      const items: { id: string; titulo: string; padre: string | null; estado: string }[] = []
      const bajar = (padreId: string) => {
        for (const it of itemsProyecto.filter((x) => x.parent_item_id === padreId)) {
          if (items.length >= MAX_ITEMS_PROYECTO) return
          items.push({
            id: ref('item', 'i', it.id),
            titulo: it.tema,
            padre: padreId === p.id ? null : refs.deId[padreId],
            estado: deriveEstado(it, porId),
          })
          bajar(it.id)
        }
      }
      bajar(p.id)
      return { id: pid, nombre: p.tema, items }
    })

  const errores = datos.errores
    .filter((e) => e.status !== 'cerrado' && e.status !== 'resuelto')
    .slice(0, MAX_ERRORES)
    .map((e) => ({
      id: ref('error', 'e', e.id),
      titulo: e.title,
      estado: e.status,
      severidad: e.severity,
    }))

  const ingestas = datos.temas
    .filter((t) => t.tipo === 'ingesta' && !t.parent_item_id)
    .filter(
      (t) =>
        !t.estado_ingesta ||
        t.estado_ingesta === 'no_iniciado' ||
        t.estado_ingesta === 'en_proceso',
    )
    .slice(0, MAX_TEMAS)
    .map((t) => ({
      id: ref('ingesta', 'g', t.id),
      solicitud: t.tema,
      estado: t.estado_ingesta ?? 'no_iniciado',
    }))

  const hoy = new Date()
  const contexto = {
    hoy: `${fechaLocal(hoy)} (${DIAS[hoy.getDay()]})`,
    quien_escribe: { nombre: yo.nombre, rol: yo.rol },
    miembros: datos.miembros.map((m) => m.full_name),
    actividades,
    temas_minuta: minuta,
    proyectos,
    compromisos_semana: compromisos.map((c) => ({
      id: refs.deId[c.id],
      titulo: c.title,
      responsable: nombre(c.responsible_id),
      hecho: c.status === 'completado',
    })),
    errores,
    ingestas,
    ultimo_mencionado: opts.ultimoMencionadoId
      ? (refs.deId[opts.ultimoMencionadoId] ?? null)
      : null,
  }
  return { contexto, refs }
}
