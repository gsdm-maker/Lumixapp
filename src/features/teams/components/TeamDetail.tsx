import { useEffect, useState } from 'react'
import { Button } from '@shared/components/ui/Button'
import { Input, Select } from '@shared/components/ui/Input'
import { SegmentedControl } from '@shared/components/ui/SegmentedControl'
import { SectionLabel } from '@shared/components/ui/Indicators'
import { Icon } from '@shared/components/ui/Icon'
import { LoadingState } from '@shared/components/ui/Spinner'
import { useConfirm } from '@shared/components/ui/ConfirmDialog'
import { useToast } from '@shared/components/ui/Toast'
import { useAuth } from '@core/auth/hooks/useAuth'
import { useCapabilities } from '@core/auth/hooks/useCapabilities'
import { useTeamMembers, useGruposTrabajo } from '@features/teams/hooks/useTeams'
import { teamsService } from '@infrastructure/supabase/teams.service'
import { MembersTable } from './MembersTable'
import { PermisosMatrix } from './PermisosMatrix'

type Vista = 'miembros' | 'permisos'

/** Lo que se ve al abrir un equipo: ajustes, grupos, miembros/permisos e invitar. */
export function TeamDetail({ teamId }: { teamId: string }) {
  const { profile } = useAuth()
  const { isGlobalAdmin } = useCapabilities()
  const confirm = useConfirm()
  const toast = useToast()
  const {
    members,
    loading: membersLoading,
    addMember,
    removeMember,
    changeRole,
    updatePermissions,
    changeGrupo,
  } = useTeamMembers(teamId)
  const { grupos, crearGrupo, eliminarGrupo } = useGruposTrabajo(teamId)
  const [vista, setVista] = useState<Vista>('miembros')
  const [nuevoGrupo, setNuevoGrupo] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [invitando, setInvitando] = useState(false)
  // Umbral del equipo. Se guarda al instante y se refleja al tiro; si la base lo rechaza se
  // revierte, para que el control nunca muestre algo que no quedo guardado.
  const [umbral, setUmbral] = useState(2)

  // Puede gestionar el equipo el admin global o la jefatura de ESE equipo. Se exige que la
  // membresia sea del equipo abierto (evita datos obsoletos al cambiar de equipo, que
  // mostraban los controles donde el usuario es solo colaborador).
  const myMembership = members.find((m) => m.user_id === profile?.id && m.team_id === teamId)
  const canManageThis =
    isGlobalAdmin || myMembership?.role === 'jefatura' || myMembership?.role === 'admin'
  // Gestionar MIEMBROS (agregar/quitar/rol) tambien se puede conceder puntualmente via
  // permiso, sin bajarle el rol a nadie -es del equipo ABIERTO, no del activo, por eso se
  // mira myMembership.permissions y no useCapabilities() (que resuelve contra el equipo
  // activo del usuario, que puede ser otro).
  const puedeGestionarMiembros =
    canManageThis || myMembership?.permissions?.['equipo.gestionar_miembros'] === true
  // Lo mismo para configurar el equipo (umbral de sobrecarga y catalogo de grupos), permiso
  // propio desde la migracion 049. Asignarle el grupo a un miembro sigue siendo de jefatura:
  // es un UPDATE de team_members (policy 021).
  const puedeConfigurar = canManageThis || myMembership?.permissions?.['equipo.configurar'] === true

  // La lista de equipos no trae el umbral; pedirlo aca es una consulta chica que solo ocurre
  // al abrir el equipo.
  useEffect(() => {
    let cancelado = false
    teamsService
      .getById(teamId)
      .then((t) => {
        if (!cancelado) setUmbral(t?.umbral_sobrecarga ?? 2)
      })
      .catch(() => {})
    return () => {
      cancelado = true
    }
  }, [teamId])

  const cambiarUmbral = async (valor: number) => {
    const anterior = umbral
    setUmbral(valor)
    try {
      await teamsService.setUmbralSobrecarga(teamId, valor)
    } catch {
      setUmbral(anterior)
      toast.error('No se pudo guardar el umbral')
    }
  }

  const agregarGrupo = async () => {
    const nombre = nuevoGrupo.trim()
    if (!nombre) return
    setNuevoGrupo('')
    try {
      await crearGrupo(nombre)
    } catch {
      toast.error('No se pudo crear el grupo')
    }
  }

  const borrarGrupo = async (id: string, nombre: string) => {
    const ok = await confirm({
      title: 'Eliminar grupo',
      message: `Se elimina “${nombre}” de los grupos de este equipo.`,
      confirmLabel: 'Eliminar',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await eliminarGrupo(id)
    } catch {
      toast.error('No se pudo eliminar el grupo')
    }
  }

  const invitar = async () => {
    const email = inviteEmail.trim()
    if (!email) return
    setInviteError('')
    setInvitando(true)
    try {
      await addMember(email)
      setInviteEmail('')
      toast.success('Persona agregada al equipo')
    } catch {
      setInviteError('Usuario no encontrado')
    } finally {
      setInvitando(false)
    }
  }

  return (
    <div className="space-y-5 pt-1">
      {/* Ajustes del equipo. Solo quien lo configura: la RLS lo exige igual, pero mostrar un
          control que va a ser rechazado es peor que esconderlo. */}
      {puedeConfigurar && (
        <section className="space-y-2">
          <SectionLabel>Ajustes</SectionLabel>
          <div className="flex flex-wrap items-center gap-2 text-sm text-fg-body">
            <span>Avisar cuando alguien ya tenga</span>
            <Select
              size="sm"
              aria-label="Umbral de sobrecarga"
              value={umbral}
              onChange={(e) => cambiarUmbral(Number(e.target.value))}
              className="w-28"
            >
              <option value={0}>no avisar</option>
              {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
            <span>actividades para el mismo día</span>
          </div>
          <p className="text-xs text-fg-faint">
            {umbral === 0
              ? 'Lumix no avisará por carga en un mismo día.'
              : `Al asignar la actividad número ${umbral + 1} de un día a la misma persona, Lumix se detiene y pregunta qué hacer.`}
          </p>
        </section>
      )}

      {/* Grupos de trabajo (alias "foco"): catalogo por equipo. Sirven para filtrar en
          Minuta/Actividades. */}
      {puedeConfigurar && (
        <section className="space-y-2">
          <SectionLabel>Grupos de trabajo</SectionLabel>
          {grupos.length === 0 ? (
            <p className="text-xs text-fg-faint">
              Sin grupos todavía. Crea uno para poder asignarlo a las personas.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {grupos.map((g) => (
                <li
                  key={g.id}
                  className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1 rounded-md border border-border-strong text-sm text-fg-body"
                >
                  {g.nombre}
                  <button
                    type="button"
                    onClick={() => borrarGrupo(g.id, g.nombre)}
                    aria-label={`Eliminar grupo ${g.nombre}`}
                    title="Eliminar grupo"
                    className="p-0.5 rounded text-fg-faint hover:text-danger hover:bg-surface"
                  >
                    <Icon name="x" size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            className="flex gap-2 max-w-md"
            onSubmit={(e) => {
              e.preventDefault()
              void agregarGrupo()
            }}
          >
            <div className="flex-1">
              <Input
                aria-label="Nombre del nuevo grupo"
                value={nuevoGrupo}
                onChange={(e) => setNuevoGrupo(e.target.value)}
                placeholder="Nuevo grupo (ej: Excelencia)"
              />
            </div>
            <Button type="submit" variant="secondary" icon="plus" disabled={!nuevoGrupo.trim()}>
              Grupo
            </Button>
          </form>
        </section>
      )}

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {canManageThis ? (
            <SegmentedControl
              label="Vista del equipo"
              value={vista}
              onChange={setVista}
              options={[
                { value: 'miembros', label: 'Miembros', count: members.length },
                { value: 'permisos', label: 'Permisos' },
              ]}
            />
          ) : (
            <SectionLabel>Miembros · {members.length}</SectionLabel>
          )}
        </div>

        {membersLoading ? (
          <LoadingState />
        ) : vista === 'permisos' && canManageThis ? (
          <PermisosMatrix members={members} updatePermissions={updatePermissions} />
        ) : (
          <MembersTable
            members={members}
            grupos={grupos}
            myUserId={profile?.id}
            canManageThis={canManageThis}
            puedeGestionarMiembros={puedeGestionarMiembros}
            changeRole={changeRole}
            changeGrupo={changeGrupo}
            removeMember={removeMember}
          />
        )}
      </section>

      {puedeGestionarMiembros && (
        <form
          className="flex flex-col sm:flex-row sm:items-start gap-2 max-w-md"
          onSubmit={(e) => {
            e.preventDefault()
            void invitar()
          }}
        >
          <div className="flex-1">
            <Input
              type="email"
              aria-label="Email para invitar"
              value={inviteEmail}
              onChange={(e) => {
                setInviteEmail(e.target.value)
                if (inviteError) setInviteError('')
              }}
              placeholder="Email para invitar…"
              error={inviteError || undefined}
            />
          </div>
          <Button type="submit" loading={invitando} disabled={!inviteEmail.trim()}>
            Invitar
          </Button>
        </form>
      )}
    </div>
  )
}
