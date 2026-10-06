import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import { supabase } from '@infrastructure/supabase/client'
import { AuthMessage, AuthShell } from './AuthShell'

export function ChangePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    if (password !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    })
    setLoading(false)

    if (err) {
      setError(err.message || 'Error al cambiar la contraseña')
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
          placeholder="Mínimo 6 caracteres"
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
      </form>
    </AuthShell>
  )
}
