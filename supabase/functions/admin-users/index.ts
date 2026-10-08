// Consola de administracion: todo lo que hace el admin global pasa por aca.
//
// SEGURIDAD (por que esta escrita asi)
// - Usa la service role, que salta RLS. Por eso la autorizacion es lo primero: sesion valida
//   (getUser) y rol 'admin' leido de la base con la service role (no del token ni del cliente).
// - Nada de lo que llega se usa sin validar: acciones de una lista cerrada, ids con formato
//   UUID, roles de una lista cerrada (nunca 'admin': el admin global no se crea desde la app),
//   email y nombres con largo acotado. Los ids validados son lo unico que entra a los filtros.
// - El admin no puede actuar sobre su propia cuenta ni sobre otro admin (no puede dejarse sin
//   acceso por error ni tocar a un par).
// - Claves temporales con azar criptografico; se devuelven una sola vez y nunca se registran.
// - Crear una persona son varios pasos: si uno falla, se borra la cuenta recien creada para no
//   dejar usuarios a medias.
// - Los errores internos se registran en el log de la funcion; a la app llega un mensaje
//   generico (sin detalles de la base).
// - Cada accion queda en admin_auditoria (migracion 050), tabla que la app no puede leer ni
//   modificar directamente.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { buildCors } from '../_shared/cors.ts'
import { getUser } from '../_shared/auth.ts'
import { checkRateLimit } from '../_shared/rate-limit.ts'

const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') || ''
const PROJECT_URL = Deno.env.get('PROJECT_URL') || ''

const ROLES_EQUIPO = ['jefatura', 'colaborador', 'invitado']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// "Para siempre" en la API de Auth (100 anos): desactivar no borra nada y se puede revertir.
const BLOQUEO = '876000h'

/** Error con un mensaje que SI se puede mostrar en la app. */
class Falla extends Error {}

// ---------------------------------------------------------------------------------------------
// Validacion de la entrada

function uuid(v: unknown, campo: string): string {
  if (typeof v !== 'string' || !UUID.test(v)) throw new Falla(`${campo} no válido`)
  return v.toLowerCase()
}

function rolEquipo(v: unknown): string {
  if (typeof v !== 'string' || !ROLES_EQUIPO.includes(v)) throw new Falla('Rol no válido')
  return v
}

function texto(v: unknown, campo: string, min: number, max: number): string {
  // Sin caracteres de control; espacios repetidos a uno.
  const limpio =
    typeof v === 'string'
      ? [...v]
          .filter((c) => c.charCodeAt(0) > 31 && c.charCodeAt(0) !== 127)
          .join('')
          .replace(/\s+/g, ' ')
          .trim()
      : ''
  if (limpio.length < min || limpio.length > max)
    throw new Falla(`${campo}: entre ${min} y ${max} caracteres`)
  return limpio
}

function email(v: unknown): string {
  const e = typeof v === 'string' ? v.trim().toLowerCase() : ''
  if (e.length > 254 || !EMAIL.test(e)) throw new Falla('Email no válido')
  return e
}

// ---------------------------------------------------------------------------------------------
// Clave temporal: 4 grupos de 4 (ej. "Kq7m-Tz4p-Hb9w-Rn3x"), sin letras que se confunden
// (0/O, 1/l/I), con mayuscula, minuscula y numero. ~85 bits de azar criptografico.

const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

function claveTemporal(): string {
  for (;;) {
    const chars: string[] = []
    const buf = new Uint8Array(32)
    while (chars.length < 16) {
      crypto.getRandomValues(buf)
      for (const b of buf) {
        // Rechazo de muestras: sin sesgo hacia los primeros caracteres del alfabeto.
        if (b < 256 - (256 % ALFABETO.length) && chars.length < 16)
          chars.push(ALFABETO[b % ALFABETO.length])
      }
    }
    const clave = [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join('')).join('-')
    if (/[A-Z]/.test(clave) && /[a-z]/.test(clave) && /[0-9]/.test(clave)) return clave
  }
}

// ---------------------------------------------------------------------------------------------
// Acceso a la base y a Auth con la service role

const CABECERAS = {
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  apikey: SERVICE_ROLE_KEY,
  'Content-Type': 'application/json',
}

