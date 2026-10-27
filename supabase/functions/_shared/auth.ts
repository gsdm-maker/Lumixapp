// Verificacion de usuario para las Edge Functions de IA.
//
// POR QUE EXISTE ESTE ARCHIVO
// La anon key viaja dentro del bundle que sirve Netlify: es publica por diseno.
// Sin esta verificacion, cualquiera que la copie del inspector puede invocar las
// funciones de IA y gastar la OPENAI_API_KEY del proyecto. RLS protege los datos,
// pero no protege el gasto: una Edge Function es computo, no una tabla.
//
// Se usa el mismo patron que ya usaba admin-users (validar el token contra
// /auth/v1/user), para no introducir dependencias nuevas.

const PROJECT_URL = Deno.env.get('PROJECT_URL') || Deno.env.get('SUPABASE_URL') || ''
const SERVICE_KEY =
  Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

export interface AuthedUser {
  id: string
  email?: string
}

// Devuelve el usuario autenticado, o null si el llamado no trae una sesion valida.
// La anon key sola NO alcanza: tiene que ser el token de alguien con sesion iniciada.
export async function getUser(req: Request): Promise<AuthedUser | null> {
  if (!PROJECT_URL || !SERVICE_KEY) {
    // Sin configuracion no se puede verificar. Se falla cerrado a proposito:
    // preferimos cortar el servicio antes que dejar la puerta abierta.
    console.error('auth: falta PROJECT_URL o SERVICE_ROLE_KEY')
    return null
  }

  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  try {
    const res = await fetch(`${PROJECT_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SERVICE_KEY },
    })
    if (!res.ok) return null

    const user = await res.json()
    if (!user?.id) return null

    return { id: user.id, email: user.email }
  } catch (err) {
    console.error('auth: fallo la verificacion del token', err)
    return null
  }
}

/**
 * Tope diario de llamadas a la IA por persona (H9, migracion 060). El limite en memoria de
 * ./rate-limit.ts es por instancia y no sirve como tope de gasto; este contador vive en la base
 * (tabla uso_ia, via la funcion registrar_uso_ia, que solo puede ejecutar service_role). Devuelve
 * false cuando la persona ya paso su tope. Ante un error de lectura no se bloquea: un fallo
 * nuestro no debe cortarle el servicio a nadie.
 */
export async function dentroDelTopeIa(userId: string): Promise<boolean> {
  try {
    const res = await fetch(`${PROJECT_URL}/rest/v1/rpc/registrar_uso_ia`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_user: userId }),
    })
    if (!res.ok) return true
    return (await res.json()) === true
  } catch (err) {
    console.error('auth: no se pudo revisar el tope diario de IA', err)
    return true
  }
}

// Dias de uso despues de vencido el pago (migracion 063). Mismo valor en src/core/auth/plan.ts.
const DIAS_GRACIA = 7

/** Fecha de hoy en Chile (YYYY-MM-DD): los vencimientos de pago se cuentan por dia chileno. */
function hoyChile(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })
}

/** Suma dias a una fecha YYYY-MM-DD. */
function masDias(ymd: string, dias: number): string {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

// Plan vencido: la IA deja de responder para no gastar la clave de OpenAI. Se corta con la prueba
// de 15 dias terminada (056) o con el pago vencido mas los dias de gracia (063). Devuelve el
// mensaje para mostrar, o null si la persona puede usar la IA. El Owner y las empresas 'gratis'
// nunca se bloquean. Ante un error de lectura no se bloquea (un fallo nuestro no debe cortarle
// el servicio a nadie).
export async function bloqueoPorPlan(userId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${PROJECT_URL}/rest/v1/profiles?id=eq.${userId}&select=es_owner,empresa:empresas(plan,prueba_hasta,pagado_hasta)`,
      { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } },
    )
    if (!res.ok) return null
    const fila = (await res.json())?.[0]
    if (!fila || fila.es_owner) return null
    const e = fila.empresa as {
      plan: string
      prueba_hasta: string
      pagado_hasta: string | null
    } | null
    if (!e) return null
    if (e.plan === 'pago') {
      // Pagada: vale hasta pagado_hasta mas los dias de gracia. Sin fecha = vencida.
      if (e.pagado_hasta && hoyChile() <= masDias(e.pagado_hasta, DIAS_GRACIA)) return null
      return 'Tu suscripción venció. Contáctanos para renovarla.'
    }
    if (e.plan !== 'prueba') return null
    if (Date.parse(e.prueba_hasta) >= Date.now()) return null
    return 'Tu período de prueba terminó. Contáctanos para activar tu suscripción.'
  } catch (err) {
    console.error('auth: no se pudo revisar el plan', err)
    return null
  }
}
