import { Avatar } from '@shared/components/ui/Avatar'
import { Badge } from '@shared/components/ui/Badge'
import { IconButton } from '@shared/components/ui/Button'
import { Select } from '@shared/components/ui/Input'
import { useConfirm } from '@shared/components/ui/ConfirmDialog'
import { useToast } from '@shared/components/ui/Toast'
import type { GrupoTrabajo } from '@infrastructure/supabase/teams.service'
import type { TeamMember } from '@features/teams/hooks/useTeams'
import { MEMBER_ROLES, ROLE_LABEL } from '@core/auth/roles'

// Columnas de la tabla en escritorio; en el celular cada fila envuelve en dos lineas.
const COLS = 'sm:grid sm:grid-cols-[minmax(0,1fr)_9rem_10rem_2rem] sm:items-center sm:gap-3'

/**
 * Miembros del equipo como tabla compacta (antes una caja por persona dentro de la tarjeta
 * del equipo). Las reglas de quien puede hacer que no cambian:
 *  - Rol: solo quien administra el equipo (canManageThis), y nunca el propio.
 *  - Quitar: quien administra, o quien tiene "gestionar miembros" pero solo a colaboradores
 *    e invitados (no puede sacar a una jefatura).
 *  - Grupo: solo quien administra (es un UPDATE de team_members, policy 021).
 */
export function MembersTable({
  members,
  grupos,
  myUserId,
  canManageThis,
  puedeGestionarMiembros,
  changeRole,
  changeGrupo,
  removeMember,
}: {
  members: TeamMember[]
  grupos: GrupoTrabajo[]
  myUserId: string | undefined
  canManageThis: boolean
  puedeGestionarMiembros: boolean
  changeRole: (userId: string, role: string) => Promise<void>
  changeGrupo: (userId: string, grupoId: string | null) => Promise<void>
  removeMember: (userId: string) => Promise<void>
}) {
  const confirm = useConfirm()
  const toast = useToast()
  const grupoNombre = (id: string | null | undefined) =>
    grupos.find((g) => g.id === id)?.nombre ?? null

  const quitar = async (m: TeamMember) => {
    const ok = await confirm({
      title: 'Quitar del equipo',
      message: `${m.profile.full_name} dejará de tener acceso a este equipo. Para volver a sumarlo hay que invitarlo de nuevo.`,
      confirmLabel: 'Quitar',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await removeMember(m.user_id)
      toast.success(`${m.profile.full_name} ya no está en el equipo`)
    } catch {
      toast.error('No se pudo quitar a la persona')
    }
  }

  const guardar = async (accion: Promise<void>, error: string) => {
    try {
      await accion
    } catch {
      toast.error(error)
    }
  }

  return (
    <div className="lamina">
      <div
        aria-hidden="true"
        className={`hidden ${COLS} px-3 py-1.5 border-b border-border bg-surface-soft text-xs font-medium text-fg-faint rounded-t-lg`}
      >
        <span>Persona</span>
        <span>Rol</span>
        <span>Grupo</span>
        <span />
      </div>
      <ul className="divide-y divide-border">
        {members.map((m) => {
          const esYo = m.user_id === myUserId
          const puedeQuitar =
            !esYo &&
            (canManageThis ||
              (puedeGestionarMiembros && (m.role === 'colaborador' || m.role === 'invitado')))
          const opcionesRol: string[] = MEMBER_ROLES.includes(m.role as never)
            ? [...MEMBER_ROLES]
            : [m.role, ...MEMBER_ROLES]
          return (
            <li
              key={m.user_id}
              className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2 ${COLS}`}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1 basis-full sm:basis-auto">
                <Avatar name={m.profile.full_name} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm text-fg truncate">
                    {m.profile.full_name}
                    {esYo && <span className="text-fg-faint font-normal"> · tú</span>}
                  </p>
                  <p className="text-xs text-fg-faint truncate">{m.profile.email}</p>
                </div>
              </div>

              <div className="w-36 sm:w-auto">
                {canManageThis && !esYo ? (
                  <Select
                    size="sm"
                    aria-label={`Rol de ${m.profile.full_name}`}
                    value={m.role}
                    onChange={(e) =>
                      guardar(changeRole(m.user_id, e.target.value), 'No se pudo cambiar el rol')
                    }
                  >
                    {opcionesRol.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r] ?? r}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Badge>{ROLE_LABEL[m.role] ?? m.role}</Badge>
                )}
              </div>

              <div className="w-40 sm:w-auto">
                {/* Grupo de trabajo: solo si el equipo ya tiene alguno creado. */}
                {canManageThis && grupos.length > 0 ? (
                  <Select
                    size="sm"
                    aria-label={`Grupo de ${m.profile.full_name}`}
                    value={m.grupo_id ?? ''}
                    onChange={(e) =>
                      guardar(
                        changeGrupo(m.user_id, e.target.value || null),
                        'No se pudo cambiar el grupo',
                      )
                    }
                  >
                    <option value="">Sin grupo</option>
                    {grupos.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nombre}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <span className="text-sm text-fg-muted">{grupoNombre(m.grupo_id) ?? '—'}</span>
                )}
              </div>

              <div className="ml-auto sm:ml-0">
                {puedeQuitar && (
                  <IconButton
                    icon="trash"
                    size="xs"
                    label={`Quitar a ${m.profile.full_name} del equipo`}
                    onClick={() => quitar(m)}
                    className="hover:!text-danger"
                  />
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
