import { supabase } from '@infrastructure/supabase/client'

// Consola de administracion. Todo pasa por la Edge Function admin-users, que valida la sesion y
// el rol admin en el servidor: esconder la consola en la app es comodidad, no la seguridad.

export type RolEquipo = 'lider' | 'integrante' | 'invitado'

/** Plan de una empresa (migracion 056). */
export type PlanEmpresa = 'prueba' | 'gratis' | 'pago'

/** Empresa en la que se trabaja (para Estructura): su nombre y sus niveles. */
export interface EmpresaInfo {
  id: string
  nombre: string
  /** Niveles de la jerarquia, de arriba hacia abajo (Gerencia, Subgerencia, Area...). */
  niveles: string[]
  es_personal: boolean
  /** Modulos encendidos (el chat siempre esta). */
  modulos: string[]
  plan: PlanEmpresa
  prueba_hasta: string
}

/** Una empresa vista por el Owner (pagina Empresas). */
export interface EmpresaAdmin {
  id: string
  nombre: string
  niveles: string[]
  personal: boolean
  creada: string
  unidades: number
  personas: number
  admins: { id: string; nombre: string }[]
  /** La empresa a la que pertenece la cuenta del Owner. */
  esMia: boolean
  modulos: string[]
  plan: PlanEmpresa
  pruebaHasta: string
}

// --- Empresa en foco ---------------------------------------------------------------------------
// El Owner puede trabajar en cualquier empresa: la elegida viaja como empresaId en cada llamada
// (el servidor la valida, y la ignora para un Admin, que siempre trabaja en la suya). Se
// recuerda en el navegador solo como comodidad.

const CLAVE_FOCO = 'lumix.admin.empresa'
const oyentes = new Set<() => void>()

function leerFoco(): string | null {
  try {
    return localStorage.getItem(CLAVE_FOCO)
  } catch {
    return null
  }
}

let foco: string | null = leerFoco()

export const empresaFoco = {
  get: (): string | null => foco,
  set(id: string | null) {
    if (id === foco) return
    foco = id
    try {
      if (id) localStorage.setItem(CLAVE_FOCO, id)
      else localStorage.removeItem(CLAVE_FOCO)
    } catch {
      // Sin almacenamiento (modo privado): el foco dura hasta recargar.
    }
    oyentes.forEach((f) => f())
  },
  subscribe(f: () => void) {
    oyentes.add(f)
    return () => {
      oyentes.delete(f)
    }
  },
}

export interface PersonaAdmin {
  id: string
  email: string
  nombre: string
  esAdmin: boolean
  rolGlobal: string
  equipoActivo: string | null
  equipos: { id: string; nombre: string; rol: string }[]
  activa: boolean
  ultimoIngreso: string | null
  creada: string | null
  debeCambiarClave: boolean
}

export interface EquipoAdmin {
  id: string
  nombre: string
  creado: string
  /** Unidad de la que depende (null = primer nivel de la empresa). */
  superior: string | null
  /** Nombre del nivel (Gerencia, Area, Equipo...). Solo para mostrar. */
  nivel: string | null
  /** Modulos propios de la unidad; null = los de la empresa. */
  modulos: string[] | null
  miembros: number
  lideres: string[]
  /** Gente de la unidad (sin el Admin de la empresa), por nombre. */
  personas: { id: string; nombre: string; rol: string }[]
}

/** Unidad de arriba a la que tambien se sumo un Lider como Integrante (o null). */
type ConArriba = { arriba: string | null }

export interface RegistroAdmin {
  id: string
  accion: string
  actor: string
  objetivo: string | null
  detalle: Record<string, unknown>
  fecha: string
}

async function llamar<T>(action: string, datos: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action, ...(foco ? { empresaId: foco } : {}), ...datos },
  })
  if (error) throw new Error('No se pudo conectar con el servidor')
  if (!data) throw new Error('Sin respuesta del servidor')
  if (data.success === false) throw new Error(data.error || 'No se pudo completar')
  return data as T
}

