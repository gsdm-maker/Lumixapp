import { useState } from 'react'
import { Avatar } from '@shared/components/ui/Avatar'
import { Icon } from '@shared/components/ui/Icon'
import { useToast } from '@shared/components/ui/Toast'
import { CAPABILITIES, ROLE_DEFAULTS, type Capability } from '@core/auth/capabilities'
import { cx } from '@shared/utils/cx'
import type { TeamMember } from '@features/teams/hooks/useTeams'
import { ROLE_LABEL } from '@core/auth/roles'

// Nombre corto para la cabecera de la columna: el grupo (modulo) ya va arriba, asi que basta
// con el verbo. La descripcion completa de CAPABILITIES queda en el tooltip y en el
// aria-label de cada casilla.
const SHORT: Record<Capability, string> = {
  'minuta.gestionar': 'Gestionar',
  'minuta.eliminar': 'Eliminar',
  'minuta.asignar': 'Asignar',
  'proyectos.gestionar': 'Gestionar',
  'proyectos.eliminar': 'Eliminar',
  'proyectos.asignar': 'Asignar',
  'compromisos.conducir': 'Conducir',
  'actividades.asignar_otros': 'Asignar a otros',
  'actividades.ver_todas': 'Ver todas',
  'actividades.editar_todas': 'Editar ajenas',
  'actividades.eliminar': 'Eliminar',
  'errores.gestionar': 'Gestionar',
  'ingestas.gestionar': 'Gestionar',
  'ingestas.asignar': 'Asignar',
  'equipo.gestionar_miembros': 'Miembros',
  'equipo.configurar': 'Configurar',
  'modulos.actividades': 'Actividades',
  'modulos.minuta': 'Minuta',
  'modulos.compromisos': 'Compromisos',
  'modulos.errores': 'Errores',
  'modulos.ingestas': 'Ingestas',
  'modulos.planificacion': 'Planificación',
  'modulos.dashboard': 'Dashboard',
  'modulos.proyectos': 'Proyectos',
}

const GROUP_LABEL: Record<string, string> = { Modulos: 'Ver módulo' }

// Columnas agrupadas por modulo, en el orden del catalogo.
const GROUPS = CAPABILITIES.reduce<{ group: string; caps: typeof CAPABILITIES }[]>((acc, cap) => {
  const last = acc[acc.length - 1]
  if (last && last.group === cap.group) last.caps.push(cap)
  else acc.push({ group: cap.group, caps: [cap] })
  return acc
}, [])

/**
 * Permisos del equipo como matriz persona x permiso (idea 16). Antes cada miembro tenia su
 * propia lista de 24 casillas y no se podia comparar entre personas.
 *
 * Misma regla que la lista anterior, sin cambios en como se guarda:
 *  - Lo que trae el rol se ve punteado ("por rol") y no se puede quitar...
 *  - ...salvo los modulos, que si se pueden revocar aunque el rol los traiga (jefatura puede
 *    ocultarle un modulo puntual a alguien sin bajarle el rol).
 *  - Lo concedido a mano se ve solido.
 * Cada cambio llama a updatePermissions con el objeto completo de flags del miembro.
 */
