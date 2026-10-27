import { useEffect, useState, useRef, useCallback, type ReactNode } from 'react'
import { supabase } from '@infrastructure/supabase/client'
import type { User, Session } from '@supabase/supabase-js'
import type { Profile } from '@shared/types'
import type { Modulo } from '../modulos'
import type { EmpresaSesion } from '../types'
import { AuthContext } from './AuthContextValue'
import { conTope, mensajeAuth } from '../errores'

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

// Empresa de la persona (plan, prueba y modulos; migracion 056) y los modulos propios de su
// unidad activa (null = los de la empresa).
async function fetchEmpresa(
  prof: Profile | null,
): Promise<{ empresa: EmpresaSesion | null; teamModulos: Modulo[] | null }> {
  if (!prof?.empresa_id) return { empresa: null, teamModulos: null }
  const [{ data: e }, { data: t }] = await Promise.all([
    supabase
      .from('empresas')
      .select('id, nombre, es_personal, modulos, plan, prueba_hasta, pagado_hasta')
      .eq('id', prof.empresa_id)
      .maybeSingle(),
    prof.team_id
      ? supabase.from('teams').select('modulos').eq('id', prof.team_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  return {
    empresa: (e as EmpresaSesion | null) ?? null,
    teamModulos: ((t as { modulos: Modulo[] | null } | null)?.modulos ?? null) as Modulo[] | null,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [teamRole, setTeamRole] = useState<string | null>(null)
  const [teamPermissions, setTeamPermissions] = useState<Record<string, boolean>>({})
  const [empresa, setEmpresa] = useState<EmpresaSesion | null>(null)
  const [teamModulos, setTeamModulos] = useState<Modulo[] | null>(null)
  const [loading, setLoading] = useState(true)
  const initialized = useRef(false)

  /** Lee perfil, membresia y empresa de la persona y los deja en el estado. */
  const cargarTodo = useCallback(async (userId: string) => {
    const prof = await fetchProfile(userId)
    const [m, e] = await Promise.all([
      fetchMembership(userId, prof?.team_id ?? null),
      fetchEmpresa(prof),
    ])
    setProfile(prof)
    setTeamRole(m.role)
    setTeamPermissions(m.permissions)
    setEmpresa(e.empresa)
    setTeamModulos(e.teamModulos)
  }, [])

  const limpiar = () => {
    setProfile(null)
    setTeamRole(null)
    setTeamPermissions({})
    setEmpresa(null)
    setTeamModulos(null)
  }

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!initialized.current) return

      setSession(newSession)
      setUser(newSession?.user ?? null)

      if (newSession?.user) await cargarTodo(newSession.user.id)
      else limpiar()
    })

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession)
      setUser(currentSession?.user ?? null)
      if (currentSession?.user) {
        cargarTodo(currentSession.user.id).then(() => {
          initialized.current = true
          setLoading(false)
        })
      } else {
        initialized.current = true
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [cargarTodo])

  const signIn = async (email: string, password: string, captchaToken?: string) => {
    try {
      const { error } = await conTope(
        supabase.auth.signInWithPassword({
          email,
          password,
          options: captchaToken ? { captchaToken } : undefined,
        }),
      )
      if (error) return { error: mensajeAuth(error.message) }
      return { error: null }
    } catch (e) {
      return { error: mensajeAuth(e instanceof Error ? e.message : String(e)) }
    }
  }

  // Registro abierto (migracion 056): la cuenta nace sin empresa y la Bienvenida la crea. Si el
  // proyecto pide confirmar el email, no hay sesion hasta confirmarlo.
  const signUp = async (
    fullName: string,
    email: string,
    password: string,
    captchaToken?: string,
  ) => {
    try {
      const { data, error } = await conTope(
        supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/bienvenida`,
            ...(captchaToken ? { captchaToken } : {}),
          },
        }),
      )
      if (error) return { error: mensajeAuth(error.message), confirmar: false }
      return { error: null, confirmar: !data.session }
    } catch (e) {
      return { error: mensajeAuth(e instanceof Error ? e.message : String(e)), confirmar: false }
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    limpiar()
  }

  // Cambio de equipo activo (idea 18 de la propuesta UI/UX). Antes se hacia con un UPDATE suelto
  // en el Sidebar + window.location.reload(): una recarga completa para cambiar de contexto.
  // Ahora se actualiza el perfil y la membresia aca, y AppLayout vuelve a montar la pantalla
  // actual (key = team_id) para que ningun hook quede con datos del equipo anterior.
  const switchTeam = async (teamId: string) => {
    if (!user) return { error: 'No hay sesion' }
    const { error } = await supabase.from('profiles').update({ team_id: teamId }).eq('id', user.id)
    if (error) return { error: error.message }
    await cargarTodo(user.id)
    return { error: null }
  }

  /** Vuelve a leer perfil, equipo y empresa (despues de la Bienvenida o de cambiar modulos). */
  const recargar = async () => {
    if (user) await cargarTodo(user.id)
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
        empresa,
        teamModulos,
        loading,
        signIn,
        signUp,
        signOut,
        resetPassword,
        switchTeam,
        recargar,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
