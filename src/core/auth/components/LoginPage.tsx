import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import { Icon } from '@shared/components/ui/Icon'
import { useAuth } from '@core/auth/hooks/useAuth'
import { normalizeFullName } from '@shared/utils/name'
import { MENSAJE_FILTRADA, MIN_CLAVE, claveFiltrada, errorClaveNueva } from '@core/auth/claves'
import { AuthMessage, AuthShell } from './AuthShell'
import { Captcha } from './Captcha'
import { CAPTCHA_SITE_KEY } from '@core/auth/captcha'
import { cx } from '@shared/utils/cx'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Ingresar o crear una cuenta (registro abierto, migracion 056). Quien crea una cuenta pasa a
 * la Bienvenida: elige si Lumix es para el o para su empresa y que modulos usar, y empieza su
 * prueba de 15 dias.
 */
export function LoginPage() {
  const [modo, setModo] = useState<'ingresar' | 'crear'>('ingresar')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [loading, setLoading] = useState(false)
  const [mostrarClave, setMostrarClave] = useState(false)
  // Captcha (si esta encendido): cada token sirve una vez, asi que se pide otro tras cada intento.
  const [captcha, setCaptcha] = useState<string | null>(null)
  const [reinicioCaptcha, setReinicioCaptcha] = useState(0)
  const faltaCaptcha = !!CAPTCHA_SITE_KEY && !captcha
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()

  const cambiarModo = (m: 'ingresar' | 'crear') => {
    setModo(m)
    setError('')
    setAviso('')
    setMostrarClave(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setAviso('')
    // Validacion propia en vez de "required": el mensaje nativo del navegador ("Please fill
    // out this field") sale en ingles y no calza con el resto de la app, ya toda en espanol.
    if (modo === 'crear') {
      const n = normalizeFullName(nombre)
      if (n.length < 3) return setError('Escribe tu nombre y apellido.')
      if (!EMAIL.test(email.trim())) return setError('El email no es válido.')
      const invalida = errorClaveNueva(password)
      if (invalida) return setError(invalida)
      setLoading(true)
      if (await claveFiltrada(password)) {
        setLoading(false)
        return setError(MENSAJE_FILTRADA)
      }
      if (faltaCaptcha) {
        setLoading(false)
        return setError('Completa la verificación de seguridad.')
      }
      const r = await signUp(n, email.trim().toLowerCase(), password, captcha ?? undefined)
      setLoading(false)
      setReinicioCaptcha((x) => x + 1)
      if (r.error) {
        setError(
          /registered|already/i.test(r.error)
            ? 'Ya existe una cuenta con ese email. Ingresa con tu contraseña.'
            : r.error,
        )
      } else if (r.confirmar) {
        setAviso('Te enviamos un correo para confirmar tu cuenta. Ábrelo y vuelve a ingresar.')
        setModo('ingresar')
      } else {
        navigate('/bienvenida')
      }
      return
    }

    if (!email.trim() || !password.trim()) {
      setError('Completa email y contraseña.')
      return
    }
    if (faltaCaptcha) return setError('Completa la verificación de seguridad.')
    setLoading(true)
    const { error: err } = await signIn(email, password, captcha ?? undefined)
    setLoading(false)
    setReinicioCaptcha((x) => x + 1)
    if (err) {
      // Cuenta desactivada desde Administracion: Supabase responde en ingles ("User is banned").
      setError(
        /banned/i.test(err)
          ? 'Tu cuenta está desactivada. Habla con el administrador.'
          : /confirm/i.test(err)
            ? 'Confirma tu email primero: revisa el correo que te enviamos.'
            : err,
      )
    } else {
      // El admin elige entre Lumix y Administracion; el resto pasa directo al chat.
      navigate('/entrar')
    }
  }

  const crear = modo === 'crear'

  return (
    <AuthShell
      overline={crear ? 'Prueba gratis 15 días' : 'Ingresar a Lumix'}
      title={crear ? 'Crea tu cuenta' : 'Hola de nuevo'}
      subtitle={
        crear ? 'Sin tarjeta. Cancelás cuando quieras.' : 'Ingresá para seguir donde quedaste.'
      }
      footer={
        crear ? (
          <>
            ¿Ya tenés cuenta?{' '}
            <button
              type="button"
              className="font-semibold text-accent hover:underline"
              onClick={() => cambiarModo('ingresar')}
            >
              Ingresá
            </button>
          </>
        ) : (
          <>
            ¿No tenés cuenta?{' '}
            <button
              type="button"
              className="font-semibold text-accent hover:underline"
              onClick={() => cambiarModo('crear')}
            >
              Creá una y probá Lumix 15 días
            </button>
          </>
        )
      }
    >
      {error && <AuthMessage tone="error">{error}</AuthMessage>}
      {aviso && <AuthMessage tone="success">{aviso}</AuthMessage>}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div
          className={cx(
            'overflow-hidden transition-all duration-300 ease-out',
            crear ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0',
          )}
        >
          <Input
            label="Nombre completo"
            autoComplete="name"
            placeholder="Nombre y apellido"
            leftIcon="user"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={80}
            disabled={!crear}
          />
        </div>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="tu@email.com"
          leftIcon="mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Contraseña"
          type={mostrarClave ? 'text' : 'password'}
          autoComplete={crear ? 'new-password' : 'current-password'}
          placeholder={crear ? `Mínimo ${MIN_CLAVE} caracteres` : 'Tu contraseña'}
          leftIcon="lock"
          rightElement={
            <button
              type="button"
              onClick={() => setMostrarClave((v) => !v)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-fg-faint transition-colors hover:bg-surface hover:text-fg"
              aria-label={mostrarClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              tabIndex={-1}
            >
              <Icon name={mostrarClave ? 'eyeOff' : 'eye'} size={16} />
            </button>
          }
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Captcha onToken={setCaptcha} reinicio={reinicioCaptcha} />
        <Button
          type="submit"
          className="w-full"
          size="lg"
          loading={loading}
          icon={crear ? 'plus' : 'arrowRight'}
        >
          {crear
            ? loading
              ? 'Creando…'
              : 'Crear cuenta'
            : loading
              ? 'Ingresando…'
              : 'Iniciar sesión'}
        </Button>
      </form>
    </AuthShell>
  )
}
