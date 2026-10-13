import type { EmpresaSesion } from './types'

/** Dias que quedan de prueba (0 si ya vencio), o null si la empresa no esta en prueba. */
export function diasDePrueba(empresa: EmpresaSesion | null): number | null {
  if (!empresa || empresa.plan !== 'prueba') return null
  const ms = Date.parse(empresa.prueba_hasta) - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

/** La prueba de 15 dias termino (migracion 056). El Owner nunca queda bloqueado. */
export function pruebaVencida(empresa: EmpresaSesion | null, esOwner: boolean): boolean {
  if (esOwner || !empresa || empresa.plan !== 'prueba') return false
  return Date.parse(empresa.prueba_hasta) < Date.now()
}

/**
 * A donde se escribe para activar una suscripcion si no se pudo leer la configuracion de la
 * plataforma (migracion 057: el Owner la cambia en Administracion -> Empresas).
 */
export const CONTACTO_SUSCRIPCION = 'sebadiazespindola57@gmail.com'
