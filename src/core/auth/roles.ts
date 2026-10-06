// Nombres de los roles para mostrar. Un solo mapa para toda la app (antes habia copias en
// Sidebar, Equipos, Admin y Perfil, que ya decian cosas distintas: "Admin" vs "Administrador").
// Roles que se pueden asignar dentro de un equipo. "admin" es un rol global (lo da
// Administracion), no se elige aca.
export const MEMBER_ROLES = ['jefatura', 'colaborador', 'invitado'] as const

export const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  jefatura: 'Jefatura',
  colaborador: 'Colaborador',
  invitado: 'Invitado',
}
