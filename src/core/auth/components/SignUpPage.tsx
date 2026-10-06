import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import { useAuth } from '@core/auth/hooks/useAuth'
import { normalizeFullName } from '@shared/utils/name'
import { AuthMessage, AuthShell } from './AuthShell'

export function SignUpPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    const { error: err } = await signUp(email, password, normalizeFullName(fullName))
    setLoading(false)

    if (err) {
      setError(err)
    } else {
      setSuccess('Cuenta creada. Revisa tu email para confirmar.')
      setTimeout(() => navigate('/login'), 3000)
    }
  }

  return (
    <AuthShell
      title="Crear cuenta"
      subtitle="Únete a Lumix"
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Inicia sesión
          </Link>
        </>
      }
    >
      {error && <AuthMessage tone="error">{error}</AuthMessage>}
      {success && <AuthMessage tone="success">{success}</AuthMessage>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nombre completo"
          autoComplete="name"
          placeholder="Tu nombre"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="tu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label="Contraseña"
          type="password"
          autoComplete="new-password"
          placeholder="Mínimo 6 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        <Button type="submit" className="w-full" size="lg" loading={loading}>
          {loading ? 'Creando cuenta…' : 'Crear cuenta'}
        </Button>
      </form>
    </AuthShell>
  )
}
