import { useEffect, useState } from 'react'
import { useAuth } from '@core/auth/hooks/useAuth'
import { teamsService } from '@infrastructure/supabase/teams.service'
import { useToast } from '@shared/components/ui/Toast'

/**
 * Equipos de la persona y cambio de equipo activo. Lo comparten el menu superior (escritorio) y
 * el menu lateral (celular).
 */
export function useEquipos(alCambiar?: () => void) {
  const { profile, user, switchTeam } = useAuth()
  const toast = useToast()
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([])
  const [switching, setSwitching] = useState(false)
  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    if (!user) return
    teamsService.getMyTeams(user.id).then(setTeams)
  }, [user])

  const equipoActual = teams.find((t) => t.id === profile?.team_id)
  const puedeCambiar = isAdmin ? teams.length > 0 : teams.length > 1

  const cambiarEquipo = async (teamId: string) => {
    if (!profile || teamId === profile.team_id) return
    setSwitching(true)
    const { error } = await switchTeam(teamId)
    setSwitching(false)
    if (error) {
      toast.error(`No se pudo cambiar de equipo: ${error}`)
      return
    }
    toast.success(`Ahora estás en ${teams.find((t) => t.id === teamId)?.name ?? 'el equipo'}`)
    alCambiar?.()
  }

  return { teams, equipoActual, puedeCambiar, cambiarEquipo, switching }
}
