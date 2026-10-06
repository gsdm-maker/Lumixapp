import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import { useAuth } from '@core/auth/hooks/useAuth'
import { AuthMessage, AuthShell } from './AuthShell'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    // Validacion propia en vez de "required": el mensaje nativo del navegador ("Please fill
    // out this field") sale en ingles y no calza con el resto de la app, ya toda en espanol.
    if (!email.trim() || !password.trim()) {
      setError('Completa email y contraseña.')
      return
    }
    setLoading(true)
    const { error: err } = await signIn(email, password)
    setLoading(false)
    if (err) {
      setError(err)
    } else {
      navigate('/chat')
    }
  }

  return (
    <AuthShell
      title="Lumix"
      subtitle="Sistema operativo conversacional"
      footer="¿No tienes cuenta? Pide una invitación a tu administrador."
    >
      {error && <AuthMessage tone="error">{error}</AuthMessage>}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="tu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          placeholder="Tu contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" className="w-full" size="lg" loading={loading}>
          {loading ? 'Ingresando…' : 'Iniciar sesión'}
        </Button>
      </form>
    </AuthShell>
  )
}
