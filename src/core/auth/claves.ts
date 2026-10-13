// Reglas de las claves (revision de seguridad, docs/seguridad-wstg-2026-10-09.md, H4 y H6).
// El minimo de 8 tambien lo exige Supabase (password_min_length); la revision de claves
// filtradas es solo de la app porque la de Supabase es del plan Pro.

export const MIN_CLAVE = 8

/** Error de una clave nueva (largo y confirmacion), o null si esta bien. */
export function errorClaveNueva(clave: string, confirmacion?: string): string | null {
  if (clave.length < MIN_CLAVE) return `La contraseña debe tener al menos ${MIN_CLAVE} caracteres.`
  if (confirmacion !== undefined && clave !== confirmacion) return 'Las contraseñas no coinciden.'
  return null
}

/**
 * La clave aparece en filtraciones conocidas (Have I Been Pwned, por k-anonimato: solo viajan
 * los primeros 5 caracteres de su SHA-1, nunca la clave). Si el servicio no responde, no se
 * bloquea a nadie.
 */
export async function claveFiltrada(clave: string): Promise<boolean> {
  try {
    const hash = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(clave))
    const hex = [...new Uint8Array(hash)]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
    const res = await fetch(`https://api.pwnedpasswords.com/range/${hex.slice(0, 5)}`, {
      headers: { 'Add-Padding': 'true' },
    })
    if (!res.ok) return false
    const sufijo = hex.slice(5)
    return (await res.text())
      .split('\n')
      .some((linea) => linea.startsWith(sufijo) && !linea.trim().endsWith(':0'))
  } catch {
    return false
  }
}

export const MENSAJE_FILTRADA =
  'Esa contraseña apareció en filtraciones de otros sitios. Elige una distinta.'

/** Mensaje en espanol para los errores de Supabase al crear o cambiar una clave. */
export function mensajeErrorClave(err: { message?: string; code?: string } | null): string {
  const texto = `${err?.code ?? ''} ${err?.message ?? ''}`
  if (/reauthentication/i.test(texto))
    return 'Por seguridad, vuelve a ingresar con tu contraseña actual y cámbiala de nuevo.'
  if (/same_password|different from the old/i.test(texto))
    return 'La nueva contraseña debe ser distinta de la actual.'
  if (/weak_password|at least|characters/i.test(texto))
    return `La contraseña debe tener al menos ${MIN_CLAVE} caracteres.`
  return err?.message || 'No se pudo cambiar la contraseña.'
}
