// Ejecutor del agente: recibe las acciones que propuso la IA (ya con ids reales), revisa
// permisos y las ejecuta con las mismas operaciones que usan las hojas. La IA nunca toca la base:
// todo pasa por aca, con los permisos de quien escribe.
//
// ETAPA 1: Minuta y Compromisos. El resto de las acciones del catalogo todavia lo resuelve el
// flujo de siempre del chat (ver `decidir`): si el agente pide algo que aun no sabe ejecutar,
// el mensaje sigue su camino normal y nada cambia para la persona.

import { activitiesService } from '@infrastructure/supabase/activities.service'
import { minutesService } from '@infrastructure/supabase/minutes.service'
import type { Capability } from '@core/auth/capabilities'
import { semanaDe } from '@features/compromisos/hooks/useCompromisos'
import {
  cambiarEntrega,
  llevarActividadAMinuta,
  moverActividadUnaSemana,
  yaEnMinuta,
} from '@features/compromisos/utils/operaciones'
import {
  crearActividadesDeTema,
  moverEntregasDelTema,
  patchDePlazo,
} from '@features/minuta/utils/operaciones'
import {
  compromisoStats,
  compromisosEnVentana,
  compromisosVencidosAbiertos,
} from '@shared/utils/compromisos'
import { formatDateLocal } from '@shared/utils/date'
import { nombreCorto } from '@shared/utils/nombres'
import type { Activity, MinuteItem } from '@shared/types'
import type { DatosAgente, Refs } from './contexto'
import type { Llamada, Tarjeta } from './tipos'

/** Acciones que el agente ya ejecuta por su cuenta (Etapa 1). */
const PROPIAS = new Set([
  'crear_tema_minuta',
  'actualizar_tema_minuta',
  'asignar_tema_minuta',
  'marcar_conversado',
  'consultar_compromisos',
  'llevar_a_minuta',
  'cerrar_semana',
])

/** Acciones que avisan a otras personas o cambian varias cosas: se confirman antes. */
const CON_CONFIRMACION = new Set(['asignar_tema_minuta', 'cerrar_semana'])

const ESCRITURA_MAX_SIN_CONFIRMAR = 2

/** Campos de una referencia en cada accion (los que hay que traducir a id real). */
const CAMPOS_REF = ['actividad', 'tema', 'proyecto', 'item', 'padre', 'error', 'ingesta', 'ref']

export function resolverRefs(llamadas: Llamada[], refs: Refs): Llamada[] {
  return llamadas.map((c) => {
    const args = { ...c.args }
    for (const k of CAMPOS_REF) {
      const v = args[k]
      if (typeof v === 'string' && refs.aId[v]) args[k] = refs.aId[v].id
    }
    return { ...c, args }
  })
}

/**
 * Actualizar una actividad entra en la Etapa 1 solo como parte de Compromisos (marcar hecho o
 * mover la entrega) y acompañando a una accion propia. Sola, la sigue resolviendo el flujo de
 * siempre, que ya sabe hacerlo con todos sus avisos.
 */
const esCompromisoSimple = (c: Llamada) =>
  c.tool === 'actualizar_actividad' &&
  Object.keys(c.args).every((k) => ['actividad', 'estado', 'fecha_entrega'].includes(k)) &&
  (c.args.estado === undefined || c.args.estado === 'completado')

/** 'agente' si la Etapa 1 sabe resolver el mensaje completo; si no, el flujo de siempre. */
export function decidir(llamadas: Llamada[]): 'agente' | 'flujo_actual' {
  if (!llamadas.some((c) => PROPIAS.has(c.tool))) return 'flujo_actual'
  const todas = llamadas.every(
    (c) => PROPIAS.has(c.tool) || esCompromisoSimple(c) || c.tool === 'pedir_aclaracion',
  )
  return todas ? 'agente' : 'flujo_actual'
}

const SOLO_LECTURA = new Set(['consultar_compromisos', 'pedir_aclaracion'])

