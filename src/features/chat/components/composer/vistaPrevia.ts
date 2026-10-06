import { fechaRelativa, formatDateLocal } from '@shared/utils/date'
import { nombreCorto } from '@shared/utils/nombres'
import {
  findMentionedMembers,
  normalizeName,
  type Member,
} from '@features/chat/hooks/useChatMessages'
import { toYMD } from '@features/chat/components/log/actividad'

// VISTA PREVIA DE LO QUE LUMIX VA A ENTENDER, calculada en el navegador y SIN llamar a la IA.
//
// Es un adelanto, no una promesa: quien decide de verdad es la IA al enviar. Por eso cada campo
// dice si es seguro o dudoso (borde punteado), y si algo no se reconoce simplemente no aparece
// en vez de inventarse. La persona usa las mismas reglas de coincidencia que el hook del chat.

export type TipoMensaje =
  | 'auto'
  | 'actividad'
  | 'error'
  | 'ingesta'
  | 'masivo'
  | 'minuta'
  | 'proyecto'

export const TIPO_LABEL: Record<TipoMensaje, string> = {
  auto: 'Auto',
  actividad: 'Actividad',
  error: 'Error',
  ingesta: 'Ingesta',
  masivo: 'Masivo',
  minuta: 'Minuta',
  proyecto: 'Proyecto',
}

export interface Campo {
  texto: string
  /** true = Lumix podria entender otra cosa: se dibuja con borde punteado. */
  dudoso: boolean
  /** Detalle en el tooltip (ej. la fecha exacta). */
  titulo?: string
}

export interface VistaPrevia {
  persona?: Campo
  fecha?: Campo
  prioridad?: Campo
}

const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

function campoFecha(d: Date, dudoso: boolean): Campo {
  const ymd = toYMD(d)
  return { texto: fechaRelativa(ymd).text, dudoso, titulo: formatDateLocal(ymd) }
}

function sumarDias(n: number): Date {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + n)
  return d
}

export function detectarFecha(n: string): Campo | undefined {
  if (/\bpasado manana\b/.test(n)) return campoFecha(sumarDias(2), false)
  // "en la mañana" es una hora del dia, no el dia siguiente.
  if (/\bmanana\b/.test(n) && !/\b(la|esta) manana\b/.test(n))
    return campoFecha(sumarDias(1), false)
  if (/\bhoy\b/.test(n)) return campoFecha(sumarDias(0), false)

  const enDias = /\ben (\d{1,3}) dias?\b/.exec(n)
  if (enDias) return campoFecha(sumarDias(Number(enDias[1])), false)

  const dia = new RegExp(`\\b(${DIAS.join('|')})\\b`).exec(n)
  if (dia) {
    const hoy = new Date().getDay()
    const objetivo = DIAS.indexOf(dia[1])
    let delta = (objetivo - hoy + 7) % 7
    const proximo = new RegExp(
      `\\b(proximo|siguiente) ${dia[1]}\\b|\\b${dia[1]} (que viene|siguiente)\\b`,
    ).test(n)
    // "el lunes" dicho un lunes, o "el proximo jueves" dicho un martes: cada persona lo
    // entiende distinto, asi que se muestra la lectura mas comun como dudosa.
    const dudoso = delta === 0 || (proximo && delta < 7)
    if (delta === 0) delta = 7
    return campoFecha(sumarDias(delta), dudoso)
  }

  // Anio de 2 o 4 digitos (no 3: "15/10/202" no es una fecha). Y "1/2 hora" o "3/4 kg" son
  // cantidades, no fechas: si despues viene una unidad, no se interpreta.
  const dm = /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}|\d{2}))?(?![\d/-])/.exec(n)
  const esCantidad =
    !!dm &&
    /^\s*(horas?|hrs?|h|minutos?|min|kilos?|kg|litros?|lt|%|partes?|dias?)\b/.test(
      n.slice(dm.index + dm[0].length),
    )
  if (dm && !esCantidad) {
    const dd = Number(dm[1])
    const mm = Number(dm[2]) - 1
    const hoy = new Date()
    let yy = dm[3] ? Number(dm[3].length === 2 ? `20${dm[3]}` : dm[3]) : hoy.getFullYear()
    let d = new Date(yy, mm, dd, 12)
    if (d.getMonth() !== mm || d.getDate() !== dd) return undefined
    // Sin año y ya pasada: lo normal es que hable del año siguiente, pero no es seguro.
    if (!dm[3] && d < new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())) {
      yy += 1
      d = new Date(yy, mm, dd, 12)
      return campoFecha(d, true)
    }
    return campoFecha(d, false)
  }

  if (/\b(proxima semana|semana que viene)\b/.test(n)) {
    const delta = (1 - new Date().getDay() + 7) % 7 || 7
    return campoFecha(sumarDias(delta), true)
  }
  return undefined
}

export function detectarPrioridad(n: string): Campo | undefined {
  if (/\b(urgente|urgencia)\b/.test(n)) return { texto: 'Alta', dudoso: false }
  const explicita =
    /\bprioridad (alta|media|baja)\b/.exec(n) ?? /\b(alta|media|baja) prioridad\b/.exec(n)
  if (explicita) {
    const p = explicita[1]
    return { texto: p.charAt(0).toUpperCase() + p.slice(1), dudoso: false }
  }
  // "alta" o "baja" sueltas suelen ser prioridad, pero tambien "dar de alta" o "dar de baja".
  if (/\balta\b/.test(n) && !/\bde alta\b/.test(n)) return { texto: 'Alta', dudoso: true }
  if (/\bbaja\b/.test(n) && !/\bde baja\b/.test(n)) return { texto: 'Baja', dudoso: true }
  return undefined
}

export function detectarPersona(texto: string, members: Member[]): Campo | undefined {
  const encontrados = findMentionedMembers(texto, members)
  if (encontrados.length === 0 || encontrados.length > 3) return undefined
  if (encontrados.length > 1) {
    return {
      texto: `¿${encontrados.map((m) => nombreCorto(m.full_name)).join(' o ')}?`,
      dudoso: true,
    }
  }
  const m = encontrados[0]
  // Segura solo si el texto trae una palabra que ES parte del nombre; si calzo por un
  // pedazo ("ana" dentro de "analizar"), se muestra como duda.
  const palabras = new Set(normalizeName(texto).split(/[^a-zñ0-9]+/))
  const exacto = normalizeName(m.full_name)
    .split(/\s+/)
    .some((t) => palabras.has(t))
  return { texto: nombreCorto(m.full_name), dudoso: !exacto, titulo: m.full_name }
}

export function vistaPrevia(
  texto: string,
  members: Member[],
  { personas }: { personas: boolean },
): VistaPrevia {
  const n = normalizeName(texto)
  if (!n) return {}
  return {
    persona: personas ? detectarPersona(texto, members) : undefined,
    fecha: detectarFecha(n),
    prioridad: detectarPrioridad(n),
  }
}
