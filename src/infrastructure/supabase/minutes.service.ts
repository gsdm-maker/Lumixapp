import { supabase } from '@infrastructure/supabase/client'
import type { HojaTipo, MinuteItem } from '@shared/types'

export const minutesService = {
  async getByTeam(teamId: string, tipo: HojaTipo = 'minuta'): Promise<MinuteItem[]> {
    const { data, error } = await supabase
      .from('minute_items')
      .select('*')
      .eq('team_id', teamId)
      .eq('tipo', tipo)
      .order('orden', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) throw error
    return data ?? []
  },

  async create(
    item: Omit<
      MinuteItem,
      'id' | 'created_at' | 'updated_at' | 'plazo_change_count' | 'plazo_history' | 'parent_item_id'
    > &
      Partial<Pick<MinuteItem, 'plazo_change_count' | 'plazo_history' | 'parent_item_id'>>,
  ): Promise<MinuteItem> {
    const { data, error } = await supabase.from('minute_items').insert(item).select().single()
    if (error) throw error
    return data
  },

  async update(id: string, updates: Partial<MinuteItem>): Promise<MinuteItem> {
    const { data, error } = await supabase
      .from('minute_items')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async remove(id: string): Promise<void> {
    // RLS no da error al bloquear un DELETE: simplemente no borra nada. Sin contar las filas,
    // la app avisaba "eliminado" aunque el tema siguiera ahi.
    const { data, error } = await supabase.from('minute_items').delete().eq('id', id).select('id')
    if (error) throw error
    if (!data?.length) throw new Error('No autorizado para eliminar este tema')
  },

  // Vincula actividades recien creadas a su tema con el permiso de ASIGNAR de esa hoja (RPC de
  // la migracion 049). Un UPDATE directo pedia permiso de gestionar: con solo "asignar", la
  // actividad se creaba pero quedaba sin vincular.
  async vincularActividades(
    itemId: string,
    activityIds: string[],
    responsables: string[],
    fechas?: { inicio: string | null; plazo: string | null },
  ): Promise<void> {
    const { error } = await supabase.rpc('vincular_actividades_tema', {
      p_item: itemId,
      p_activity_ids: activityIds,
      p_responsables: responsables,
      p_fecha_inicio: fechas?.inicio ?? null,
      p_plazo: fechas?.plazo ?? null,
    })
    if (error) throw error
  },

  async subscribeToTeam(teamId: string, callback: () => void) {
    return supabase
      .channel(`minutes-${teamId}-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'minute_items', filter: `team_id=eq.${teamId}` },
        () => callback(),
      )
      .subscribe()
  },
}
