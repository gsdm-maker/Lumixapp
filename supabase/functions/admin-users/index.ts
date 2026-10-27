// Consola de administracion: todo lo que hace el Admin de una empresa (o el Owner de la
// plataforma) pasa por aca.
//
// SEGURIDAD (por que esta escrita asi)
// - Usa la service role, que salta RLS. Por eso la autorizacion es lo primero: sesion valida
//   (getUser) y rol 'admin' o marca es_owner leidos de la base con la service role (no del
//   token ni del cliente).
// - MULTI-EMPRESA (051): como la service role salta la RLS, el aislamiento entre empresas se
//   hace aca. Un Admin solo lee y toca personas, unidades y auditoria de SU empresa (filtro
//   empresa_id en cada consulta y chequeo en cada objetivo). Solo el Owner ve todas.
// - Nada de lo que llega se usa sin validar: acciones de una lista cerrada, ids con formato
//   UUID, roles de una lista cerrada (nunca 'admin': el Admin no se crea desde la app),
//   email y nombres con largo acotado. Los ids validados son lo unico que entra a los filtros.
// - El Admin no puede actuar sobre su propia cuenta ni sobre otro Admin (no puede dejarse sin
//   acceso por error ni tocar a un par). El Owner si puede actuar sobre un Admin, nunca sobre
//   otro Owner.
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

const ROLES_EQUIPO = ['lider', 'integrante', 'invitado']
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

type Perfil = {
  id: string
  email: string
  full_name: string
  role: string
  team_id: string | null
  empresa_id: string | null
  es_owner: boolean
}

const CAMPOS_PERFIL = 'id,email,full_name,role,team_id,empresa_id,es_owner'

async function perfil(id: string): Promise<Perfil | null> {
  const filas = await rest<Perfil[]>(`profiles?id=eq.${id}&select=${CAMPOS_PERFIL}`)
  return filas?.[0] ?? null
}

/** Quien llama: su id, su empresa y si es Owner. Sale de la base, nunca del cliente. */
type Ctx = {
  id: string
  /** Empresa en la que se trabaja: la propia, o la que el Owner eligio (empresaId). */
  empresa: string | null
  /** Empresa propia de quien llama (a la que pertenece su cuenta). */
  miEmpresa: string | null
  owner: boolean
  /** El Owner eligio una empresa: los listados se acotan a ella como para un Admin. */
  enfocada: boolean
}

/** Filtro PostgREST por empresa: el Owner ve todas; un Admin solo la suya. */
function deMiEmpresa(ctx: Ctx, campo = 'empresa_id'): string {
  return ctx.owner && !ctx.enfocada ? '' : `&${campo}=eq.${ctx.empresa}`
}

/** Acciones que solo puede hacer el Owner de la plataforma. */
function soloOwner(ctx: Ctx) {
  if (!ctx.owner) throw new Falla('Solo el Owner puede hacer esto')
}

const METODOS_PAGO = ['transferencia', 'efectivo', 'tarjeta', 'otro']

const MODULOS = [
  'actividades',
  'proyectos',
  'minuta',
  'compromisos',
  'errores',
  'ingestas',
  'planificacion',
  'dashboard',
]

/** Modulos encendidos: solo de la lista cerrada, sin repetir. */
function modulos(v: unknown): string[] {
  if (!Array.isArray(v) || v.some((m) => typeof m !== 'string' || !MODULOS.includes(m)))
    throw new Falla('Módulo no válido')
  return MODULOS.filter((m) => v.includes(m))
}

/** Lista de niveles de una empresa: de 1 a 8, cada uno de 2 a 40 caracteres, sin repetir. */
function niveles(v: unknown): string[] {
  if (!Array.isArray(v) || v.length < 1 || v.length > 8)
    throw new Falla('Define entre 1 y 8 niveles')
  const lista = v.map((n, i) => texto(n, `Nivel ${i + 1}`, 2, 40))
  if (new Set(lista.map((n) => n.toLowerCase())).size !== lista.length)
    throw new Falla('Hay niveles repetidos')
  return lista
}

type Empresa = {
  id: string
  nombre: string
  niveles: string[]
  es_personal: boolean
  modulos: string[]
  plan: string
  prueba_hasta: string
  pagado_hasta: string | null
}

const CAMPOS_EMPRESA = 'id,nombre,niveles,es_personal,modulos,plan,prueba_hasta,pagado_hasta'

async function empresaExiste(id: string, ctx: Ctx): Promise<Empresa> {
  const filas = await rest<Empresa[]>(`empresas?id=eq.${id}&select=${CAMPOS_EMPRESA}`)
  const e = filas?.[0]
  if (!e || (!ctx.owner && e.id !== ctx.empresa)) throw new Falla('Empresa no encontrada')
  return e
}

