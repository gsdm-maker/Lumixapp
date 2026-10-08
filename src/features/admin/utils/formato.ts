import { MEMBER_ROLES, ROLE_LABEL } from '@core/auth/roles'
import type { RolEquipo } from '@infrastructure/supabase/admin.service'

/** Roles que se eligen en la consola: nunca "Admin" (el admin global no se crea desde la app). */
export const OPCIONES_ROL = MEMBER_ROLES.map((r) => ({
  value: r as RolEquipo,
  label: ROLE_LABEL[r],
}))

/** "hace 3 días", "hoy", "nunca": para el ultimo ingreso. */
export function haceCuanto(fecha: string | null): string {
  if (!fecha) return 'Nunca ingresó'
  const dias = Math.floor((Date.now() - Date.parse(fecha)) / 86_400_000)
  if (dias <= 0) return 'Hoy'
  if (dias === 1) return 'Ayer'
  if (dias < 30) return `Hace ${dias} días`
  const meses = Math.floor(dias / 30)
  return meses < 12 ? `Hace ${meses} ${meses === 1 ? 'mes' : 'meses'}` : 'Hace más de un año'
}

export function fechaHora(fecha: string): string {
  return new Date(fecha).toLocaleString('es-CL', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Texto de una fila del registro de actividad. */
export function describirRegistro(r: {
  accion: string
  objetivo: string | null
  detalle: Record<string, unknown>
}): string {
  const quien = r.objetivo ?? 'una persona'
  const d = r.detalle ?? {}
  const equipo = typeof d.equipo === 'string' ? d.equipo : ''
  const rol = typeof d.rol === 'string' ? (ROLE_LABEL[d.rol] ?? d.rol) : ''
  switch (r.accion) {
    case 'crear-persona':
      return `Creó la cuenta de ${quien}${rol ? ` (${rol}` : ''}${equipo ? ` en ${equipo})` : rol ? ')' : ''}`
    case 'clave-temporal':
      return `Generó una clave temporal para ${quien}`
    case 'desactivar':
      return `Desactivó a ${quien}`
    case 'reactivar':
      return `Reactivó a ${quien}`
    case 'cambiar-rol':
      return `Cambió a ${quien} a ${rol} en ${equipo}`
    case 'sumar-a-equipo':
      return `Sumó a ${quien} a ${equipo} como ${rol}`
    case 'quitar-de-equipo':
      return `Quitó a ${quien} de ${equipo}`
    case 'crear-equipo':
      return `Creó el equipo ${equipo}`
    case 'renombrar-equipo':
      return `Renombró el equipo ${String(d.antes ?? '')} a ${String(d.despues ?? '')}`
    default:
      return r.accion
  }
}
