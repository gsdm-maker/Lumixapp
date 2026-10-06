import { useState } from 'react'
import { profilesService } from '@infrastructure/supabase/profiles.service'
import { Button } from '@shared/components/ui/Button'
import { DatePicker } from '@shared/components/ui/DatePicker'
import { PriorityPicker, SectionLabel } from '@shared/components/ui/Indicators'
import { FieldLabel, Select } from '@shared/components/ui/Input'
import { useToast } from '@shared/components/ui/Toast'
import type { Activity, Profile } from '@shared/types'
import { crearActividad } from '@features/activities/utils/crearActividad'
import { FECHA_CAMPO } from '@features/activities/utils/ui'
import { CheckMinuta } from './AssignActivityModal'

interface DelegarSectionProps {
  activity: Activity
  userId: string | undefined
  /** Equipos que el usuario lidera, sin el activo. */
  managedTeams: { id: string; name: string }[]
  onDelegada: (child: Activity, memberId: string, nombre: string | undefined) => void
}

/**
 * Delegar a mi equipo: la misma tarea, pero para que la haga OTRO equipo que lidero (no una
 * subtarea nueva, sino el mismo trabajo bajado de nivel).
 */
export function DelegarSection({
  activity,
  userId,
  managedTeams,
  onDelegada,
}: DelegarSectionProps) {
  const toast = useToast()
  const [abierto, setAbierto] = useState(false)
  const [team, setTeam] = useState('')
  const [members, setMembers] = useState<Profile[]>([])
  const [member, setMember] = useState('')
  const [priority, setPriority] = useState(activity.priority)
  const [due, setDue] = useState(activity.due_date.split('T')[0])
  const [toMinuta, setToMinuta] = useState(false)
  const [busy, setBusy] = useState(false)

  if (managedTeams.length === 0) return null

  const elegirEquipo = async (teamId: string) => {
    setTeam(teamId)
    setMember('')
    if (!teamId) return setMembers([])
    try {
      setMembers(await profilesService.getByTeam(teamId))
    } catch {
      setMembers([])
    }
  }

  const delegar = async () => {
    if (!userId || !team || !member) return
    setBusy(true)
    try {
      const dueISO = due ? new Date(due).toISOString() : activity.due_date
      const child = await crearActividad(
        {
          teamId: team,
          memberId: member,
          title: activity.title,
          description: activity.description,
          priority,
          dueISO,
          addToMinuta: toMinuta,
          parentId: activity.id,
          observations: 'Delegada desde otro equipo',
        },
        userId,
      )
      onDelegada(child, member, members.find((m) => m.id === member)?.full_name)
      setAbierto(false)
      toast.success(toMinuta ? 'Delegada y agregada a la minuta' : 'Actividad delegada')
    } catch {
      toast.error('No se pudo delegar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-2">
      <SectionLabel
        action={
          !abierto && (
            <Button
              size="xs"
              variant="ghost"
              icon="arrowRight"
              onClick={() => {
                setAbierto(true)
                setPriority(activity.priority)
                setDue(activity.due_date.split('T')[0])
              }}
            >
              Delegar
            </Button>
          )
        }
      >
        Delegar a mi equipo
      </SectionLabel>

      {abierto && (
        <div className="space-y-3 rounded-md border border-border-strong bg-surface-soft p-3">
          <Select label="Equipo" value={team} onChange={(e) => elegirEquipo(e.target.value)}>
            <option value="">Elegir equipo…</option>
            {managedTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          {team && (
            <Select label="Asignar a" value={member} onChange={(e) => setMember(e.target.value)}>
              <option value="">Elegir persona…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                </option>
              ))}
            </Select>
          )}
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Prioridad</FieldLabel>
            <PriorityPicker value={priority} onChange={setPriority} />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Fecha de entrega</FieldLabel>
            <DatePicker
              value={due || null}
              onChange={(v) => setDue(v ?? '')}
              className={FECHA_CAMPO}
            />
          </div>
          <CheckMinuta checked={toMinuta} onChange={setToMinuta} />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button size="sm" loading={busy} disabled={!member} onClick={delegar}>
              Delegar
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