type Unidad = { id: string; name: string; empresa_id: string; parent_id: string | null }

async function equipoExiste(id: string, ctx: Ctx): Promise<Unidad> {
  const filas = await rest<Unidad[]>(`teams?id=eq.${id}&select=id,name,empresa_id,parent_id`)
  const u = filas?.[0]
  // De otra empresa = no existe (no se filtra que exista).
  if (!u || (!ctx.owner && u.empresa_id !== ctx.empresa)) throw new Falla('Equipo no encontrado')
  return u
}

/**
 * Deja a la persona en la unidad con ese rol (la suma o le cambia el rol). Si es Lider:
 *  - el Lider anterior pasa a Integrante (un solo Lider por unidad, migracion 054), y
 *  - con sumarArriba, la persona entra tambien como Integrante de la unidad de arriba: la
 *    jefatura es parte del equipo de su jefe ("linking pin"). Si ya estaba ahi, no se toca su
 *    rol. Devuelve el nombre de esa unidad solo si se la sumo ahora (si no, null).
 */
async function ponerEnUnidad(
  equipo: Unidad,
  personaId: string,
  rol: string,
  sumarArriba: boolean,
): Promise<string | null> {
  if (rol === 'lider') {
    await rest(`team_members?team_id=eq.${equipo.id}&role=eq.lider&user_id=neq.${personaId}`, {
      method: 'PATCH',
      headers: SIN_RESPUESTA,
      body: JSON.stringify({ role: 'integrante' }),
    })
  }
  const ya = await rest<unknown[]>(
    `team_members?team_id=eq.${equipo.id}&user_id=eq.${personaId}&select=id`,
  )
  if (ya?.length) {
    await rest(`team_members?team_id=eq.${equipo.id}&user_id=eq.${personaId}`, {
      method: 'PATCH',
      headers: SIN_RESPUESTA,
      body: JSON.stringify({ role: rol }),
    })
  } else {
    await rest('team_members', {
      method: 'POST',
      headers: SIN_RESPUESTA,
      body: JSON.stringify({ team_id: equipo.id, user_id: personaId, role: rol }),
    })
  }

  if (rol !== 'lider' || !sumarArriba || !equipo.parent_id) return null
  const yaArriba = await rest<unknown[]>(
    `team_members?team_id=eq.${equipo.parent_id}&user_id=eq.${personaId}&select=id`,
  )
  // Ya estaba arriba (con el rol que sea): no se toca ni se avisa.
  if (yaArriba?.length) return null
  await rest('team_members', {
    method: 'POST',
    headers: SIN_RESPUESTA,
    body: JSON.stringify({ team_id: equipo.parent_id, user_id: personaId, role: 'integrante' }),
  })
  const arriba = await rest<{ name: string }[]>(`teams?id=eq.${equipo.parent_id}&select=name`)
  return arriba?.[0]?.name ?? null
}

/** Persona sobre la que se actua: existe, es de la empresa, no es quien llama ni un par. */
async function objetivo(id: string, ctx: Ctx): Promise<Perfil> {
  if (id === ctx.id) throw new Falla('No puedes hacer esto sobre tu propia cuenta')
  const p = await perfil(id)
  if (!p || (!ctx.owner && p.empresa_id !== ctx.empresa)) throw new Falla('Persona no encontrada')
  if (p.es_owner) throw new Falla('Un Owner no se modifica desde la consola')
  if (p.role === 'admin' && !ctx.owner) throw new Falla('Un Admin no se modifica desde la consola')
  return p
}

async function auditar(
  ctx: Ctx,
  accion: string,
  objetivoId: string | null,
  detalle: Record<string, unknown> = {},
) {
  // El registro nunca hace fallar la accion (ya se hizo); si no se pudo escribir, queda en el log.
  try {
    await rest('admin_auditoria', {
      method: 'POST',
      headers: SIN_RESPUESTA,
      body: JSON.stringify({
        actor_id: ctx.id,
        accion,
        objetivo_id: objetivoId,
        detalle,
        empresa_id: ctx.empresa,
      }),
    })
  } catch {
    console.error('auditoria: no se pudo registrar', accion)
  }
}

// ---------------------------------------------------------------------------------------------
// Acciones

type Cuerpo = Record<string, unknown>
type Accion = (b: Cuerpo, ctx: Ctx) => Promise<Record<string, unknown>>

type Miembro = { team_id: string; user_id: string; role: string }

