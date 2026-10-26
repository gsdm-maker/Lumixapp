// Mensajes de error de Supabase Auth en espanol.
//
// Supabase responde en ingles ("Invalid login credentials", "User is banned"...) y antes ese texto
// llegaba tal cual a la pantalla. Aca se traduce en un solo lugar; lo que no se reconoce cae a un
// mensaje generico en vez de mostrar el ingles.

/** Tiempo maximo de espera al ingresar o crear cuenta. Sin esto, con el servidor caido el boton
 *  quedaba en "Ingresando…" sin avisar nada. */
export const ESPERA_AUTH_MS = 15_000

export const MENSAJE_SIN_CONEXION =
  'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo en unos minutos.'

const TRADUCCIONES: [RegExp, string][] = [
  [/invalid login credentials/i, 'Email o contraseña incorrectos.'],
  [/banned/i, 'Tu cuenta está desactivada. Habla con el administrador.'],
  [/email not confirmed|confirm/i, 'Confirma tu email primero: revisa el correo que te enviamos.'],
  [/registered|already/i, 'Ya existe una cuenta con ese email. Ingresa con tu contraseña.'],
  [/captcha/i, 'No se pudo validar la verificación de seguridad. Vuelve a intentarlo.'],
  [
    /rate limit|too many/i,
    'Demasiados intentos seguidos. Espera unos minutos y vuelve a intentar.',
  ],
  [/password should be|weak password/i, 'La contraseña es muy débil. Usa una más larga y variada.'],
  [/invalid email|unable to validate email/i, 'El email no es válido.'],
  [/failed to fetch|network|fetch|timeout|tiempo/i, MENSAJE_SIN_CONEXION],
]

export function mensajeAuth(original: string): string {
  for (const [patron, mensaje] of TRADUCCIONES) if (patron.test(original)) return mensaje
  return 'No pudimos completar la operación. Inténtalo de nuevo.'
}

/** Corta la espera si el servidor no responde a tiempo (el error cae en MENSAJE_SIN_CONEXION). */
export function conTope<T>(promesa: Promise<T>, ms = ESPERA_AUTH_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms)
    promesa.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}
