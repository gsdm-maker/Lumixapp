import { supabase } from '@infrastructure/supabase/client'

// Consola de administracion. Todo pasa por la Edge Function admin-users, que valida la sesion y
// el rol admin en el servidor: esconder la consola en la app es comodidad, no la seguridad.

export type RolEquipo = 'jefatura' | 'colaborador' | 'invitado'

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
  miembros: number
  jefaturas: string[]
}

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
    body: { action, ...datos },
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

  /** Devuelve la clave temporal: se muestra una sola vez. */
  crearPersona: (email: string, nombre: string, rol: RolEquipo, equipoId: string | null) =>
    llamar<{ id: string; clave: string }>('crear-persona', { email, nombre, rol, equipoId }),
  claveTemporal: (userId: string) =>
    llamar<{ clave: string }>('clave-temporal', { userId }).then((r) => r.clave),
  desactivar: (userId: string) => llamar('desactivar', { userId }),
  reactivar: (userId: string) => llamar('reactivar', { userId }),

  cambiarRol: (userId: string, equipoId: string, rol: RolEquipo) =>
    llamar('cambiar-rol', { userId, equipoId, rol }),
  sumarAEquipo: (userId: string, equipoId: string, rol: RolEquipo) =>
    llamar('sumar-a-equipo', { userId, equipoId, rol }),
  quitarDeEquipo: (userId: string, equipoId: string) =>
    llamar('quitar-de-equipo', { userId, equipoId }),

  crearEquipo: (nombre: string) => llamar<{ id: string }>('crear-equipo', { nombre }),
  renombrarEquipo: (equipoId: string, nombre: string) =>
    llamar('renombrar-equipo', { equipoId, nombre }),
}
