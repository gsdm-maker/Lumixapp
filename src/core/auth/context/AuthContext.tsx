import { useEffect, useState, useRef, type ReactNode } from 'react'
import { supabase } from '@infrastructure/supabase/client'
import type { User, Session } from '@supabase/supabase-js'
import type { Profile } from '@shared/types'
import { AuthContext } from './AuthContextValue'

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
  return data
}

// Membresia del usuario en su equipo activo (rol + permisos extra por flag).
async function fetchMembership(
  userId: string,
  teamId: string | null,
): Promise<{ role: string | null; permissions: Record<string, boolean> }> {
  if (!teamId) return { role: null, permissions: {} }
  const { data } = await supabase
    .from('team_members')
    .select('role, permissions')
    .eq('user_id', userId)
    .eq('team_id', teamId)
    .maybeSingle()
  return {
    role: data?.role ?? null,
    permissions: (data?.permissions as Record<string, boolean>) ?? {},
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [teamRole, setTeamRole] = useState<string | null>(null)
  const [teamPermissions, setTeamPermissions] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const initialized = useRef(false)

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!initialized.current) return

      setSession(newSession)
      setUser(newSession?.user ?? null)

      if (newSession?.user) {
        const prof = await fetchProfile(newSession.user.id)
        setProfile(prof)
        const m = await fetchMembership(newSession.user.id, prof?.team_id ?? null)
        setTeamRole(m.role)
        setTeamPermissions(m.permissions)
      } else {
        setProfile(null)
        setTeamRole(null)
        setTeamPermissions({})
      }
    })

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession)
      setUser(currentSession?.user ?? null)
      if (currentSession?.user) {
        fetchProfile(currentSession.user.id).then(async (prof) => {
          setProfile(prof)
          const m = await fetchMembership(currentSession.user.id, prof?.team_id ?? null)
          setTeamRole(m.role)
          setTeamPermissions(m.permissions)
          initialized.current = true
          setLoading(false)
        })
      } else {
        initialized.current = true
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return { error: null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setProfile(null)
    setTeamRole(null)
    setTeamPermissions({})
  }

  // Cambio de equipo activo (idea 18 de la propuesta UI/UX). Antes se hacia con un UPDATE suelto
  // en el Sidebar + window.location.reload(): una recarga completa para cambiar de contexto.
  // Ahora se actualiza el perfil y la membresia aca, y AppLayout vuelve a montar la pantalla
  // actual (key = team_id) para que ningun hook quede con datos del equipo anterior.
  const switchTeam = async (teamId: string) => {
    if (!user) return { error: 'No hay sesion' }
    const { error } = await supabase.from('profiles').update({ team_id: teamId }).eq('id', user.id)
    if (error) return { error: error.message }
    const prof = await fetchProfile(user.id)
    const m = await fetchMembership(user.id, prof?.team_id ?? null)
    setProfile(prof)
    setTeamRole(m.role)
    setTeamPermissions(m.permissions)
    return { error: null }
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) return { error: error.message }
    return { error: null }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        teamRole,
        teamPermissions,
        loading,
        signIn,
        signOut,
        resetPassword,
        switchTeam,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