async function llamar(url: string, init: RequestInit = {}): Promise<Response> {
  return await fetch(url, { ...init, headers: { ...CABECERAS, ...(init.headers || {}) } })
}

async function leerJson(res: Response): Promise<unknown> {
  const t = await res.text()
  if (!t) return null
  try {
    return JSON.parse(t)
  } catch {
    return t
  }
}

/** PostgREST. Si falla, se registra el detalle y se corta con un mensaje generico. */
async function rest<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await llamar(`${PROJECT_URL}/rest/v1/${path}`, init)
  const cuerpo = await leerJson(res)
  if (!res.ok) {
    console.error('rest', init.method || 'GET', path.split('?')[0], res.status, cuerpo)
    throw new Falla('No se pudo completar el cambio en la base')
  }
  return cuerpo as T
}

const SIN_RESPUESTA = { Prefer: 'return=minimal' }

async function auth(path: string, init: RequestInit = {}) {
  const res = await llamar(`${PROJECT_URL}/auth/v1/${path}`, init)
  return { res, cuerpo: (await leerJson(res)) as Record<string, unknown> | null }
}

type Perfil = { id: string; email: string; full_name: string; role: string; team_id: string | null }

async function perfil(id: string): Promise<Perfil | null> {
  const filas = await rest<Perfil[]>(`profiles?id=eq.${id}&select=id,email,full_name,role,team_id`)
  return filas?.[0] ?? null
}

async function equipoExiste(id: string): Promise<{ id: string; name: string }> {
  const filas = await rest<{ id: string; name: string }[]>(`teams?id=eq.${id}&select=id,name`)
  if (!filas?.[0]) throw new Falla('Equipo no encontrado')
  return filas[0]
}

/** Persona sobre la que se actua: existe, no es quien llama y no es otro admin. */
async function objetivo(id: string, actor: string): Promise<Perfil> {
  if (id === actor) throw new Falla('No puedes hacer esto sobre tu propia cuenta')
  const p = await perfil(id)
  if (!p) throw new Falla('Persona no encontrada')
  if (p.role === 'admin') throw new Falla('Un administrador no se modifica desde la consola')
  return p
}

async function auditar(
  actor: string,
  accion: string,
  objetivoId: string | null,
  detalle: Record<string, unknown> = {},
) {
  // El registro nunca hace fallar la accion (ya se hizo); si no se pudo escribir, queda en el log.
  try {
    await rest('admin_auditoria', {
      method: 'POST',
      headers: SIN_RESPUESTA,
      body: JSON.stringify({ actor_id: actor, accion, objetivo_id: objetivoId, detalle }),
    })
  } catch {
    console.error('auditoria: no se pudo registrar', accion)
  }
}

// ---------------------------------------------------------------------------------------------
// Acciones

type Cuerpo = Record<string, unknown>
type Accion = (b: Cuerpo, actor: string) => Promise<Record<string, unknown>>

async function usuariosAuth() {
  const todos: Record<string, unknown>[] = []
  for (let page = 1; page <= 50; page++) {
    const { res, cuerpo } = await auth(`admin/users?page=${page}&per_page=200`)
    if (!res.ok) {
      console.error('auth admin/users', res.status, cuerpo)
      throw new Falla('No se pudo leer la lista de cuentas')
    }
    const lote = ((cuerpo?.users as Record<string, unknown>[]) || []) as Record<string, unknown>[]
    todos.push(...lote)
    if (lote.length < 200) break
  }
  return todos
}

