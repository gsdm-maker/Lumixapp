import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import { supabase } from '@infrastructure/supabase/client'
import { useAuth } from '@core/auth/hooks/useAuth'
import {
  MENSAJE_FILTRADA,
  MIN_CLAVE,
  claveFiltrada,
  errorClaveNueva,
  mensajeErrorClave,
} from '@core/auth/claves'
import { AuthMessage, AuthShell } from './AuthShell'

export function ChangePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [reingresar, setReingresar] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const invalida = errorClaveNueva(password, confirm)
    if (invalida) return setError(invalida)

    setLoading(true)
    if (await claveFiltrada(password)) {
      setLoading(false)
      return setError(MENSAJE_FILTRADA)
    }
    const { error: err } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    })
    setLoading(false)

    if (err) {
      // La sesion es antigua: Supabase pide ingresar de nuevo antes de cambiar la clave.
      setReingresar(/reauthentication/i.test(`${err.code ?? ''} ${err.message}`))
      setError(mensajeErrorClave(err))
      return
    }

    navigate('/chat', { replace: true })
  }

  // El logo reemplaza al cuadrado ambar con "!": es un paso normal del primer ingreso, no
  // una alerta.
  return (
    <AuthShell title="Cambiar contraseña" subtitle="Por seguridad, debes crear una nueva clave">
      {error && <AuthMessage tone="error">{error}</AuthMessage>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nueva contraseña"
          type="password"
          autoComplete="new-password"
          placeholder={`Mínimo ${MIN_CLAVE} caracteres`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Input
          label="Confirmar contraseña"
          type="password"
          autoComplete="new-password"
          placeholder="Repite la contraseña"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        <Button type="submit" className="w-full" size="lg" loading={loading}>
          {loading ? 'Guardando…' : 'Cambiar contraseña'}
        </Button>
        {reingresar && (
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={async () => {
              await signOut()
              navigate('/login', { replace: true })
            }}
          >
            Volver a ingresar
          </Button>
        )}
      </form>
    </AuthShell>
  )
}
