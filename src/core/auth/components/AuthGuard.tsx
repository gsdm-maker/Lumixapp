import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@core/auth/hooks/useAuth'
import { LoadingState } from '@shared/components/ui/Spinner'

interface AuthGuardProps {
  children: ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading, profile } = useAuth()

  if (loading) {
    return (
      // Solo estilo: con tokens respeta el tema claro (antes fijaba fondo oscuro).
      <div className="min-h-dvh flex items-center justify-center bg-shell">
        <LoadingState label="Cargando…" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  const mustChange =
    user.user_metadata?.must_change_password === true ||
    user.user_metadata?.must_change_password === 'true'

  if (mustChange && profile) {
    return <Navigate to="/change-password" replace />
  }

  return <>{children}</>
}