const ACCIONES: Record<string, Accion> = {
  async 'listar-personas'() {
    const [cuentas, perfiles, miembros, equipos] = await Promise.all([
      usuariosAuth(),
      rest<Perfil[]>('profiles?select=id,email,full_name,role,team_id'),
      rest<{ team_id: string; user_id: string; role: string }[]>(
        'team_members?select=team_id,user_id,role',
      ),
      rest<{ id: string; name: string }[]>('teams?select=id,name'),
    ])
    const nombreEquipo = new Map(equipos.map((e) => [e.id, e.name]))
    const cuenta = new Map(cuentas.map((c) => [c.id as string, c]))
    const ahora = Date.now()
    const personas = perfiles.map((p) => {
      const c = cuenta.get(p.id)
      const bloqueo = c?.banned_until ? Date.parse(c.banned_until as string) : 0
      const meta = (c?.user_metadata || {}) as Record<string, unknown>
      return {
        id: p.id,
        email: p.email,
        nombre: p.full_name,
        esAdmin: p.role === 'admin',
        rolGlobal: p.role,
        equipoActivo: p.team_id,
        equipos: miembros
          .filter((m) => m.user_id === p.id)
          .map((m) => ({ id: m.team_id, nombre: nombreEquipo.get(m.team_id) ?? '—', rol: m.role })),
        activa: !(bloqueo > ahora),
        ultimoIngreso: (c?.last_sign_in_at as string) ?? null,
        creada: (c?.created_at as string) ?? null,
        debeCambiarClave:
          meta.must_change_password === true || meta.must_change_password === 'true',
      }
    })
    return { personas }
  },

  async 'listar-equipos'() {
    const [equipos, miembros, perfiles] = await Promise.all([
      rest<{ id: string; name: string; created_at: string }[]>(
        'teams?select=id,name,created_at&order=name',
      ),
      rest<{ team_id: string; user_id: string; role: string }[]>(
        'team_members?select=team_id,user_id,role',
      ),
      rest<{ id: string; full_name: string; role: string }[]>('profiles?select=id,full_name,role'),
    ])
    const p = new Map(perfiles.map((x) => [x.id, x]))
    return {
      equipos: equipos.map((e) => {
        // El admin global figura como miembro de los equipos que creo: no se cuenta.
        const del = miembros.filter((m) => m.team_id === e.id && p.get(m.user_id)?.role !== 'admin')
        return {
          id: e.id,
          nombre: e.name,
          creado: e.created_at,
          miembros: del.length,
          jefaturas: del
            .filter((m) => m.role === 'jefatura')
            .map((m) => p.get(m.user_id)?.full_name ?? '—'),
        }
      }),
    }
  },

  async 'listar-auditoria'() {
    const filas = await rest<
      {
        id: string
        actor_id: string
        accion: string
        objetivo_id: string | null
        detalle: unknown
        created_at: string
      }[]
    >('admin_auditoria?select=*&order=created_at.desc&limit=200').catch(() => {
      throw new Falla('El registro de actividad aún no está disponible')
    })
    const ids = [...new Set(filas.flatMap((f) => [f.actor_id, f.objetivo_id]).filter(Boolean))]
    const nombres = ids.length
      ? await rest<{ id: string; full_name: string }[]>(
          `profiles?id=in.(${ids.join(',')})&select=id,full_name`,
        )
      : []
    const n = new Map(nombres.map((x) => [x.id, x.full_name]))
    return {
      registros: filas.map((f) => ({
        id: f.id,
        accion: f.accion,
        actor: n.get(f.actor_id) ?? '—',
        objetivo: f.objetivo_id ? (n.get(f.objetivo_id) ?? null) : null,
        detalle: f.detalle,
        fecha: f.created_at,
      })),
    }
  },

  async 'crear-persona'(b, actor) {
    const correo = email(b.email)
    const nombre = texto(b.nombre, 'Nombre', 3, 80)
    const rol = rolEquipo(b.rol)
    const equipo = b.equipoId ? await equipoExiste(uuid(b.equipoId, 'Equipo')) : null
    const clave = claveTemporal()

    const { res, cuerpo } = await auth('admin/users', {
      method: 'POST',
      body: JSON.stringify({
        email: correo,
        password: clave,
        email_confirm: true,
        user_metadata: { full_name: nombre, must_change_password: true },
      }),
    })
    if (!res.ok) {
      console.error('auth crear', res.status, cuerpo)
      const yaExiste =
        res.status === 422 || /already|registered|exists/i.test(JSON.stringify(cuerpo))
      throw new Falla(
        yaExiste ? 'Ya existe una cuenta con ese email' : 'No se pudo crear la cuenta',
      )
    }
    const id = uuid(cuerpo?.id, 'Cuenta')

    try {
      await rest(`profiles?id=eq.${id}`, {
        method: 'PATCH',
        headers: SIN_RESPUESTA,
        body: JSON.stringify({
          role: rol,
          full_name: nombre,
          ...(equipo ? { team_id: equipo.id } : {}),
        }),
      })
      if (equipo) {
        await rest('team_members', {
          method: 'POST',
          headers: SIN_RESPUESTA,
          body: JSON.stringify({ team_id: equipo.id, user_id: id, role: rol }),
        })
      }
    } catch (err) {
      // Deshacer: sin rol ni equipo la cuenta quedaria a medias.
      const borrar = await auth(`admin/users/${id}`, { method: 'DELETE' })
      if (!borrar.res.ok) console.error('crear: no se pudo deshacer la cuenta', id, borrar.cuerpo)
      throw err
    }

    await auditar(actor, 'crear-persona', id, { email: correo, rol, equipo: equipo?.name ?? null })
    return { id, clave }
  },

  async 'clave-temporal'(b, actor) {
    const p = await objetivo(uuid(b.userId, 'Persona'), actor)
    const clave = claveTemporal()
    // user_metadata se mezcla con lo que ya tiene (no lo reemplaza).
    const { res, cuerpo } = await auth(`admin/users/${p.id}`, {
      method: 'PUT',
      body: JSON.stringify({ password: clave, user_metadata: { must_change_password: true } }),
    })
    if (!res.ok) {
      console.error('auth clave', res.status, cuerpo)
      throw new Falla('No se pudo cambiar la clave')
    }
    await auditar(actor, 'clave-temporal', p.id)
    return { clave }
  },

  async desactivar(b, actor) {
    const p = await objetivo(uuid(b.userId, 'Persona'), actor)
    const { res, cuerpo } = await auth(`admin/users/${p.id}`, {
      method: 'PUT',
      body: JSON.stringify({ ban_duration: BLOQUEO }),
    })
    if (!res.ok) {
      console.error('auth desactivar', res.status, cuerpo)
      throw new Falla('No se pudo desactivar la cuenta')
    }
    await auditar(actor, 'desactivar', p.id)
    return {}
  },

  async reactivar(b, actor) {
    const p = await objetivo(uuid(b.userId, 'Persona'), actor)
    const { res, cuerpo } = await auth(`admin/users/${p.id}`, {
      method: 'PUT',
      body: JSON.stringify({ ban_duration: 'none' }),
    })
    if (!res.ok) {
      console.error('auth reactivar', res.status, cuerpo)
      throw new Falla('No se pudo reactivar la cuenta')
    }
    await auditar(actor, 'reactivar', p.id)
    return {}
  },

  async 'cambiar-rol'(b, actor) {
    const p = await objetivo(uuid(b.userId, 'Persona'), actor)
    const equipo = await equipoExiste(uuid(b.equipoId, 'Equipo'))
    const rol = rolEquipo(b.rol)
    const filas = await rest<unknown[]>(`team_members?team_id=eq.${equipo.id}&user_id=eq.${p.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ role: rol }),
    })
    if (!filas?.length) throw new Falla('La persona no está en ese equipo')
    await auditar(actor, 'cambiar-rol', p.id, { equipo: equipo.name, rol })
    return {}
  },

  async 'sumar-a-equipo'(b, actor) {
    const p = await objetivo(uuid(b.userId, 'Persona'), actor)
    const equipo = await equipoExiste(uuid(b.equipoId, 'Equipo'))
    const rol = rolEquipo(b.rol)
    const ya = await rest<unknown[]>(
      `team_members?team_id=eq.${equipo.id}&user_id=eq.${p.id}&select=id`,
    )
    if (ya?.length) throw new Falla('Ya está en ese equipo')
    await rest('team_members', {
      method: 'POST',
      headers: SIN_RESPUESTA,
      body: JSON.stringify({ team_id: equipo.id, user_id: p.id, role: rol }),
    })
    // Sin equipo activo, este pasa a ser el suyo (si no, entraria a una app vacia).
    if (!p.team_id) {
      await rest(`profiles?id=eq.${p.id}`, {
        method: 'PATCH',
        headers: SIN_RESPUESTA,
        body: JSON.stringify({ team_id: equipo.id }),
      })
    }
    await auditar(actor, 'sumar-a-equipo', p.id, { equipo: equipo.name, rol })
    return {}
  },

  async 'quitar-de-equipo'(b, actor) {
    const p = await objetivo(uuid(b.userId, 'Persona'), actor)
    const equipo = await equipoExiste(uuid(b.equipoId, 'Equipo'))
    const filas = await rest<unknown[]>(`team_members?team_id=eq.${equipo.id}&user_id=eq.${p.id}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=representation' },
    })
    if (!filas?.length) throw new Falla('La persona no está en ese equipo')
    // Si era su equipo activo, pasa a otro de los suyos (o a ninguno).
    if (p.team_id === equipo.id) {
      const otros = await rest<{ team_id: string }[]>(
        `team_members?user_id=eq.${p.id}&select=team_id&limit=1`,
      )
      await rest(`profiles?id=eq.${p.id}`, {
        method: 'PATCH',
        headers: SIN_RESPUESTA,
        body: JSON.stringify({ team_id: otros?.[0]?.team_id ?? null }),
      })
    }
    await auditar(actor, 'quitar-de-equipo', p.id, { equipo: equipo.name })
    return {}
  },

  async 'crear-equipo'(b, actor) {
    const nombre = texto(b.nombre, 'Nombre del equipo', 2, 60)
    const filas = await rest<{ id: string }[]>('teams?select=id', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ name: nombre, description: '', created_by: actor }),
    })
    const id = filas?.[0]?.id
    if (!id) throw new Falla('No se pudo crear el equipo')
    // Igual que al crearlo desde Equipos: el admin queda como miembro para poder entrar a verlo.
    await rest('team_members', {
      method: 'POST',
      headers: SIN_RESPUESTA,
      body: JSON.stringify({ team_id: id, user_id: actor, role: 'admin' }),
    })
    await auditar(actor, 'crear-equipo', null, { equipo: nombre })
    return { id }
  },

  async 'renombrar-equipo'(b, actor) {
    const equipo = await equipoExiste(uuid(b.equipoId, 'Equipo'))
    const nombre = texto(b.nombre, 'Nombre del equipo', 2, 60)
    await rest(`teams?id=eq.${equipo.id}`, {
      method: 'PATCH',
      headers: SIN_RESPUESTA,
      body: JSON.stringify({ name: nombre }),
    })
    await auditar(actor, 'renombrar-equipo', null, { antes: equipo.name, despues: nombre })
    return {}
  },
}

