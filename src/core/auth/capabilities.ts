// Catalogo de capacidades (flags) que se pueden conceder por usuario y por equipo.
export type Capability =
  | 'minuta.gestionar'
  | 'minuta.eliminar'
  | 'minuta.asignar'
  | 'proyectos.gestionar'
  | 'proyectos.eliminar'
  | 'proyectos.asignar'
  | 'compromisos.conducir'
  | 'actividades.asignar_otros'
  | 'actividades.ver_todas'
  | 'actividades.editar_todas'
  | 'actividades.eliminar'
  | 'errores.gestionar'
  | 'ingestas.gestionar'
  | 'ingestas.asignar'
  | 'equipo.gestionar_miembros'
  | 'equipo.configurar'
  | 'modulos.actividades'
  | 'modulos.minuta'
  | 'modulos.compromisos'
  | 'modulos.errores'
  | 'modulos.ingestas'
  | 'modulos.planificacion'
  | 'modulos.dashboard'
  | 'modulos.proyectos'

export const CAPABILITIES: { key: Capability; label: string; group: string }[] = [
  { key: 'minuta.gestionar', label: 'Gestionar minuta (crear/editar)', group: 'Minuta' },
  { key: 'minuta.eliminar', label: 'Eliminar temas', group: 'Minuta' },
  { key: 'minuta.asignar', label: 'Asignar actividades desde minuta', group: 'Minuta' },
  // Proyectos tenia que pedir prestados los permisos de Minuta (migracion 049).
  { key: 'proyectos.gestionar', label: 'Gestionar proyectos (crear/editar)', group: 'Proyectos' },
  { key: 'proyectos.eliminar', label: 'Eliminar proyectos y subtareas', group: 'Proyectos' },
  { key: 'proyectos.asignar', label: 'Asignar actividades desde proyectos', group: 'Proyectos' },
  {
    key: 'compromisos.conducir',
    label: 'Conducir la revision (mover semana, llevar a minuta, comentar)',
    group: 'Compromisos',
  },
  { key: 'actividades.asignar_otros', label: 'Asignar a terceros', group: 'Actividades' },
  { key: 'actividades.ver_todas', label: 'Ver todas las del equipo', group: 'Actividades' },
  { key: 'actividades.editar_todas', label: 'Editar actividades ajenas', group: 'Actividades' },
  { key: 'actividades.eliminar', label: 'Eliminar actividades', group: 'Actividades' },
  { key: 'errores.gestionar', label: 'Gestionar errores', group: 'Errores' },
  { key: 'ingestas.gestionar', label: 'Gestionar ingestas', group: 'Ingestas' },
  { key: 'ingestas.asignar', label: 'Asignar actividades desde ingestas', group: 'Ingestas' },
  {
    key: 'equipo.gestionar_miembros',
    label: 'Agregar/quitar miembros y cambiar su rol',
    group: 'Equipo',
  },
  {
    key: 'equipo.configurar',
    label: 'Configurar equipo (grupos de trabajo, umbral de sobrecarga)',
    group: 'Equipo',
  },
  // Visibilidad de modulos completos en la navegacion. Por defecto TODOS en true para
  // TODOS los roles (nadie pierde acceso que ya tenia): son para que lider/admin los
  // DESTILDE puntualmente a alguien que no necesita ver ese modulo, no para restringir de
  // entrada. Chat, Notificaciones, Equipos y Perfil no estan aca: son identidad/core, nunca
  // se ocultan.
  { key: 'modulos.actividades', label: 'Ver modulo Actividades', group: 'Modulos' },
  { key: 'modulos.minuta', label: 'Ver modulo Minuta', group: 'Modulos' },
  { key: 'modulos.compromisos', label: 'Ver modulo Compromisos', group: 'Modulos' },
  { key: 'modulos.errores', label: 'Ver modulo Errores', group: 'Modulos' },
  { key: 'modulos.ingestas', label: 'Ver modulo Ingestas', group: 'Modulos' },
  { key: 'modulos.planificacion', label: 'Ver modulo Planificacion', group: 'Modulos' },
  { key: 'modulos.dashboard', label: 'Ver modulo Dashboard', group: 'Modulos' },
  { key: 'modulos.proyectos', label: 'Ver modulo Proyectos', group: 'Modulos' },
]

const MODULOS_VISIBLES: Capability[] = [
  'modulos.actividades',
  'modulos.minuta',
  'modulos.compromisos',
  'modulos.errores',
  'modulos.ingestas',
  'modulos.planificacion',
  'modulos.dashboard',
  'modulos.proyectos',
]

// Capacidades que trae cada rol por defecto (antes de sumar flags concedidos). Los modulos
// van en TODOS los roles: ocultar un modulo es una excepcion puntual (flag concedido en
// team_members.permissions), no el estado de partida de ningun rol.
export const ROLE_DEFAULTS: Record<string, Capability[]> = {
  admin: CAPABILITIES.map((c) => c.key),
  lider: CAPABILITIES.map((c) => c.key),
  invitado: [
    'actividades.ver_todas',
    'errores.gestionar',
    'ingestas.gestionar',
    ...MODULOS_VISIBLES,
  ],
  integrante: [...MODULOS_VISIBLES],
}
