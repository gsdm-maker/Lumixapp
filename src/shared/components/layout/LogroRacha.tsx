import { useEffect, useState } from 'react'
import { useAuth } from '@core/auth/hooks/useAuth'
import { useCapabilities } from '@core/auth/hooks/useCapabilities'
import { activitiesService } from '@infrastructure/supabase/activities.service'
import { minutesService } from '@infrastructure/supabase/minutes.service'
import { rachaCompromisos, UMBRAL_RACHA } from '@features/compromisos/utils/racha'

/**
 * Logro del menu de la persona: semanas seguidas con los compromisos sobre el 80%. Se calcula al
 * abrir el menu (vive dentro del desplegable) y solo aparece desde 2 semanas: una sola semana
 * no es racha. Quien ve al equipo ve la del equipo; el resto, la suya.
 */
export function LogroRacha() {
  const { profile, user } = useAuth()
  const { canViewAllActivities } = useCapabilities()
  const [racha, setRacha] = useState<number | null>(null)
  const teamId = profile?.team_id

  useEffect(() => {
    if (!teamId || !user) return
    let cancelado = false
    Promise.all([
      activitiesService.getByTeam(teamId),
      minutesService.getByTeam(teamId, 'minuta'),
      minutesService.getByTeam(teamId, 'proyecto'),
    ])
      .then(([acts, minuta, proyectos]) => {
        if (cancelado) return
        const visibles = canViewAllActivities
          ? acts
          : acts.filter((a) => a.responsible_id === user.id)
        setRacha(rachaCompromisos(visibles, [...minuta, ...proyectos]))
      })
      .catch(() => {})
    return () => {
      cancelado = true
    }
  }, [teamId, user, canViewAllActivities])

  if (racha === null || racha < 2) return null
  return (
    <div className="flex items-center gap-3 mx-1 my-1.5 p-2.5 rounded-xl bg-warning-soft">
      <span
        aria-hidden="true"
        className="w-9 h-9 shrink-0 rounded-xl grid place-items-center"
        style={{
          background: 'linear-gradient(135deg, #ffcf5c, #ff9d3d)',
          boxShadow: '0 0 18px rgb(255 170 70 / 0.45)',
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#3a2200"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.5 14 7 22l5-3 5 3-1.5-8" />
        </svg>
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-fg">
          {racha} semanas seguidas sobre {UMBRAL_RACHA}%
        </p>
        <p className="text-xs text-fg-muted">
          {canViewAllActivities
            ? 'El equipo va mejorando. ¡Sigan así!'
            : 'Vas muy bien. ¡Sigue así!'}
        </p>
      </div>
    </div>
  )
}