export function requiereConfirmacion(llamadas: Llamada[]): boolean {
  const escrituras = llamadas.filter((c) => !SOLO_LECTURA.has(c.tool))
  return (
    escrituras.some((c) => CON_CONFIRMACION.has(c.tool)) ||
    escrituras.length > ESCRITURA_MAX_SIN_CONFIRMAR
  )
}

export interface Contexto {
  datos: DatosAgente
  yo: { id: string; nombre: string }
  teamId: string
  can: (cap: Capability) => boolean
  veTodo: boolean
}

const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
const sinTildes = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')

function idDePersona(ctx: Contexto, nombre: unknown): string | null {
  const n = s(nombre)
  if (!n) return null
  if (sinTildes(n) === 'yo') return ctx.yo.id
  return ctx.datos.miembros.find((m) => sinTildes(m.full_name) === sinTildes(n))?.id ?? null
}

const nombreDe = (ctx: Contexto, id: string | null | undefined) =>
  nombreCorto(ctx.datos.miembros.find((m) => m.id === id)?.full_name ?? 'Sin asignar')

const fecha = (iso: string) => formatDateLocal(iso)

/** Texto de lo que se va a hacer, para la tarjeta de confirmacion. */
export function describir(llamadas: Llamada[], ctx: Contexto): string[] {
  const tema = (id: unknown) => ctx.datos.temas.find((t) => t.id === id)
  const act = (id: unknown) => ctx.datos.actividades.find((a) => a.id === id)
  return llamadas.map((c) => {
    const a = c.args
    switch (c.tool) {
      case 'crear_tema_minuta':
        return `Crear el tema de minuta «${s(a.tema)}»`
      case 'actualizar_tema_minuta':
        return `Actualizar el tema «${tema(a.tema)?.tema ?? '?'}»`
      case 'asignar_tema_minuta': {
        const t = tema(a.tema)
        const quien = idDePersona(ctx, a.responsable) ?? t?.responsables[0]
        return `Asignar «${t?.tema ?? '?'}» a ${nombreDe(ctx, quien)}${s(a.fecha_entrega) ? `, entrega ${fecha(s(a.fecha_entrega)!)}` : ''} (se le avisa)`
      }
      case 'marcar_conversado':
        return `Marcar «${tema(a.tema)?.tema ?? '?'}» como conversado`
      case 'llevar_a_minuta':
        return `Llevar «${act(a.ref)?.title ?? '?'}» a la minuta`
      case 'cerrar_semana':
        return a.pendientes === 'mover'
          ? 'Cerrar la semana y mover lo no cumplido a la próxima'
          : a.pendientes === 'minuta'
            ? 'Cerrar la semana y llevar lo no cumplido a la minuta'
            : 'Cerrar la semana sin cambiar lo pendiente'
      case 'actualizar_actividad':
        return a.estado === 'completado'
          ? `Marcar hecho «${act(a.actividad)?.title ?? '?'}»`
          : `Mover «${act(a.actividad)?.title ?? '?'}» al ${fecha(s(a.fecha_entrega) ?? '')}`
      default:
        return c.tool
    }
  })
}

/**
 * Ejecuta las acciones en orden. Devuelve una linea por resultado (el texto del mensaje) y las
 * tarjetas de lo que quedo hecho (se dibujan bajo el texto y llevan a cada cosa). Un error en una
 * accion no frena las siguientes: se informa en su linea.
 */
export async function ejecutar(
  llamadas: Llamada[],
  ctx: Contexto,
): Promise<{ lineas: string[]; tarjetas: Tarjeta[] }> {
  const lineas: string[] = []
  const tarjetas: Tarjeta[] = []
  for (const c of llamadas) {
    try {
      lineas.push(await ejecutarUna(c, ctx, tarjetas))
    } catch (err) {
      console.error('Agente: fallo', c.tool, err)
      lineas.push(`⚠️ No pude: ${describir([c], ctx)[0]}.`)
    }
  }
  return { lineas, tarjetas }
}

const corta = (iso: string) =>
  new Date(iso.split('T')[0] + 'T00:00:00').toLocaleDateString('es-CL', {
    weekday: 'short',
    day: 'numeric',
  })