export const adminService = {
  listarPersonas: () =>
    llamar<{ personas: PersonaAdmin[] }>('listar-personas').then((r) => r.personas),
  listarEquipos: () => llamar<{ equipos: EquipoAdmin[] }>('listar-equipos').then((r) => r.equipos),
  listarAuditoria: () =>
    llamar<{ registros: RegistroAdmin[] }>('listar-auditoria').then((r) => r.registros),

  /**
   * Devuelve la clave temporal: se muestra una sola vez. sumarArriba: si queda como Lider,
   * tambien entra como Integrante de la unidad de arriba.
   */
  crearPersona: (
    email: string,
    nombre: string,
    rol: RolEquipo,
    equipoId: string | null,
    sumarArriba = false,
  ) =>
    llamar<{ id: string; clave: string } & ConArriba>('crear-persona', {
      email,
      nombre,
      rol,
      equipoId,
      sumarArriba,
    }),
  claveTemporal: (userId: string) =>
    llamar<{ clave: string }>('clave-temporal', { userId }).then((r) => r.clave),
  desactivar: (userId: string) => llamar('desactivar', { userId }),
  reactivar: (userId: string) => llamar('reactivar', { userId }),

  /** Si rol es Lider, el Lider anterior de la unidad pasa a Integrante (uno solo por unidad). */
  cambiarRol: (userId: string, equipoId: string, rol: RolEquipo, sumarArriba = false) =>
    llamar<ConArriba>('cambiar-rol', { userId, equipoId, rol, sumarArriba }),
  sumarAEquipo: (userId: string, equipoId: string, rol: RolEquipo, sumarArriba = false) =>
    llamar<ConArriba>('sumar-a-equipo', { userId, equipoId, rol, sumarArriba }),
  quitarDeEquipo: (userId: string, equipoId: string) =>
    llamar('quitar-de-equipo', { userId, equipoId }),

  crearEquipo: (nombre: string, superiorId: string | null, nivel: string | null) =>
    llamar<{ id: string }>('crear-equipo', { nombre, superiorId, nivel }),
  renombrarEquipo: (equipoId: string, nombre: string) =>
    llamar('renombrar-equipo', { equipoId, nombre }),
  /** Cambia de que unidad depende (null = primer nivel). La base rechaza ciclos. */
  moverEquipo: (equipoId: string, superiorId: string | null) =>
    llamar('mover-equipo', { equipoId, superiorId }),
  /**
   * Borra una unidad SIN trabajo (si tiene actividades, minutas, etc. el servidor lo rechaza
   * diciendo que tiene). Sus subunidades pasan a la unidad de arriba.
   */
  borrarEquipo: (equipoId: string) =>
    llamar<{ subunidades: number }>('borrar-equipo', { equipoId }),
  cambiarNivel: (equipoId: string, nivel: string | null) =>
    llamar('nivel-equipo', { equipoId, nivel }),

  /** Empresa en la que se trabaja (la propia, o la elegida por el Owner). */
  verEmpresa: () =>
    llamar<{ empresa: EmpresaInfo | null }>('ver-empresa').then((r) =>
      r.empresa ? [r.empresa] : [],
    ),
  /** Nombre y/o niveles. El Admin edita la suya; el Owner, cualquiera. */
  editarEmpresa: (
    empresaId: string,
    cambios: { nombre?: string; niveles?: string[]; modulos?: string[] },
  ) => llamar('editar-empresa', { empresaId, ...cambios }),
  /** Modulos propios de una unidad; null = vuelve a usar los de la empresa. */
  modulosEquipo: (equipoId: string, modulos: string[] | null) =>
    llamar('modulos-equipo', { equipoId, modulos }),

  // Solo Owner
  listarEmpresas: () =>
    llamar<{ empresas: EmpresaAdmin[] }>('listar-empresas').then((r) => r.empresas),
  crearEmpresa: (nombre: string) => llamar<{ id: string }>('crear-empresa', { nombre }),
  /** Crea la cuenta del Admin de la empresa; devuelve la clave temporal (se muestra una vez). */
  nombrarAdminNuevo: (empresaId: string, nombre: string, email: string) =>
    llamar<{ id: string; clave: string }>('nombrar-admin', { empresaId, nombre, email }),
  quitarAdmin: (userId: string) => llamar('quitar-admin', { userId }),
  /** Correos a los que escribe quien termina su prueba. */
  verContactos: () => llamar<{ contactos: string[] }>('ver-plataforma').then((r) => r.contactos),
  editarContactos: (contactos: string[]) =>
    llamar<{ contactos: string[] }>('editar-plataforma', { contactos }).then((r) => r.contactos),
  /** Gratis, pagada, o prueba por N dias desde hoy. */
  cambiarPlan: (empresaId: string, plan: PlanEmpresa, dias?: number) =>
    llamar('plan-empresa', { empresaId, plan, dias }),
}
