import { useAuth } from '@core/auth/hooks/useAuth'
import { useToast } from '@shared/components/ui/Toast'
import { minutesService } from '@infrastructure/supabase/minutes.service'
import type { DecoratedItem } from '@features/minuta/hooks/useMinuta'

/**
 * Escala una subtarea trabada a Minuta para conversarla en la reunion semanal -mismo patron
 * que useCompromisos.llevarAMinuta, aplicado desde el lado de Proyectos-. Se crea un tema nuevo
 * en 'definir' que arrastra responsables, plazo y actividades vinculadas: el item del proyecto
 * no se mueve, sigue siendo parte del plan.
 */
export function useEscalarAMinuta() {
  const { profile } = useAuth()
  const toast = useToast()

  return async (item: DecoratedItem) => {
    if (!profile) return
    try {
      const existentes = await minutesService.getByTeam(profile.team_id, 'minuta')
      await minutesService.create({
        team_id: profile.team_id,
        tipo: 'minuta',
        orden: existentes.length,
        tema: item.tema,
        para_todos: false,
        responsables: item.responsables,
        responsables_text: '',
        estado: 'definir',
        plazo: item.plazo,
        comentarios: '',
        linked_activity_ids: item.linked_activity_ids,
        created_by: profile.id,
      })
      toast.success('Llevado a la minuta para discutir')
    } catch {
      toast.error('No se pudo escalar a la minuta')
    }
  }
}