async function ejecutarUna(c: Llamada, ctx: Contexto, tarjetas: Tarjeta[]): Promise<string> {
  const a = c.args
  const { datos } = ctx
  const tema = datos.temas.find((t) => t.id === a.tema)
  const porId = Object.fromEntries(datos.actividades.map((x) => [x.id, x]))
  const sinPermiso = (que: string) => `🔒 No tienes permiso para ${que}.`

  switch (c.tool) {
    case 'pedir_aclaracion':
      return s(a.pregunta) ?? '¿Me das más detalles?'

    case 'crear_tema_minuta': {
      if (!ctx.can('minuta.gestionar')) return sinPermiso('crear temas en la minuta')
      const titulo = s(a.tema)
      if (!titulo) return '¿Cuál es el tema?'
      const responsable = idDePersona(ctx, a.responsable)
      const plazo = s(a.plazo) ?? null
      const nuevo = await minutesService.create({
        team_id: ctx.teamId,
        tipo: 'minuta',
        orden: datos.temas.filter((t) => t.tipo === 'minuta').length,
        tema: titulo,
        para_todos: false,
        responsables: responsable ? [responsable] : [],
        responsables_text: '',
        estado: 'pendiente',
        plazo,
        plazo_history: plazo ? [{ date: plazo, at: new Date().toISOString() }] : [],
        comentarios: s(a.comentario) ?? '',
        linked_activity_ids: [],
        created_by: ctx.yo.id,
      })
      datos.temas.push(nuevo)
      tarjetas.push({
        tono: 'violeta',
        etiqueta: 'Tema nuevo',
        valor: plazo ? corta(plazo) : undefined,
        titulo: titulo,
        detalle: responsable ? `${nombreDe(ctx, responsable)} · Minuta` : 'Minuta',
        ruta: '/minuta',
      })
      return `📋 Tema agregado a la minuta: «${titulo}»${responsable ? ` · ${nombreDe(ctx, responsable)}` : ''}${plazo ? ` · plazo ${fecha(plazo)}` : ''}`
    }

    case 'actualizar_tema_minuta': {
      if (!tema) return 'No encontré ese tema.'
      if (!ctx.can('minuta.gestionar')) return sinPermiso('editar la minuta')
      const cambios: string[] = []
      const patch: Partial<MinuteItem> = {}
      const estado = s(a.estado) as MinuteItem['estado'] | undefined
      if (estado) {
        // Con actividades, el estado lo deciden ellas (deriveEstado): cambiarlo a mano no se
        // veria. "Definir en reunion" si se puede siempre: es una marca, no un avance.
        if (tema.linked_activity_ids.length && estado !== 'definir')
          cambios.push('el estado lo deciden sus actividades (no lo cambié)')
        else {
          patch.estado = estado
          cambios.push(
            `estado ${estado === 'definir' ? 'para conversar' : estado.replace('_', ' ')}`,
          )
        }
      }
      const responsable = idDePersona(ctx, a.responsable)
      if (responsable) {
        patch.responsables = [responsable]
        cambios.push(`responsable ${nombreDe(ctx, responsable)}`)
      }
      const comentario = s(a.comentario)
      if (comentario) {
        // Se agrega, no se reemplaza: el comentario del tema es la nota de la reunion.
        patch.comentarios = tema.comentarios ? `${tema.comentarios}\n${comentario}` : comentario
        cambios.push('comentario agregado')
      }
      const plazo = s(a.plazo)
      const patchPlazo = plazo ? patchDePlazo(tema, plazo) : null
      if (patchPlazo) Object.assign(patch, patchPlazo)
      if (Object.keys(patch).length) await minutesService.update(tema.id, patch)
      if (patchPlazo && plazo) {
        const movidas = await moverEntregasDelTema(tema, plazo, porId)
        cambios.push(
          `plazo ${fecha(plazo)}${movidas ? ` (y ${movidas} actividad${movidas === 1 ? '' : 'es'})` : ''}`,
        )
      }
      Object.assign(tema, patch)
      if (cambios.length)
        tarjetas.push({
          tono: 'violeta',
          etiqueta: 'Tema',
          valor: plazo ? corta(plazo) : undefined,
          titulo: tema.tema,
          detalle: cambios.join(' · '),
          ruta: '/minuta',
        })
      return cambios.length
        ? `✏️ «${tema.tema}»: ${cambios.join(', ')}.`
        : `No vi qué cambiar en «${tema.tema}».`
    }

    case 'asignar_tema_minuta': {
      if (!tema) return 'No encontré ese tema.'
      if (!ctx.can('minuta.asignar')) return sinPermiso('asignar temas de la minuta')
      if (tema.linked_activity_ids.length) return `«${tema.tema}» ya tiene actividad asignada.`
      const responsable = idDePersona(ctx, a.responsable) ?? tema.responsables[0]
      if (!responsable) return `¿A quién le asigno «${tema.tema}»?`
      const prioridad = typeof a.prioridad === 'number' ? a.prioridad : 2
      const ids = await crearActividadesDeTema({
        item: tema,
        items: datos.temas,
        responsibleIds: [responsable],
        priority: prioridad,
        dueDate: s(a.fecha_entrega) ?? null,
        userId: ctx.yo.id,
        teamId: ctx.teamId,
      })
      tema.linked_activity_ids = [...tema.linked_activity_ids, ...ids]
      tarjetas.push({
        tono: 'violeta',
        etiqueta: 'Asignada',
        valor: s(a.fecha_entrega) ? corta(s(a.fecha_entrega)!) : undefined,
        titulo: tema.tema,
        detalle: `${nombreDe(ctx, responsable)} · desde la Minuta`,
        activityId: ids[0],
      })
      return `✅ «${tema.tema}» asignado a ${nombreDe(ctx, responsable)}${s(a.fecha_entrega) ? `, entrega ${fecha(s(a.fecha_entrega)!)}` : ''}.`
    }

    case 'marcar_conversado': {
      if (!tema) return 'No encontré ese tema.'
      if (!ctx.can('minuta.gestionar')) return sinPermiso('editar la minuta')
      // Mismo criterio que la Minuta: un tema escalado (con actividad) vuelve a En desarrollo y
      // su actividad sigue; uno sin actividad, conversado y sin asignar, no requiere trabajo y
      // se cierra como Resuelto.
      const conActividad = tema.linked_activity_ids.length > 0
      const estado = conActividad ? 'en_desarrollo' : 'resuelto'
      await minutesService.update(tema.id, { estado })
      tema.estado = estado
      tarjetas.push({
        tono: 'verde',
        etiqueta: 'Conversado',
        titulo: tema.tema,
        detalle: conActividad ? 'Su actividad sigue su curso' : 'Cerrado sin actividad',
        ruta: '/minuta',
      })
      return conActividad
        ? `💬 «${tema.tema}» conversado: sale de la lista y su actividad sigue su curso.`
        : `💬 «${tema.tema}» conversado y cerrado sin actividad.`
    }

    case 'actualizar_actividad': {
      const act = porId[a.actividad as string]
      if (!act) return 'No encontré esa actividad.'
      const puede =
        ctx.can('actividades.editar_todas') ||
        act.responsible_id === ctx.yo.id ||
        ctx.can('compromisos.conducir')
      if (!puede) return sinPermiso(`cambiar «${act.title}»`)
      const nueva = s(a.fecha_entrega)
      if (a.estado === 'completado') {
        await activitiesService.update(act.id, { status: 'completado' })
        act.status = 'completado'
        tarjetas.push({
          tono: 'verde',
          etiqueta: 'Hecho',
          titulo: act.title,
          detalle: nombreDe(ctx, act.responsible_id),
          activityId: act.id,
        })
        return `✅ Hecho: «${act.title}».`
      }
      if (nueva) {
        const dias = Math.round(
          (new Date(nueva + 'T00:00:00').getTime() -
            new Date(act.due_date.split('T')[0] + 'T00:00:00').getTime()) /
            86_400_000,
        )
        // Una semana justa es "mover el compromiso": misma operacion que la hoja (sincroniza
        // el tema). Otra fecha: se cambia la entrega y tambien el plazo del tema.
        if (dias === 7) await moverActividadUnaSemana(act, datos.temas)
        else await cambiarEntrega(act, nueva, datos.temas)
        tarjetas.push({
          tono: 'ambar',
          etiqueta: 'Movida',
          valor: corta(nueva),
          titulo: act.title,
          detalle: nombreDe(ctx, act.responsible_id),
          activityId: act.id,
        })
        return `📅 «${act.title}» ahora vence el ${fecha(nueva)}.`
      }
      return `No vi qué cambiar en «${act.title}».`
    }

    case 'llevar_a_minuta': {
      const act = porId[a.ref as string]
      if (!act) return 'Eso todavía llévalo desde Proyectos con «Discutir en reunión».'
      if (!ctx.can('compromisos.conducir')) return sinPermiso('llevar compromisos a la minuta')
      if (yaEnMinuta(datos.temas, act.id))
        return `«${act.title}» ya está en la minuta para conversar.`
      await llevarActividadAMinuta(act, { teamId: ctx.teamId, userId: ctx.yo.id })
      tarjetas.push({
        tono: 'ambar',
        etiqueta: 'A la minuta',
        titulo: act.title,
        detalle: 'Para conversarlo en la reunión',
        ruta: '/minuta',
      })
      return `📋 «${act.title}» quedó en la minuta para conversarlo.`
    }

    case 'consultar_compromisos':
      return consultarCompromisos(a, ctx, tarjetas)

    case 'cerrar_semana':
      return cerrarSemana(a.pendientes as string, ctx, tarjetas)

    default:
      return `Eso todavía no lo sé hacer desde el chat (${c.tool}).`
  }
}

