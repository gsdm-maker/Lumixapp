// Nombres de los roles para mostrar. Un solo mapa para toda la app (antes habia copias en
// Sidebar, Equipos, Admin y Perfil, que ya decian cosas distintas: "Admin" vs "Administrador").
// Roles que se pueden asignar dentro de una unidad: lider (la dirige), integrante e invitado. Un rol es POR UNIDAD: una jefatura es Lider de la suya e Integrante de la de su jefe ("linking pin" de Likert).
// "admin" es el Admin de la empresa y "owner" (profiles.es_owner) el de la plataforma: no se
// eligen aca.
export const MEMBER_ROLES = ['lider', 'integrante', 'invitado'] as const

export const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  lider: 'Líder',
  integrante: 'Integrante',
  invitado: 'Invitado',
}