// ---------------------------------------------------------------------------------------------

serve(async (req: Request) => {
  const cors = buildCors(req)
  // Siempre 200 con { success, error }: asi la app puede mostrar el motivo (supabase-js oculta
  // el cuerpo de las respuestas que no son 2xx).
  const responder = (body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  const fallar = (error: string) => responder({ success: false, error })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return fallar('Método no permitido')

  if (!SERVICE_ROLE_KEY || !PROJECT_URL) {
    console.error('admin-users: falta SERVICE_ROLE_KEY o PROJECT_URL')
    return fallar('Función sin configurar')
  }

  try {
    // 1) Sesion valida. 2) Rol admin leido de la base, nunca de lo que manda el cliente.
    const user = await getUser(req)
    if (!user) return fallar('No autenticado')
    const yo = await perfil(uuid(user.id, 'Sesión'))
    if (yo?.role !== 'admin') {
      console.warn('admin-users: intento sin rol admin', user.id)
      return fallar('No autorizado')
    }
    if (!checkRateLimit(`admin:${user.id}`, 60))
      return fallar('Demasiadas acciones seguidas; espera un minuto')

    let body: Cuerpo
    try {
      const b = await req.json()
      if (!b || typeof b !== 'object' || Array.isArray(b)) throw new Error()
      body = b as Cuerpo
    } catch {
      return fallar('Petición no válida')
    }

    const accion = typeof body.action === 'string' ? ACCIONES[body.action] : undefined
    if (!accion || !Object.hasOwn(ACCIONES, body.action as string))
      return fallar('Acción desconocida')

    return responder({ success: true, ...(await accion(body, user.id)) })
  } catch (err) {
    if (err instanceof Falla) return fallar(err.message)
    console.error('admin-users: error interno', err)
    return fallar('Error interno; revisa el registro de la función')
  }
})