/** Compromisos que la persona puede ver: los suyos, o todos si ve al equipo. */
function visibles(ctx: Contexto, lista: Activity[]) {
  return lista.filter((a) => ctx.veTodo || a.responsible_id === ctx.yo.id)
}

/** Tarjeta de un compromiso pendiente: rojo si ya vencio, ambar si viene. */
function tarjetaPendiente(c: Activity, ctx: Contexto): Tarjeta {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const vence = new Date(c.due_date.split('T')[0] + 'T00:00:00')
  const dias = Math.round((hoy.getTime() - vence.getTime()) / 86_400_000)
  return dias > 0
    ? {
        tono: 'rojo',
        etiqueta: 'Vencida',
        valor: `HACE ${dias} D`,
        titulo: c.title,
        detalle: nombreDe(ctx, c.responsible_id),
        activityId: c.id,
      }
    : {
        tono: 'ambar',
        etiqueta: 'Vence',
        valor: corta(c.due_date),
        titulo: c.title,
        detalle: nombreDe(ctx, c.responsible_id),
        activityId: c.id,
      }
}

function consultarCompromisos(
  a: Record<string, unknown>,
  ctx: Contexto,
  tarjetas: Tarjeta[],
): string {
  const { datos } = ctx
  const persona = idDePersona(ctx, a.responsable)
  const dePersona = (l: Activity[]) => (persona ? l.filter((x) => x.responsible_id === persona) : l)

  if (a.solo_vencidos) {
    const vencidos = dePersona(
      visibles(ctx, compromisosVencidosAbiertos(datos.actividades, datos.temas)),
    )
    if (!vencidos.length) return '🎉 No hay compromisos vencidos sin cerrar.'
    vencidos.slice(0, 6).forEach((c) => tarjetas.push(tarjetaPendiente(c, ctx)))
    return [
      `⏰ ${vencidos.length} compromiso${vencidos.length === 1 ? '' : 's'} vencido${vencidos.length === 1 ? '' : 's'} sin cerrar:`,
      ...vencidos
        .slice(0, 15)
        .map(
          (c) =>
            `• ${c.title} — ${nombreDe(ctx, c.responsible_id)} · venció el ${fecha(c.due_date)}`,
        ),
    ].join('\n')
  }

  const offset = a.semana === 'anterior' ? -1 : a.semana === 'siguiente' ? 1 : 0
  const { desde, hasta, etiqueta } = semanaDe(offset)
  const lista = dePersona(
    visibles(ctx, compromisosEnVentana(datos.actividades, datos.temas, desde, hasta)),
  )
  const st = compromisoStats(lista)
  if (!st.total) return `No hay compromisos para la semana ${etiqueta}.`
  const pendientes = lista.filter((c) => c.status !== 'completado')
  const tono = st.porcentaje! >= st.meta ? '🟢' : st.porcentaje! >= 60 ? '🟡' : '🔴'
  tarjetas.push({
    tono: st.porcentaje! >= st.meta ? 'verde' : st.porcentaje! >= 60 ? 'ambar' : 'rojo',
    etiqueta: 'Compromisos',
    valor: `${st.porcentaje}%`,
    titulo: `${st.cumplidos} de ${st.total} cumplidos`,
    detalle: `${pendientes.length ? `faltan ${pendientes.length} · ` : ''}meta ${st.meta}%`,
    ruta: '/compromisos',
  })
  pendientes.slice(0, 5).forEach((c) => tarjetas.push(tarjetaPendiente(c, ctx)))
  return [
    `${tono} Semana ${etiqueta}: ${st.porcentaje}% cumplido (${st.cumplidos} de ${st.total}) · meta ${st.meta}%.`,
    ...(pendientes.length
      ? [
          `Falta${pendientes.length === 1 ? '' : 'n'}:`,
          ...pendientes
            .slice(0, 15)
            .map((c) => `• ${c.title} — ${nombreDe(ctx, c.responsible_id)} · ${fecha(c.due_date)}`),
        ]
      : ['Todo cumplido. 🎉']),
  ].join('\n')
}

