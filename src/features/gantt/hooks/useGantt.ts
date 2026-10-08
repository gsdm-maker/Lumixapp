import { useState, useEffect, useMemo } from 'react'
import { activitiesService } from '@infrastructure/supabase/activities.service'
import { profilesService } from '@infrastructure/supabase/profiles.service'
import { useAuth } from '@core/auth/hooks/useAuth'
import { useCapabilities } from '@core/auth/hooks/useCapabilities'
import type { Activity, Profile } from '@shared/types'

interface DayCell {
  date: string
  label: string
  activities: Activity[]
  count: number
}

export interface GanttRow {
  member: Profile
  days: DayCell[]
  totalActivities: number
  loadPercentage: number
  totalHours: number
}

function getWeekDays(referenceDate: Date): { date: string; label: string }[] {
  const monday = new Date(referenceDate)
  const day = monday.getDay()
  const diff = day === 0 ? -6 : 1 - day
  monday.setDate(monday.getDate() + diff)
  monday.setHours(0, 0, 0, 0)

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    const month = d.toLocaleDateString('es-CL', { month: 'short' })
    const date = d.toISOString().split('T')[0]
    const label = `${d.getDate()} ${month}`
    return { date, label }
  })
}

function getWeekLabel(days: { date: string; label: string }[]): string {
  const first = days[0].label
  const last = days[6].label
  return `${first} - ${last}`
}

export function useGantt() {
  const [rows, setRows] = useState<GanttRow[]>([])
  // Lo vencido y abierto de las personas visibles: se muestra aparte para reprogramarlo.
  const [atrasadas, setAtrasadas] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)
  const { user, profile } = useAuth()
  const { isColaborador } = useCapabilities()
  const teamId = profile?.team_id ?? ''

  // Memo por semana: antes `days` era un arreglo nuevo en cada render y el efecto lo leia sin
  // declararlo (exhaustive-deps). Asi el efecto puede depender de `days` sin recargar en cada
  // render: solo cambia cuando cambia la semana, igual que antes con weekOffset.
  const days = useMemo(() => {
    const referenceDate = new Date()
    referenceDate.setDate(referenceDate.getDate() + weekOffset * 7)
    return getWeekDays(referenceDate)
  }, [weekOffset])
  const weekLabel = getWeekLabel(days)

  useEffect(() => {
    if (!user || !teamId) return

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(false)
      let activities: Activity[]
      let members: Profile[]
      try {
        ;[activities, members] = await Promise.all([
          activitiesService.getByTeam(teamId),
          profilesService.getByTeam(teamId),
        ])
      } catch (err) {
        console.error('Gantt load failed:', err)
        if (!cancelled) {
          setError(true)
          setLoading(false)
        }
        return
      }

      if (cancelled) return

      const ganttRows: GanttRow[] = members
        .filter((m) => m.role !== 'admin' && m.role !== 'invitado')
        .map((member) => {
          const memberActivities = activities.filter((a) => a.responsible_id === member.id)

          // Actividades con vencimiento dentro de la semana visible (todos los estados)
          const thisWeekActivities = memberActivities.filter((a) =>
            days.some((d) => a.due_date?.startsWith(d.date)),
          )

          const dayCells: DayCell[] = days.map((day) => {
            const dayActivities = memberActivities.filter((a) => {
              if (!a.due_date) return false
              return a.due_date.startsWith(day.date)
            })
            return {
              date: day.date,
              label: day.label,
              activities: dayActivities,
              count: dayActivities.length,
            }
          })

          const totalHours = thisWeekActivities.reduce(
            (sum, a) => sum + (a.estimated_hours ?? 3),
            0,
          )
          const weeklyHours = 42
          const loadPercentage = Math.min(Math.round((totalHours / weeklyHours) * 100), 150)

          return {
            member,
            days: dayCells,
            totalActivities: thisWeekActivities.length,
            loadPercentage,
            totalHours,
          }
        })

      const visibles = isColaborador ? ganttRows.filter((r) => r.member.id === user?.id) : ganttRows
      setRows(visibles)
      const hoy = new Date()
      const hoyYMD = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
      const ids = new Set(visibles.map((r) => r.member.id))
      setAtrasadas(
        activities
          .filter(
            (a) =>
              ids.has(a.responsible_id) &&
              a.status !== 'completado' &&
              !!a.due_date &&
              a.due_date.split('T')[0] < hoyYMD,
          )
          .sort((a, b) => a.due_date.localeCompare(b.due_date)),
      )
      setLoading(false)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [days, isColaborador, teamId, user, refreshKey])

  const prevWeek = () => setWeekOffset((w) => w - 1)
  const nextWeek = () => setWeekOffset((w) => w + 1)
  const currentWeek = () => setWeekOffset(0)
  const reload = () => setRefreshKey((k) => k + 1)

  return {
    rows,
    atrasadas,
    loading,
    error,
    days,
    weekLabel,
    prevWeek,
    nextWeek,
    currentWeek,
    weekOffset,
    reload,
  }
}