export function PermisosMatrix({
  members,
  updatePermissions,
}: {
  members: TeamMember[]
  updatePermissions: (userId: string, permissions: Record<string, boolean>) => Promise<void>
}) {
  const toast = useToast()
  // Casilla que se esta guardando: se bloquea para no mandar dos cambios encima.
  const [guardando, setGuardando] = useState<string | null>(null)

  const toggle = async (m: TeamMember, cap: Capability, next: boolean) => {
    const key = `${m.user_id}|${cap}`
    setGuardando(key)
    try {
      await updatePermissions(m.user_id, { ...(m.permissions ?? {}), [cap]: next })
    } catch {
      toast.error('No se pudo guardar el permiso')
    } finally {
      setGuardando(null)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-faint">
        <span className="inline-flex items-center gap-1.5">
          <Cell state="role" /> por rol
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Cell state="granted" /> concedido
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Cell state="off" /> sin permiso
        </span>
      </div>

      <div className="overflow-x-auto lamina">
        <table className="text-xs border-collapse">
          <thead>
            <tr className="bg-surface-soft">
              <th
                rowSpan={2}
                className="sticky left-0 z-10 bg-surface-soft text-left font-medium text-fg-faint px-3 py-2 border-b border-r border-border min-w-[180px]"
              >
                Persona
              </th>
              {GROUPS.map((g) => (
                <th
                  key={g.group}
                  colSpan={g.caps.length}
                  scope="colgroup"
                  className="px-2 pt-2 pb-1 text-left font-semibold text-fg-muted border-l border-border whitespace-nowrap"
                >
                  {GROUP_LABEL[g.group] ?? g.group}
                </th>
              ))}
            </tr>
            <tr className="bg-surface-soft">
              {GROUPS.map((g) =>
                g.caps.map((cap, i) => (
                  <th
                    key={cap.key}
                    scope="col"
                    title={cap.label}
                    className={cx(
                      'px-1.5 pb-2 align-bottom font-normal text-fg-faint text-center leading-tight border-b border-border min-w-[64px]',
                      i === 0 && 'border-l',
                    )}
                  >
                    {SHORT[cap.key] ?? cap.label}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const perms = m.permissions ?? {}
              const roleDefaults = ROLE_DEFAULTS[m.role] ?? []
              return (
                <tr key={m.user_id} className="border-b border-border last:border-b-0 group">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-panel group-hover:bg-surface text-left font-normal px-3 py-1.5 border-r border-border"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar name={m.profile.full_name} size="xs" />
                      <div className="min-w-0">
                        <p className="text-sm text-fg truncate max-w-[160px]">
                          {m.profile.full_name}
                        </p>
                        <p className="text-xs text-fg-faint">{ROLE_LABEL[m.role] ?? m.role}</p>
                      </div>
                    </div>
                  </th>
                  {GROUPS.map((g) =>
                    g.caps.map((cap, i) => {
                      const byRole = roleDefaults.includes(cap.key)
                      const esModulo = cap.key.startsWith('modulos.')
                      const editable = !byRole || esModulo
                      const checked =
                        perms[cap.key] === false ? false : byRole || perms[cap.key] === true
                      // Punteado si el permiso viene SOLO del rol; solido si hay un flag
                      // explicito en true.
                      const state: CellState = !checked
                        ? 'off'
                        : perms[cap.key] === true
                          ? 'granted'
                          : 'role'
                      const key = `${m.user_id}|${cap.key}`
                      return (
                        <td
                          key={cap.key}
                          className={cx(
                            'text-center py-1.5 group-hover:bg-surface',
                            i === 0 && 'border-l border-border',
                          )}
                        >
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={checked}
                            aria-label={`${m.profile.full_name}: ${cap.label}`}
                            title={
                              editable
                                ? cap.label
                                : `${cap.label} · incluido por su rol, no se puede quitar`
                            }
                            disabled={!editable || guardando === key}
                            onClick={() => toggle(m, cap.key, !checked)}
                            className="inline-flex p-1.5 rounded-md enabled:hover:bg-surface-2 disabled:cursor-not-allowed"
                          >
                            <Cell state={state} dim={!editable} busy={guardando === key} />
                          </button>
                        </td>
                      )
                    }),
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

type CellState = 'granted' | 'role' | 'off'

function Cell({ state, dim, busy }: { state: CellState; dim?: boolean; busy?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'w-4 h-4 rounded-sm flex items-center justify-center transition-colors',
        state === 'granted' && 'bg-accent-fill text-on-accent',
        state === 'role' && 'border border-dashed border-fg-faint text-fg-muted',
        state === 'off' && 'border border-border-strong bg-field',
        dim && 'opacity-60',
        busy && 'motion-safe:animate-pulse',
      )}
    >
      {state !== 'off' && <Icon name="check" size={12} strokeWidth={2.5} />}
    </span>
  )
}