async function cerrarSemana(
  pendientes: string,
  ctx: Contexto,
  tarjetas: Tarjeta[],
): Promise<string> {
  if (!ctx.can('compromisos.conducir')) return '🔒 No tienes permiso para cerrar la semana.'
  const { datos } = ctx
  const { desde, hasta, etiqueta } = semanaDe(0)
  const lista = visibles(ctx, compromisosEnVentana(datos.actividades, datos.temas, desde, hasta))
  const st = compromisoStats(lista)
  const abiertos = lista.filter((c) => c.status !== 'completado')
  const cabecera = `Semana ${etiqueta}: cierra con ${st.porcentaje ?? 0}% (${st.cumplidos} de ${st.total}).`
  tarjetas.push({
    tono: (st.porcentaje ?? 0) >= st.meta ? 'verde' : 'ambar',
    etiqueta: 'Semana cerrada',
    valor: `${st.porcentaje ?? 0}%`,
    titulo: `${st.cumplidos} de ${st.total} cumplidos`,
    detalle:
      pendientes === 'mover'
        ? 'Lo pendiente pasa a la próxima'
        : pendientes === 'minuta'
          ? 'Lo pendiente va a la minuta'
          : 'Sin cambios en lo pendiente',
    ruta: '/compromisos',
  })
  if (!abiertos.length || pendientes === 'dejar')
    return `${cabecera} ${abiertos.length ? `Quedan ${abiertos.length} abiertos, sin cambios.` : 'No queda nada abierto.'}`

  let ok = 0
  // De a uno y en orden: llevar a la minuta calcula el orden del tema leyendo los que ya hay.
  for (const c of abiertos) {
    try {
      if (pendientes === 'mover') {
        const { tema } = await moverActividadUnaSemana(c, datos.temas)
        if (tema) datos.temas = datos.temas.map((t) => (t.id === tema.id ? tema : t))
        ok++
      } else if (!yaEnMinuta(datos.temas, c.id)) {
        await llevarActividadAMinuta(c, { teamId: ctx.teamId, userId: ctx.yo.id })
        ok++
      }
    } catch (err) {
      console.error('Cerrar semana: fallo', c.id, err)
    }
  }
  return pendientes === 'mover'
    ? `${cabecera} Moví ${ok} de ${abiertos.length} a la próxima semana.`
    : `${cabecera} Llevé ${ok} a la minuta para conversarlos.`
}
