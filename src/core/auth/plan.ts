import type { EmpresaSesion } from './types'

// Reglas de la suscripcion de una empresa (migraciones 056 y 063). Las mismas reglas viven en el
// servidor (supabase/functions/_shared/auth.ts, que corta la IA) y en la base (registrar_pago):
// si cambias una, cambia las tres.
//
//   prueba -> vale hasta prueba_hasta (15 dias desde que se crea).
//   gratis -> sin vencimiento.
//   pago   -> vale hasta pagado_hasta; despues hay DIAS_GRACIA dias con aviso y luego se bloquea.

/** Dias de uso despues de vencido el pago, con aviso, antes de bloquear. */
export const DIAS_GRACIA = 7
/** Dias antes del vencimiento en que se avisa al Admin de la empresa. */
export const DIAS_AVISO = 7

export type EstadoSuscripcion =
  | { tipo: 'gratis' }
  | { tipo: 'prueba'; dias: number }
  | { tipo: 'prueba_vencida' }
  | { tipo: 'al_dia'; hasta: string; dias: number }
  | { tipo: 'por_vencer'; hasta: string; dias: number }
  | { tipo: 'en_gracia'; hasta: string; quedan: number }
  | { tipo: 'vencida'; hasta: string | null }

/** Lo minimo para calcular el estado: sirve con la empresa de la sesion o la de la consola. */
export interface DatosPlan {
  plan: 'prueba' | 'gratis' | 'pago'
  prueba_hasta: string
  pagado_hasta: string | null
}

/** Hoy en Chile (YYYY-MM-DD): los vencimientos de pago se cuentan por dia chileno. */
export function hoyChile(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })
}

/** Dias entre dos fechas YYYY-MM-DD (b - a). */
export function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

/**
 * Suma dias o meses a una fecha YYYY-MM-DD. Los meses se suman como Postgres: si el dia no
 * existe en el mes de destino queda en el ultimo (31-ene + 1 mes = 28-feb, no 3-mar).
 */
export function sumarFecha(
  ymd: string,
  { dias = 0, meses = 0 }: { dias?: number; meses?: number },
) {
  const d = new Date(`${ymd}T00:00:00Z`)
  if (meses) {
    const dia = d.getUTCDate()
    d.setUTCDate(1)
    d.setUTCMonth(d.getUTCMonth() + meses)
    const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
    d.setUTCDate(Math.min(dia, ultimo))
  }
  if (dias) d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

/** "25 nov 2026" para una fecha YYYY-MM-DD. */
export function fechaCorta(ymd: string): string {
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function estadoSuscripcion(e: DatosPlan): EstadoSuscripcion {
  if (e.plan === 'gratis') return { tipo: 'gratis' }
  if (e.plan === 'prueba') {
    const ms = Date.parse(e.prueba_hasta) - Date.now()
    return ms > 0
      ? { tipo: 'prueba', dias: Math.ceil(ms / 86_400_000) }
      : { tipo: 'prueba_vencida' }
  }
  const hasta = e.pagado_hasta
  if (!hasta) return { tipo: 'vencida', hasta: null }
  const dias = diasEntre(hoyChile(), hasta)
  if (dias >= 0) return { tipo: dias < DIAS_AVISO ? 'por_vencer' : 'al_dia', hasta, dias }
  const quedan = DIAS_GRACIA + dias
  return quedan >= 0 ? { tipo: 'en_gracia', hasta, quedan } : { tipo: 'vencida', hasta }
}

/** La empresa ya no puede usar la app (prueba terminada o pago vencido sin gracia). */
export function suscripcionBloqueada(empresa: EmpresaSesion | null, esOwner: boolean): boolean {
  if (esOwner || !empresa) return false
  const t = estadoSuscripcion(empresa).tipo
  return t === 'prueba_vencida' || t === 'vencida'
}

/** Dias que quedan de prueba (0 si ya vencio), o null si la empresa no esta en prueba. */
export function diasDePrueba(empresa: EmpresaSesion | null): number | null {
  if (!empresa || empresa.plan !== 'prueba') return null
  const ms = Date.parse(empresa.prueba_hasta) - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

/**
 * Periodo que cubriria un pago nuevo: parte hoy, o al dia siguiente del vencimiento si aun no
 * vence (misma regla que registrar_pago en la base). Sirve para la vista previa.
 */
export function periodoDePago(pagadoHasta: string | null, meses: number) {
  const hoy = hoyChile()
  const desde = pagadoHasta && pagadoHasta >= hoy ? sumarFecha(pagadoHasta, { dias: 1 }) : hoy
  return { desde, hasta: sumarFecha(sumarFecha(desde, { meses }), { dias: -1 }) }
}

/**
 * A donde se escribe para activar una suscripcion si no se pudo leer la configuracion de la
 * plataforma (migracion 057: el Owner la cambia en Administracion -> Empresas).
 */
export const CONTACTO_SUSCRIPCION = 'sebadiazespindola57@gmail.com'
