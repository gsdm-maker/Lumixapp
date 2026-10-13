import { useAuth } from './useAuth'
import { ROLE_DEFAULTS, type Capability } from '../capabilities'
import { moduloDe } from '../modulos'

// Capacidades resueltas por el ROL DEL EQUIPO ACTIVO + los permisos (flags) concedidos a
// ese usuario en ese equipo. El admin global es override total. Asi una persona puede ser
// lider en un equipo e integrante en otro, y ademas recibir permisos puntuales.
export function useCapabilities() {
  const { profile, teamRole, teamPermissions, empresa, teamModulos } = useAuth()
  // Modulos encendidos donde trabaja la persona: los de su unidad, o los de su empresa. Sin
  // empresa cargada todavia, no se filtra (no esconder el menu mientras carga).
  const encendidos = teamModulos ?? empresa?.modulos ?? null
  const isGlobalAdmin = profile?.role === 'admin'
  const role = teamRole ?? profile?.role ?? 'integrante'
  const defaults = ROLE_DEFAULTS[role] ?? []

  // El admin global nunca se bloquea. Para el resto: un flag explicito (true o false) en
  // team_members.permissions manda por sobre el default del rol -asi el lider puede
  // ocultarle un modulo puntual a alguien sin tocar su rol-; sin flag explicito, gana el
  // default. Antes solo se podia SUMAR capacidades (nunca quitar una que traia el rol); los
  // flags de "modulos.*" necesitan poder revocarse, asi que el chequeo de `false` aplica
  // parejo a todo el catalogo (nadie fijaba `false` antes, asi que no cambia nada existente).
  const can = (cap: Capability): boolean => {
    // Un modulo apagado en la empresa o en la unidad no lo ve nadie, ni el Admin (migracion 056).
    const modulo = moduloDe(cap)
    if (modulo && encendidos && !encendidos.includes(modulo)) return false
    if (isGlobalAdmin) return true
    const override = teamPermissions?.[cap]
    if (override === true) return true
    if (override === false) return false
    return defaults.includes(cap)
  }

  return {
    role,
    isGlobalAdmin,
    can,
    // Convenience
    canManageMinuta: can('minuta.gestionar'),
    canDeleteMinuta: can('minuta.eliminar'),
    canAssignMinuta: can('minuta.asignar'),
    canManageProyectos: can('proyectos.gestionar'),
    canDeleteProyectos: can('proyectos.eliminar'),
    canAssignProyectos: can('proyectos.asignar'),
    canConducirCompromisos: can('compromisos.conducir'),
    canAssignOthers: can('actividades.asignar_otros'),
    canViewAllActivities: can('actividades.ver_todas'),
    canEditAllActivities: can('actividades.editar_todas'),
    canDeleteActivities: can('actividades.eliminar'),
    canManageErrors: can('errores.gestionar'),
    canManageIngestas: can('ingestas.gestionar'),
    canAssignIngestas: can('ingestas.asignar'),
    canConfigureTeam: can('equipo.configurar'),
    // "Ve solo lo suyo" en actividades (compat con filtros existentes).
    isIntegrante: !isGlobalAdmin && !can('actividades.ver_todas'),
    isInvitado: role === 'invitado',
    // Owner de la plataforma (ve todas las empresas).
    isOwner: profile?.es_owner === true,
  }
}