/** Membresias de un conjunto de unidades (las de la empresa, o todas para el Owner). */
async function miembrosDe(ctx: Ctx, unidades: { id: string }[]): Promise<Miembro[]> {
  if (ctx.owner) return await rest<Miembro[]>('team_members?select=team_id,user_id,role')
  if (!unidades.length) return []
  return await rest<Miembro[]>(
    `team_members?select=team_id,user_id,role&team_id=in.(${unidades.map((u) => u.id).join(',')})`,
  )
}

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
  async 'listar-personas'(_b, ctx) {
    const [cuentas, perfiles, equipos] = await Promise.all([
      usuariosAuth(),
      rest<Perfil[]>(`profiles?select=${CAMPOS_PERFIL}${deMiEmpresa(ctx)}`),
      rest<{ id: string; name: string }[]>(`teams?select=id,name${deMiEmpresa(ctx)}`),
    ])
    const miembros = await miembrosDe(ctx, equipos)
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
        esOwner: p.es_owner === true,
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

  async 'listar-equipos'(_b, ctx) {
    const [equipos, perfiles] = await Promise.all([
      rest<
        {
          id: string
          name: string
          created_at: string
          parent_id: string | null
          nivel: string | null
          modulos: string[] | null
        }[]
      >(`teams?select=id,name,created_at,parent_id,nivel,modulos${deMiEmpresa(ctx)}&order=name`),
      rest<{ id: string; full_name: string; role: string }[]>(
        `profiles?select=id,full_name,role${deMiEmpresa(ctx)}`,
      ),
    ])
    const miembros = await miembrosDe(ctx, equipos)
    const p = new Map(perfiles.map((x) => [x.id, x]))
    return {
      equipos: equipos.map((e) => {
        // El Admin figura como miembro de las unidades que creo: no se cuenta.
        const del = miembros.filter((m) => m.team_id === e.id && p.get(m.user_id)?.role !== 'admin')
        return {
          id: e.id,
          nombre: e.name,
          creado: e.created_at,
          superior: e.parent_id,
          nivel: e.nivel,
          modulos: e.modulos,
          miembros: del.length,
          lideres: del
            .filter((m) => m.role === 'lider')
            .map((m) => p.get(m.user_id)?.full_name ?? '—'),
          personas: del
            .map((m) => ({
              id: m.user_id,
              nombre: p.get(m.user_id)?.full_name ?? '—',
              rol: m.role,
            }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre)),
        }
      }),
    }
  },

  async 'listar-auditoria'(_b, ctx) {
    const filas = await rest<
      {
        id: string
        actor_id: string
        accion: string
        objetivo_id: string | null
        detalle: unknown
        created_at: string
      }[]
    >(`admin_auditoria?select=*${deMiEmpresa(ctx)}&order=created_at.desc&limit=200`).catch(() => {
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

  async 'crear-persona'(b, ctx) {
    const correo = email(b.email)
    const nombre = texto(b.nombre, 'Nombre', 3, 80)
    const rol = rolEquipo(b.rol)
    const equipo = b.equipoId ? await equipoExiste(uuid(b.equipoId, 'Equipo'), ctx) : null
    // La persona nueva queda en la empresa de su unidad; sin unidad, en la de quien la crea.
    const empresa = equipo?.empresa_id ?? ctx.empresa
    if (!empresa) throw new Falla('Elige una unidad para la persona')
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
    let arriba: string | null = null

    try {
      await rest(`profiles?id=eq.${id}`, {
        method: 'PATCH',
        headers: SIN_RESPUESTA,
        // El rol elegido es el de la unidad; en la empresa la persona es Integrante.
        body: JSON.stringify({
          role: 'integrante',
          full_name: nombre,
          empresa_id: empresa,
          ...(equipo ? { team_id: equipo.id } : {}),
        }),
      })
      if (equipo) arriba = await ponerEnUnidad(equipo, id, rol, b.sumarArriba === true)
    } catch (err) {
      // Deshacer: sin rol ni equipo la cuenta quedaria a medias.
      const borrar = await auth(`admin/users/${id}`, { method: 'DELETE' })
      if (!borrar.res.ok) console.error('crear: no se pudo deshacer la cuenta', id, borrar.cuerpo)
      throw err
    }

    await auditar(ctx, 'crear-persona', id, {
      email: correo,
      rol,
      equipo: equipo?.name ?? null,
      arriba,
    })
    return { id, clave, arriba }
  },

  async 'clave-temporal'(b, ctx) {
    const p = await objetivo(uuid(b.userId, 'Persona'), ctx)
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
    await auditar(ctx, 'clave-temporal', p.id)
    return { clave }
  },

  async desactivar(b, ctx) {
    const p = await objetivo(uuid(b.userId, 'Persona'), ctx)
    const { res, cuerpo } = await auth(`admin/users/${p.id}`, {
      method: 'PUT',
      body: JSON.stringify({ ban_duration: BLOQUEO }),
    })
    if (!res.ok) {
      console.error('auth desactivar', res.status, cuerpo)
      throw new Falla('No se pudo desactivar la cuenta')
    }
    await auditar(ctx, 'desactivar', p.id)
    return {}
  },

  async reactivar(b, ctx) {
    const p = await objetivo(uuid(b.userId, 'Persona'), ctx)
    const { res, cuerpo } = await auth(`admin/users/${p.id}`, {
      method: 'PUT',
      body: JSON.stringify({ ban_duration: 'none' }),
    })
    if (!res.ok) {
      console.error('auth reactivar', res.status, cuerpo)
      throw new Falla('No se pudo reactivar la cuenta')
    }
    await auditar(ctx, 'reactivar', p.id)
    return {}
  },

  async 'cambiar-rol'(b, ctx) {
    const p = await objetivo(uuid(b.userId, 'Persona'), ctx)
    const equipo = await equipoExiste(uuid(b.equipoId, 'Equipo'), ctx)
    const rol = rolEquipo(b.rol)
    const esta = await rest<unknown[]>(
      `team_members?team_id=eq.${equipo.id}&user_id=eq.${p.id}&select=id`,
    )
    if (!esta?.length) throw new Falla('La persona no está en ese equipo')
    const arriba = await ponerEnUnidad(equipo, p.id, rol, b.sumarArriba === true)
    await auditar(ctx, 'cambiar-rol', p.id, { equipo: equipo.name, rol, arriba })
    return { arriba }
  },

  async 'sumar-a-equipo'(b, ctx) {
    const p = await objetivo(uuid(b.userId, 'Persona'), ctx)
    const equipo = await equipoExiste(uuid(b.equipoId, 'Equipo'), ctx)
    // Una persona pertenece a una sola empresa (051): solo entra a unidades de la suya.
    if (p.empresa_id && p.empresa_id !== equipo.empresa_id)
      throw new Falla('Esta persona pertenece a otra empresa')
    const rol = rolEquipo(b.rol)
    const ya = await rest<unknown[]>(
      `team_members?team_id=eq.${equipo.id}&user_id=eq.${p.id}&select=id`,
    )
    if (ya?.length) throw new Falla('Ya está en ese equipo')
    const arriba = await ponerEnUnidad(equipo, p.id, rol, b.sumarArriba === true)
    // Sin equipo activo, este pasa a ser el suyo (si no, entraria a una app vacia).
    if (!p.team_id) {
      await rest(`profiles?id=eq.${p.id}`, {
        method: 'PATCH',
        headers: SIN_RESPUESTA,
        body: JSON.stringify({ team_id: equipo.id }),
      })
    }
    await auditar(ctx, 'sumar-a-equipo', p.id, { equipo: equipo.name, rol, arriba })
    return { arriba }
  },

  async 'quitar-de-equipo'(b, ctx) {
    const p = await objetivo(uuid(b.userId, 'Persona'), ctx)
    const equipo = await equipoExiste(uuid(b.equipoId, 'Equipo'), ctx)
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
    await auditar(ctx, 'quitar-de-equipo', p.id, { equipo: equipo.name })
    return {}
  },

  async 'crear-equipo'(b, ctx) {
    const nombre = texto(b.nombre, 'Nombre del equipo', 2, 60)
    // Opcional: la unidad de la que depende (misma empresa) y el nombre de su nivel.
    const superior = b.superiorId
      ? await equipoExiste(uuid(b.superiorId, 'Unidad superior'), ctx)
      : null
    const nivel = b.nivel ? texto(b.nivel, 'Nivel', 2, 40) : null
    const empresa = superior?.empresa_id ?? ctx.empresa
    if (!empresa) throw new Falla('Elige la unidad superior')
    const filas = await rest<{ id: string }[]>('teams?select=id', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        name: nombre,
        description: '',
        created_by: ctx.id,
        empresa_id: empresa,
        parent_id: superior?.id ?? null,
        nivel,
      }),
    })
    const id = filas?.[0]?.id
    if (!id) throw new Falla('No se pudo crear el equipo')
    // Igual que al crearlo desde Equipos: el Admin queda en la unidad para poder entrar a verla
    // (el Owner, en una empresa ajena, no: una persona pertenece a una sola empresa).
    if (empresa === ctx.miEmpresa) {
      await rest('team_members', {
        method: 'POST',
        headers: SIN_RESPUESTA,
        body: JSON.stringify({ team_id: id, user_id: ctx.id, role: 'admin' }),
      })
    }
    await auditar(ctx, 'crear-equipo', null, { equipo: nombre })
    return { id }
  },

  async 'renombrar-equipo'(b, ctx) {
    const equipo = await equipoExiste(uuid(b.equipoId, 'Equipo'), ctx)
    const nombre = texto(b.nombre, 'Nombre del equipo', 2, 60)
    await rest(`teams?id=eq.${equipo.id}`, {
      method: 'PATCH',
      headers: SIN_RESPUESTA,
      body: JSON.stringify({ name: nombre }),
    })
    await auditar(ctx, 'renombrar-equipo', null, { antes: equipo.name, despues: nombre })
    return {}
  },

  async 'mover-equipo'(b, ctx) {
    const equipo = await equipoExiste(uuid(b.equipoId, 'Equipo'), ctx)
    const superior = b.superiorId
      ? await equipoExiste(uuid(b.superiorId, 'Unidad superior'), ctx)
      : null
    if (superior) {
      if (superior.empresa_id !== equipo.empresa_id)
        throw new Falla('La unidad superior es de otra empresa')
      // La base tambien lo impide (trigger de 051), pero asi el mensaje es claro.
      const arbol = await rest<{ id: string; parent_id: string | null }[]>(
        `teams?select=id,parent_id&empresa_id=eq.${equipo.empresa_id}`,
      )
      const padre = new Map(arbol.map((u) => [u.id, u.parent_id]))
      for (let u: string | null = superior.id, n = 0; u && n < 60; u = padre.get(u) ?? null, n++) {
        if (u === equipo.id)
          throw new Falla('Una unidad no puede depender de una que cuelga de ella')
      }
    }
    await rest(`teams?id=eq.${equipo.id}`, {
      method: 'PATCH',
      headers: SIN_RESPUESTA,
      body: JSON.stringify({ parent_id: superior?.id ?? null }),
    })
    await auditar(ctx, 'mover-equipo', null, {
      equipo: equipo.name,
      depende_de: superior?.name ?? null,
    })
    return {}
  },

  async 'borrar-equipo'(b, ctx) {
    const equipo = await equipoExiste(uuid(b.equipoId, 'Equipo'), ctx)

    // Solo se borra una unidad sin trabajo: borrar teams arrastra en cascada todo lo que cuelga
    // de team_id. Si tiene algo, se dice que y no se borra.
    const TRABAJO: [string, string, string][] = [
      ['activities', 'actividad', 'actividades'],
      ['errors', 'error', 'errores'],
      ['minute_items', 'tema de minuta o proyecto', 'temas de minuta o proyectos'],
      ['meetings', 'reunión', 'reuniones'],
      ['messages', 'mensaje de chat', 'mensajes de chat'],
    ]
    const conteos = await Promise.all(
      TRABAJO.map(([tabla]) =>
        rest<unknown[]>(`${tabla}?team_id=eq.${equipo.id}&select=id&limit=1000`).then(
          (f) => f?.length ?? 0,
        ),
      ),
    )
    const tiene = TRABAJO.flatMap(([, uno, varios], i) =>
      conteos[i]
        ? [`${conteos[i]}${conteos[i] >= 1000 ? '+' : ''} ${conteos[i] === 1 ? uno : varios}`]
        : [],
    )
    if (tiene.length)
      throw new Falla(
        `No se puede borrar ${equipo.name}: tiene ${tiene.join(', ')}. Muévelos o elimínalos primero.`,
      )

    // Las subunidades pasan a la unidad de arriba (o quedan de primer nivel).
    const hijas = await rest<{ id: string }[]>(`teams?parent_id=eq.${equipo.id}&select=id`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ parent_id: equipo.parent_id }),
    })

    // Quien la tenia como unidad activa pasa a otra de las suyas (o a ninguna).
    const miembros = await rest<{ user_id: string }[]>(
      `team_members?team_id=eq.${equipo.id}&select=user_id`,
    )
    const activos = await rest<{ id: string }[]>(`profiles?team_id=eq.${equipo.id}&select=id`)
    for (const p of activos) {
      const otra = await rest<{ team_id: string }[]>(
        `team_members?user_id=eq.${p.id}&team_id=neq.${equipo.id}&select=team_id&limit=1`,
      )
      await rest(`profiles?id=eq.${p.id}`, {
        method: 'PATCH',
        headers: SIN_RESPUESTA,
        body: JSON.stringify({ team_id: otra?.[0]?.team_id ?? null }),
      })
    }

    // La membresia y los grupos de trabajo se van en cascada con la unidad.
    await rest(`teams?id=eq.${equipo.id}`, { method: 'DELETE', headers: SIN_RESPUESTA })
    await auditar(ctx, 'borrar-equipo', null, {
      equipo: equipo.name,
      subunidades: hijas?.length ?? 0,
      personas: miembros?.length ?? 0,
    })
    return { subunidades: hijas?.length ?? 0 }
  },

  // --- Empresa ------------------------------------------------------------------------------

  /** La empresa en la que se trabaja (nombre y niveles), para Estructura. */
  async 'ver-empresa'(_b, ctx) {
    if (!ctx.empresa) return { empresa: null }
    return { empresa: await empresaExiste(ctx.empresa, ctx) }
  },

  /** Nombre y niveles. El Admin edita la suya; el Owner, cualquiera. */
  async 'editar-empresa'(b, ctx) {
    const empresa = await empresaExiste(uuid(b.empresaId ?? ctx.empresa, 'Empresa'), ctx)
    const cambios: Record<string, unknown> = {}
    if (b.nombre !== undefined) cambios.nombre = texto(b.nombre, 'Nombre de la empresa', 2, 80)
    if (b.niveles !== undefined) cambios.niveles = niveles(b.niveles)
    if (b.modulos !== undefined) cambios.modulos = modulos(b.modulos)
    if (!Object.keys(cambios).length) return {}
    await rest(`empresas?id=eq.${empresa.id}`, {
      method: 'PATCH',
      headers: SIN_RESPUESTA,
      body: JSON.stringify({ ...cambios, updated_at: new Date().toISOString() }),
    })
    await auditar({ ...ctx, empresa: empresa.id }, 'editar-empresa', null, {
      empresa: empresa.nombre,
      ...cambios,
    })
    return {}
  },

  /** Modulos propios de una unidad; null = usa los de la empresa. */
  async 'modulos-equipo'(b, ctx) {
    const equipo = await equipoExiste(uuid(b.equipoId, 'Equipo'), ctx)
    const lista = b.modulos === null ? null : modulos(b.modulos)
    await rest(`teams?id=eq.${equipo.id}`, {
      method: 'PATCH',
      headers: SIN_RESPUESTA,
      body: JSON.stringify({ modulos: lista }),
    })
    await auditar(ctx, 'modulos-equipo', null, { equipo: equipo.name, modulos: lista })
    return {}
  },

  // --- Solo Owner ----------------------------------------------------------------------------

  async 'listar-empresas'(_b, ctx) {
    soloOwner(ctx)
    const [empresas, unidades, perfiles] = await Promise.all([
      rest<(Empresa & { created_at: string })[]>(
        `empresas?select=${CAMPOS_EMPRESA},created_at&order=nombre`,
      ),
      rest<{ empresa_id: string }[]>('teams?select=empresa_id'),
      rest<{ id: string; full_name: string; role: string; empresa_id: string | null }[]>(
        'profiles?select=id,full_name,role,empresa_id',
      ),
    ])
    return {
      empresas: empresas.map((e) => ({
        id: e.id,
        nombre: e.nombre,
        niveles: e.niveles,
        personal: e.es_personal,
        creada: e.created_at,
        modulos: e.modulos,
        plan: e.plan,
        pruebaHasta: e.prueba_hasta,
        pagadoHasta: e.pagado_hasta,
        unidades: unidades.filter((u) => u.empresa_id === e.id).length,
        personas: perfiles.filter((p) => p.empresa_id === e.id).length,
        admins: perfiles
          .filter((p) => p.empresa_id === e.id && p.role === 'admin')
          .map((p) => ({ id: p.id, nombre: p.full_name })),
        esMia: e.id === ctx.miEmpresa,
      })),
    }
  },

  async 'crear-empresa'(b, ctx) {
    soloOwner(ctx)
    const nombre = texto(b.nombre, 'Nombre de la empresa', 2, 80)
    const lista = b.niveles ? niveles(b.niveles) : ['Gerencia', 'Subgerencia', 'Área', 'Equipo']
    const filas = await rest<{ id: string }[]>('empresas?select=id', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ nombre, niveles: lista }),
    })
    const id = filas?.[0]?.id
    if (!id) throw new Falla('No se pudo crear la empresa')
    await auditar({ ...ctx, empresa: id }, 'crear-empresa', null, { empresa: nombre })
    return { id }
  },

  /**
   * Admin de una empresa. Con email + nombre crea la cuenta (clave temporal, se devuelve una
   * vez); con userId hace Admin a una persona que ya es de esa empresa.
   */
  async 'nombrar-admin'(b, ctx) {
    soloOwner(ctx)
    const empresa = await empresaExiste(uuid(b.empresaId, 'Empresa'), ctx)
    if (b.userId) {
      const p = await objetivo(uuid(b.userId, 'Persona'), { ...ctx, empresa: empresa.id })
      if (p.empresa_id !== empresa.id) throw new Falla('Esa persona es de otra empresa')
      await rest(`profiles?id=eq.${p.id}`, {
        method: 'PATCH',
        headers: SIN_RESPUESTA,
        body: JSON.stringify({ role: 'admin' }),
      })
      await auditar({ ...ctx, empresa: empresa.id }, 'nombrar-admin', p.id, {
        empresa: empresa.nombre,
      })
      return {}
    }
    const correo = email(b.email)
    const nombre = texto(b.nombre, 'Nombre', 3, 80)
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
      console.error('auth crear admin', res.status, cuerpo)
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
        body: JSON.stringify({ role: 'admin', full_name: nombre, empresa_id: empresa.id }),
      })
    } catch (err) {
      const borrar = await auth(`admin/users/${id}`, { method: 'DELETE' })
      if (!borrar.res.ok) console.error('admin: no se pudo deshacer la cuenta', id, borrar.cuerpo)
      throw err
    }
    await auditar({ ...ctx, empresa: empresa.id }, 'nombrar-admin', id, {
      empresa: empresa.nombre,
      email: correo,
    })
    return { id, clave }
  },

  /**
   * Plan de una empresa: 'gratis' (sin vencimiento) o 'prueba' con N dias desde hoy (para
   * extender una prueba). 'pago' sale de registrar-pago.
   */
  async 'plan-empresa'(b, ctx) {
    soloOwner(ctx)
    const empresa = await empresaExiste(uuid(b.empresaId, 'Empresa'), ctx)
    const plan = b.plan
    // "Pagada" ya no se marca a mano: sale de registrar un pago, que fija hasta cuando (063).
    if (plan === 'pago') throw new Falla('Para dejarla pagada, registra el pago')
    if (plan !== 'gratis' && plan !== 'prueba') throw new Falla('Plan no válido')
    const cambios: Record<string, unknown> = { plan }
    if (plan === 'prueba') {
      const dias = Number(b.dias)
      if (!Number.isInteger(dias) || dias < 1 || dias > 90)
        throw new Falla('La prueba se extiende entre 1 y 90 días')
      cambios.prueba_hasta = new Date(Date.now() + dias * 86_400_000).toISOString()
    }
    await rest(`empresas?id=eq.${empresa.id}`, {
      method: 'PATCH',
      headers: SIN_RESPUESTA,
      body: JSON.stringify(cambios),
    })
    await auditar({ ...ctx, empresa: empresa.id }, 'plan-empresa', null, {
      empresa: empresa.nombre,
      ...cambios,
    })
    return {}
  },

  /**
   * Registra un cobro (migracion 063): la empresa queda en 'pago' hasta el fin del periodo. El
   * periodo parte hoy, o al dia siguiente del vencimiento si aun no vence.
   */
  async 'registrar-pago'(b, ctx) {
    soloOwner(ctx)
    const empresa = await empresaExiste(uuid(b.empresaId, 'Empresa'), ctx)
    const monto = Number(b.monto)
    if (!Number.isInteger(monto) || monto < 1 || monto > 100_000_000)
      throw new Falla('El monto debe ser un número entero de pesos, mayor que 0')
    const meses = Number(b.meses)
    if (![1, 3, 6, 12].includes(meses)) throw new Falla('El período es de 1, 3, 6 o 12 meses')
    if (typeof b.metodo !== 'string' || !METODOS_PAGO.includes(b.metodo))
      throw new Falla('Método de pago no válido')
    const pago = await rest<Record<string, unknown>>('rpc/registrar_pago', {
      method: 'POST',
      body: JSON.stringify({
        p_empresa: empresa.id,
        p_monto: monto,
        p_meses: meses,
        p_metodo: b.metodo,
        p_referencia: texto(b.referencia, 'Referencia', 0, 120),
        p_nota: texto(b.nota, 'Nota', 0, 500),
        p_por: ctx.id,
      }),
    })
    await auditar({ ...ctx, empresa: empresa.id }, 'registrar-pago', null, {
      empresa: empresa.nombre,
      monto,
      meses,
      hasta: pago.periodo_hasta,
    })
    return { pago }
  },

  /**
   * Lo cobrado en el mes en curso, sin los pagos anulados. El mes parte a medianoche de Chile en
   * horario de invierno (-04); en verano la frontera se corre una hora, y para un resumen basta.
   */
  async 'resumen-pagos'(_b, ctx) {
    soloOwner(ctx)
    const mes = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' }).slice(0, 7)
    const filas = await rest<{ monto: number }[]>(
      `pagos?select=monto&anulado_at=is.null&created_at=gte.${mes}-01T00:00:00-04:00`,
    )
    return {
      cobradoMes: filas.reduce((t, f) => t + Number(f.monto), 0),
      pagosMes: filas.length,
    }
  },

  /** Anula un cobro (no se borra) y recalcula hasta cuando queda pagada la empresa. */
  async 'anular-pago'(b, ctx) {
    soloOwner(ctx)
    const id = uuid(b.pagoId, 'Pago')
    const motivo = texto(b.motivo, 'Motivo', 3, 300)
    const filas = await rest<{ empresa_id: string; anulado_at: string | null; monto: number }[]>(
      `pagos?id=eq.${id}&select=empresa_id,anulado_at,monto`,
    )
    const actual = filas?.[0]
    if (!actual) throw new Falla('Pago no encontrado')
    if (actual.anulado_at) throw new Falla('Ese pago ya estaba anulado')
    await rest('rpc/anular_pago', {
      method: 'POST',
      body: JSON.stringify({ p_pago: id, p_motivo: motivo, p_por: ctx.id }),
    })
    await auditar({ ...ctx, empresa: actual.empresa_id }, 'anular-pago', null, {
      monto: actual.monto,
      motivo,
    })
    return {}
  },

  /** Pagos de una empresa, del mas nuevo al mas viejo, con quien los registro o anulo. */
  async 'pagos-empresa'(b, ctx) {
    soloOwner(ctx)
    const empresa = await empresaExiste(uuid(b.empresaId, 'Empresa'), ctx)
    const pagos = await rest(
      `pagos?empresa_id=eq.${empresa.id}&order=created_at.desc&select=*,` +
        'registrado:profiles!pagos_registrado_por_fkey(full_name),' +
        'anulado:profiles!pagos_anulado_por_fkey(full_name)',
    )
    return { pagos }
  },

  /** Correos de contacto para suscripciones (los que ve quien termina su prueba). */
  async 'ver-plataforma'(_b, ctx) {
    soloOwner(ctx)
    const filas = await rest<{ contacto_suscripcion: string[] }[]>(
      'plataforma?select=contacto_suscripcion&limit=1',
    )
    return { contactos: filas?.[0]?.contacto_suscripcion ?? [] }
  },

  async 'editar-plataforma'(b, ctx) {
    soloOwner(ctx)
    if (!Array.isArray(b.contactos) || b.contactos.length < 1 || b.contactos.length > 5)
      throw new Falla('Deja entre 1 y 5 correos de contacto')
    const contactos = [...new Set(b.contactos.map((c) => email(c)))]
    await rest('plataforma?id=eq.true', {
      method: 'PATCH',
      headers: SIN_RESPUESTA,
      body: JSON.stringify({
        contacto_suscripcion: contactos,
        updated_at: new Date().toISOString(),
      }),
    })
    await auditar(ctx, 'editar-plataforma', null, { contactos })
    return { contactos }
  },

  /** Quita el rol Admin (la persona sigue en la empresa como Integrante). */
  async 'quitar-admin'(b, ctx) {
    soloOwner(ctx)
    const p = await perfil(uuid(b.userId, 'Persona'))
    if (!p || p.role !== 'admin') throw new Falla('Esa persona no es Admin')
    if (p.es_owner || p.id === ctx.id) throw new Falla('No puedes quitarle el rol a un Owner')
    await rest(`profiles?id=eq.${p.id}`, {
      method: 'PATCH',
      headers: SIN_RESPUESTA,
      body: JSON.stringify({ role: 'integrante' }),
    })
    await auditar({ ...ctx, empresa: p.empresa_id }, 'quitar-admin', p.id)
    return {}
  },

  async 'nivel-equipo'(b, ctx) {
    const equipo = await equipoExiste(uuid(b.equipoId, 'Equipo'), ctx)
    const nivel = b.nivel ? texto(b.nivel, 'Nivel', 2, 40) : null
    await rest(`teams?id=eq.${equipo.id}`, {
      method: 'PATCH',
      headers: SIN_RESPUESTA,
      body: JSON.stringify({ nivel }),
    })
    await auditar(ctx, 'nivel-equipo', null, { equipo: equipo.name, nivel })
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
    // 1) Sesion valida. 2) Admin u Owner leido de la base, nunca de lo que manda el cliente.
    const user = await getUser(req)
    if (!user) return fallar('No autenticado')
    const yo = await perfil(uuid(user.id, 'Sesión'))
    const owner = yo?.es_owner === true
    if (!yo || (yo.role !== 'admin' && !owner)) {
      console.warn('admin-users: intento sin rol admin', user.id)
      return fallar('No autorizado')
    }
    // Un Admin sin empresa no tiene que administrar (y sin ella el filtro no acotaria nada).
    if (!owner && !yo.empresa_id) return fallar('No autorizado')
    const miEmpresa = yo.empresa_id ? uuid(yo.empresa_id, 'Empresa') : null
    const ctx: Ctx = { id: yo.id, empresa: miEmpresa, miEmpresa, owner, enfocada: false }
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

    // El Owner puede trabajar en cualquier empresa: la elige con empresaId (validada). Para un
    // Admin se ignora: siempre trabaja en la suya.
    if (owner && body.empresaId) {
      ctx.empresa = (await empresaExiste(uuid(body.empresaId, 'Empresa'), ctx)).id
      ctx.enfocada = true
    }

    const accion = typeof body.action === 'string' ? ACCIONES[body.action] : undefined
    if (!accion || !Object.hasOwn(ACCIONES, body.action as string))
      return fallar('Acción desconocida')

    return responder({ success: true, ...(await accion(body, ctx)) })
  } catch (err) {
    if (err instanceof Falla) return fallar(err.message)
    console.error('admin-users: error interno', err)
    return fallar('Error interno; revisa el registro de la función')
  }
})
