import type { ChatMessage } from '@features/chat/types'
import type { IconName } from '@shared/components/ui/Icon'

// Logica pura del chat como registro de trabajo: agrupar, filtrar y contar. Separada de los
// componentes para que ChatPage no vuelva a ser un archivo de 1.600 lineas.

/** Preguntas de Lumix que esperan una decision de la persona. */
export const PROMPT_TYPES = [
  'category_confirm',
  'overload',
  'overload_lote',
  'name_confirm',
  'activity_pick',
  'delete_confirm',
  'reclass_proyecto_confirm',
  'reclass_ingesta_confirm',
  'reclass_error_confirm',
  'agente_confirmar',
  'agente_aclaracion',
] as const

export type PromptType = (typeof PROMPT_TYPES)[number]

// Preguntas que se traen a la vista solas al llegar. 'overload_lote' NO: las actividades ya
// quedaron creadas, es una sugerencia y no una pregunta pendiente; interrumpir por algo ya
// resuelto es justo lo que se estaba tratando de evitar.
export const AUTO_FOCUS_TYPES: readonly string[] = PROMPT_TYPES.filter((t) => t !== 'overload_lote')

export function metaDe(msg: ChatMessage): Record<string, unknown> {
  return (msg.metadata ?? {}) as Record<string, unknown>
}

export function tipoDe(msg: ChatMessage): string | undefined {
  const t = metaDe(msg).type
  return typeof t === 'string' ? t : undefined
}

// Las respuestas de Lumix se guardan con el sender_id de quien pregunto e is_ai=true; al
// cargarlas el hook las pasa a 'ai', pero las que llegan por realtime conservan el original.
export function esLumix(msg: ChatMessage): boolean {
  return msg.sender_id === 'ai' || !!msg.is_ai
}

export function esPregunta(msg: ChatMessage): boolean {
  const t = tipoDe(msg)
  return !!t && (PROMPT_TYPES as readonly string[]).includes(t)
}

export function preguntaAbierta(msg: ChatMessage): boolean {
  return esPregunta(msg) && !metaDe(msg).resolved
}

/** Confirmacion de creacion (persistActivity): trae el id, y desde ahora tambien la foto. */
export function esActividadCreada(msg: ChatMessage): boolean {
  const meta = metaDe(msg)
  return esLumix(msg) && !meta.type && typeof meta.activity_id === 'string'
}

/** Lo que Lumix hizo que deja trabajo registrado (o pendiente de decidir). */
export function esResultadoDeTrabajo(msg: ChatMessage): boolean {
  const t = tipoDe(msg)
  return (
    t === 'activity_card' ||
    t === 'activity_list' ||
    t === 'agente_resultado' ||
    t === 'proyecto_confirm' ||
    esPregunta(msg) ||
    esActividadCreada(msg) ||
    msg.category === 'error'
  )
}

/**
 * Una entrada del registro: lo que alguien escribio y lo que Lumix hizo con eso, colgado
 * debajo. Las respuestas de Lumix sin un mensaje de origen cargado quedan solas.
 */
export type Entrada =
  | { kind: 'persona'; msg: ChatMessage; resultados: ChatMessage[] }
  | { kind: 'lumix'; msg: ChatMessage }

/**
 * Cuelga cada respuesta de Lumix del ultimo mensaje de SU DUEÑO.
 *
 * No hay un vinculo guardado entre la respuesta y el mensaje que la provoco (solo el mensaje
 * de origen guarda el id de la actividad), pero Lumix siempre responde al ultimo mensaje de
 * quien le hablo: el hook procesa de a uno y guarda la respuesta con su sender_id. Agrupar por
 * dueño y no por orden es lo que hace que en la vista del admin, que ve a todo el equipo, la
 * respuesta a Andrea no termine colgando del mensaje de Diego que llego entremedio.
 */
export function agrupar(messages: ChatMessage[]): Entrada[] {
  const entradas: Entrada[] = []
  const ultimaDe = new Map<string, Extract<Entrada, { kind: 'persona' }>>()
  for (const msg of messages) {
    if (esLumix(msg)) {
      const origen = msg.owner_id ? ultimaDe.get(msg.owner_id) : undefined
      if (origen) origen.resultados.push(msg)
      else entradas.push({ kind: 'lumix', msg })
      continue
    }
    const entrada = { kind: 'persona' as const, msg, resultados: [] as ChatMessage[] }
    entradas.push(entrada)
    ultimaDe.set(msg.sender_id, entrada)
  }
  return entradas
}

export type Filtro = 'todo' | 'trabajo' | 'decidir'

function mensajesDe(e: Entrada): ChatMessage[] {
  return e.kind === 'persona' ? [e.msg, ...e.resultados] : [e.msg]
}

export function entradaConTrabajo(e: Entrada): boolean {
  if (e.kind === 'persona' && e.msg.category) return true
  return mensajesDe(e).some(esResultadoDeTrabajo)
}

export function entradaPorDecidir(e: Entrada): boolean {
  return mensajesDe(e).some(preguntaAbierta)
}

export function filtrar(entradas: Entrada[], filtro: Filtro): Entrada[] {
  if (filtro === 'trabajo') return entradas.filter(entradaConTrabajo)
  if (filtro === 'decidir') return entradas.filter(entradaPorDecidir)
  return entradas
}

// Lumix escribe con emojis al inicio ("✅ Actividad creada", "📨 Notificacion enviada"). El
// texto se guarda asi en la base, asi que la traduccion a icono se hace al pintar: el emoji
// define el icono y desaparece del texto.
const EMOJI_ICONO: [RegExp, IconName][] = [
  [/✅|✔/u, 'check'],
  [/📨/u, 'send'],
  [/🗑/u, 'trash'],
  [/📅|🗓/u, 'calendarMove'],
  [/⚠/u, 'alert'],
]

const EMOJI_RE = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu

export function textoLumix(content: string): { icon?: IconName; text: string } {
  const primero = content.trimStart().match(/^\p{Extended_Pictographic}/u)?.[0]
  const icon = primero ? EMOJI_ICONO.find(([re]) => re.test(primero))?.[1] : undefined
  const text = content
    .split('\n')
    .map((linea) => linea.replace(EMOJI_RE, '').replace(/^\s+/, '').replace(/\s+$/, ''))
    .join('\n')
    .trim()
  return { icon, text }
}

export function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

/** Separador de dia del registro: "Hoy", "Ayer", "lun 5 oct". */
export function etiquetaDia(iso: string): string {
  const d = new Date(iso)
  const hoy = new Date()
  const inicio = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const dias = Math.round((inicio(hoy) - inicio(d)) / 86_400_000)
  if (dias === 0) return 'Hoy'
  if (dias === 1) return 'Ayer'
  return d
    .toLocaleDateString('es-CL', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      ...(d.getFullYear() === hoy.getFullYear() ? {} : { year: 'numeric' }),
    })
    .replace(/\./g, '')
}

export function claveDia(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}
