import type { User, Session } from '@supabase/supabase-js'
import type { Profile } from '@shared/types'
import type { Modulo } from '../modulos'

/** Empresa de la persona: su plan, la prueba y los modulos encendidos (migracion 056). */
export interface EmpresaSesion {
  id: string
  nombre: string
  es_personal: boolean
  modulos: Modulo[]
  plan: 'prueba' | 'gratis' | 'pago'
  prueba_hasta: string
  /** Ultimo dia pagado (YYYY-MM-DD), con plan 'pago' (migracion 063). */
  pagado_hasta: string | null
}

export interface AuthState {
  user: User | null
  session: Session | null
  profile: Profile | null
  /** Rol del usuario EN EL EQUIPO ACTIVO (team_members.role). Base para capacidades por equipo. */
  teamRole: string | null
  /** Permisos extra (flags) del usuario en el equipo activo. */
  teamPermissions: Record<string, boolean>
  /** Empresa de la persona (null si aun no pasa por la Bienvenida). */
  empresa: EmpresaSesion | null
  /** Modulos propios de la unidad activa; null = los de la empresa. */
  teamModulos: Modulo[] | null
  loading: boolean
  /** captchaToken: el de Turnstile, cuando el captcha esta encendido. */
  signIn: (
    email: string,
    password: string,
    captchaToken?: string,
  ) => Promise<{ error: string | null }>
  /** Crea una cuenta. confirmar = hay que confirmar el email antes de entrar. */
  signUp: (
    fullName: string,
    email: string,
    password: string,
    captchaToken?: string,
  ) => Promise<{ error: string | null; confirmar: boolean }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: string | null }>
  /** Cambia el equipo activo sin recargar la app. */
  switchTeam: (teamId: string) => Promise<{ error: string | null }>
  /** Vuelve a leer perfil, equipo y empresa. */
  recargar: () => Promise<void>
}
