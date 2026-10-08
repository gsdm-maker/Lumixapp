import { ROLE_LABEL } from '@core/auth/roles'
import { useState } from 'react'
import { Badge } from '@shared/components/ui/Badge'
import { Button, IconButton } from '@shared/components/ui/Button'
import { Input, Select } from '@shared/components/ui/Input'
import { Avatar } from '@shared/components/ui/Avatar'
import { Icon } from '@shared/components/ui/Icon'
import { PageHeader } from '@shared/components/ui/PageHeader'
import { SectionLabel } from '@shared/components/ui/Indicators'
import { EmptyState } from '@shared/components/ui/EmptyState'
import { LoadingState } from '@shared/components/ui/Spinner'
import { useToast } from '@shared/components/ui/Toast'
import { useAuth } from '@core/auth/hooks/useAuth'
import { useTeams, useTeamMembers } from '@features/teams/hooks/useTeams'
import { adminService } from '@infrastructure/supabase/admin.service'
import { normalizeFullName } from '@shared/utils/name'
import { cx } from '@shared/utils/cx'

const roles = ['admin', 'jefatura', 'colaborador', 'invitado'] as const

export function AdminPage() {
  const { profile } = useAuth()
  const toast = useToast()
  const { teams, loading: teamsLoading, createTeam } = useTeams()
  // Un solo equipo seleccionado para las dos cosas, como siempre: el equipo del formulario
  // "Crear usuario" es tambien el que queda abierto abajo, asi se ve al tiro a la persona
  // recien creada en su equipo.
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const { members, loading: membersLoading, reload } = useTeamMembers(selectedTeam ?? '')

  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState<string>('colaborador')
  const [newTeamName, setNewTeamName] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [generatedPassword, setGeneratedPassword] = useState('')
  const [creando, setCreando] = useState(false)

  if (profile?.role !== 'admin') {
    return (
      <EmptyState
        icon="lock"
        title="No tienes permisos de administrador"
        className="h-full justify-center"
      />
    )
  }

  const handleCreateUser = async () => {
    if (!newEmail || !newName) return
    setError('')
    setSuccess('')
    setGeneratedPassword('')
    setCreando(true)
    try {
      const result = await adminService.createUser(
        newEmail,
        '',
        normalizeFullName(newName),
        newRole,
        selectedTeam ?? undefined,
      )
      setSuccess(`Usuario ${newEmail} creado con rol ${ROLE_LABEL[newRole] ?? newRole}.`)
      setGeneratedPassword(result.password)
      setNewEmail('')
      setNewName('')
      if (selectedTeam) reload()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setCreando(false)
    }
  }

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return
    try {
      await createTeam(newTeamName.trim(), '')
      setNewTeamName('')
    } catch {
      toast.error('No se pudo crear el equipo')
    }
  }

  const handleChangeRole = async (userId: string, role: string) => {
    if (!selectedTeam) return
    try {
      await adminService.changeRole(userId, selectedTeam, role)
      reload()
    } catch {
      toast.error('No se pudo cambiar el rol')
    }
  }

  const copiarClave = async () => {
    try {
      await navigator.clipboard.writeText(generatedPassword)
      toast.success('Clave copiada')
    } catch {
      toast.error('No se pudo copiar; selecciónala a mano')
    }
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            Administración
            <Badge variant="danger">Admin</Badge>
          </span>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-3 sm:px-5 py-5 space-y-8">
          {/* Crear usuario */}
          <section className="space-y-3">
            <SectionLabel>Crear usuario</SectionLabel>
            <form
              className="lamina p-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault()
                void handleCreateUser()
              }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Nombre completo"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nombre y apellido"
                  autoComplete="off"
                />
                <Input
                  label="Email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="usuario@empresa.com"
                  autoComplete="off"
                />
                <Select label="Rol" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Equipo"
                  value={selectedTeam ?? ''}
                  onChange={(e) => setSelectedTeam(e.target.value || null)}
                >
                  <option value="">Sin equipo</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </div>

              {error && (
                <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              )}
              {success && (
                <div role="status" className="rounded-md border border-border bg-surface-soft p-3">
                  <p className="flex items-center gap-1.5 text-sm text-fg">
                    <Icon name="checkCircle" size={15} className="text-success" />
                    {success}
                  </p>
                  {generatedPassword && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-sm text-fg-muted">Clave temporal:</span>
                      <code className="font-mono text-sm font-semibold text-fg select-all rounded-sm bg-panel border border-border px-1.5 py-0.5">
                        {generatedPassword}
                      </code>
                      <IconButton
                        icon="clipboard"
                        size="xs"
                        label="Copiar clave"
                        onClick={copiarClave}
                      />
                    </div>
                  )}
                  <p className="text-xs text-fg-faint mt-1.5">
                    Deberá cambiarla al iniciar sesión.
                  </p>
                </div>
              )}

              <div className="flex justify-end">
                <Button type="submit" loading={creando} disabled={!newEmail || !newName}>
                  Crear usuario
                </Button>
              </div>
            </form>
          </section>

          {/* Equipos y miembros */}
          <section className="space-y-3">
            <SectionLabel>Equipos</SectionLabel>

            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                void handleCreateTeam()
              }}
            >
              <div className="flex-1">
                <Input
                  aria-label="Nombre del nuevo equipo"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="Nombre del nuevo equipo"
                />
              </div>
              <Button type="submit" variant="secondary" icon="plus" disabled={!newTeamName.trim()}>
                Equipo
              </Button>
            </form>

            {teamsLoading ? (
              <LoadingState />
            ) : (
              <div className="lamina divide-y divide-border">
                {teams.map((team) => {
                  const abierto = selectedTeam === team.id
                  return (
                    <div key={team.id}>
                      <button
                        type="button"
                        aria-expanded={abierto}
                        onClick={() => setSelectedTeam(abierto ? null : team.id)}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-surface transition-colors"
                      >
                        <span className="flex-1 text-sm font-medium text-fg">{team.name}</span>
                        <span className="text-xs text-fg-faint">
                          {abierto ? 'Ocultar' : 'Gestionar'}
                        </span>
                        <Icon
                          name="chevronDown"
                          size={15}
                          className={cx(
                            'text-fg-faint transition-transform',
                            abierto && 'rotate-180',
                          )}
                        />
                      </button>

                      {abierto && (
                        <div className="border-t border-border bg-surface-soft">
                          {membersLoading ? (
                            <LoadingState className="py-4" />
                          ) : members.length === 0 ? (
                            <p className="text-xs text-fg-faint px-3 py-3">Sin miembros</p>
                          ) : (
                            <ul className="divide-y divide-border">
                              {members.map((m) => (
                                <li
                                  key={m.user_id}
                                  className="flex items-center justify-between gap-3 px-3 py-2"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <Avatar name={m.profile.full_name} size="sm" />
                                    <div className="min-w-0">
                                      <p className="text-sm text-fg truncate">
                                        {m.profile.full_name}
                                      </p>
                                      <p className="text-xs text-fg-faint truncate">
                                        {m.profile.email}
                                      </p>
                                    </div>
                                  </div>
                                  <Select
                                    size="sm"
                                    aria-label={`Rol de ${m.profile.full_name}`}
                                    value={m.role}
                                    onChange={(e) => handleChangeRole(m.user_id, e.target.value)}
                                    className="w-36 shrink-0"
                                  >
                                    {roles.map((r) => (
                                      <option key={r} value={r}>
                                        {ROLE_LABEL[r]}
                                      </option>
                                    ))}
                                  </Select>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
