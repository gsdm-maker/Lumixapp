import { useState } from 'react'
import { Badge } from '@shared/components/ui/Badge'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import { Modal } from '@shared/components/ui/Modal'
import { Icon } from '@shared/components/ui/Icon'
import { PageHeader } from '@shared/components/ui/PageHeader'
import { EmptyState } from '@shared/components/ui/EmptyState'
import { SkeletonRows } from '@shared/components/ui/Skeleton'
import { useAuth } from '@core/auth/hooks/useAuth'
import { useToast } from '@shared/components/ui/Toast'
import { useTeams } from '@features/teams/hooks/useTeams'
import { cx } from '@shared/utils/cx'
import { TeamDetail } from './TeamDetail'

export function TeamsPage() {
  const { teams, loading, createTeam } = useTeams()
  const { profile } = useAuth()
  const toast = useToast()
  const isAdmin = profile?.role === 'admin'
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creando, setCreando] = useState(false)
  // Un equipo abierto a la vez: sus miembros, grupos y umbral se piden recien al abrirlo.
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreando(true)
    try {
      await createTeam(newName, newDesc)
      setNewName('')
      setNewDesc('')
      setShowCreate(false)
    } catch {
      toast.error('No se pudo crear el equipo')
    } finally {
      setCreando(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Equipos"
        meta={!loading && teams.length > 0 ? `${teams.length}` : undefined}
        actions={
          isAdmin && (
            <Button size="sm" icon="plus" onClick={() => setShowCreate(true)}>
              Nuevo equipo
            </Button>
          )
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-3 sm:px-5 py-4">
          {loading ? (
            <SkeletonRows rows={3} />
          ) : teams.length === 0 ? (
            <EmptyState
              icon="users"
              title="No tienes equipos"
              description={
                isAdmin ? 'Crea el primero con “Nuevo equipo”.' : 'Pide que te inviten a uno.'
              }
            />
          ) : (
            <div className="lamina divide-y divide-border">
              {teams.map((team) => {
                const abierto = selectedTeam === team.id
                const actual = profile?.team_id === team.id
                return (
                  <section key={team.id} aria-labelledby={`team-${team.id}`}>
                    <button
                      type="button"
                      onClick={() => setSelectedTeam(abierto ? null : team.id)}
                      aria-expanded={abierto}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 id={`team-${team.id}`} className="text-sm font-semibold text-fg">
                            {team.name}
                          </h2>
                          {actual && <Badge variant="info">Equipo actual</Badge>}
                        </div>
                        <p className="text-xs text-fg-faint truncate mt-0.5">
                          {team.description || 'Sin descripción'}
                        </p>
                      </div>
                      <span className="hidden sm:inline text-xs text-fg-muted">
                        {abierto ? 'Ocultar' : 'Miembros y ajustes'}
                      </span>
                      <Icon
                        name="chevronDown"
                        size={16}
                        className={cx(
                          'text-fg-faint transition-transform',
                          abierto && 'rotate-180',
                        )}
                      />
                    </button>
                    {abierto && (
                      <div className="px-4 pb-5 border-t border-border bg-surface-soft pt-4">
                        <TeamDetail teamId={team.id} />
                      </div>
                    )}
                  </section>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Crear equipo"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} loading={creando} disabled={!newName.trim()}>
              Crear equipo
            </Button>
          </>
        }
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void handleCreate()
          }}
        >
          <Input
            label="Nombre del equipo"
            placeholder="Ej: Equipo de Desarrollo"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Input
            label="Descripción"
            hint="Opcional"
            placeholder="Para qué es este equipo"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
        </form>
      </Modal>
    </div>
  )
}
