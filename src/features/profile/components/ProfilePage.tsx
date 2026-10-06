import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import { Badge } from '@shared/components/ui/Badge'
import { Avatar } from '@shared/components/ui/Avatar'
import { Icon } from '@shared/components/ui/Icon'
import { Modal } from '@shared/components/ui/Modal'
import { PageHeader } from '@shared/components/ui/PageHeader'
import { SectionLabel } from '@shared/components/ui/Indicators'
import { NovedadesDialog } from '@shared/components/ui/NovedadesModal'
import { useAuth } from '@core/auth/hooks/useAuth'
import { useTheme } from '@core/theme/ThemeContext'
import { ACCENTS } from '@core/theme/apariencia'
import { SegmentedControl } from '@shared/components/ui/SegmentedControl'
import { supabase } from '@infrastructure/supabase/client'
import { profilesService } from '@infrastructure/supabase/profiles.service'
import { normalizeFullName } from '@shared/utils/name'
import { APP_VERSION, APP_VERSION_DATE } from '@shared/changelog'
import { useToast } from '@shared/components/ui/Toast'
import { cx } from '@shared/utils/cx'

// Avatares de emoji: se mantienen para quien ya eligio uno, pero el selector vive en un
// dialogo chico ("Cambiar avatar") en vez de una grilla de 41 emojis abierta en la pagina.
const EMOJI_OPTIONS = [
  '😀',
  '😎',
  '🤓',
  '🦊',
  '🐱',
  '🐶',
  '🦁',
  '🐯',
  '🐻',
  '🐼',
  '🐨',
  '🐙',
  '🦑',
  '🦀',
  '🐳',
  '🦄',
  '🐝',
  '🌸',
  '⭐',
  '🔥',
  '💡',
  '🚀',
  '💎',
  '🎯',
  '🛡️',
  '⚡',
  '🌟',
  '💪',
  '🧠',
  '👑',
  '🎸',
  '🎨',
  '🔧',
  '📊',
  '📈',
  '🗂️',
  '💬',
  '✅',
  '❌',
  '⚠️',
  '♻️',
]

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  jefatura: 'Jefatura',
  colaborador: 'Colaborador',
  invitado: 'Invitado',
}

// Lo que hace Lumix, como lista de texto (antes eran mosaicos con un emoji cada uno).
const CAPACIDADES: { title: string; desc: string }[] = [
  { title: 'Actividades', desc: 'Crea, asigna y gestiona tareas con lenguaje natural.' },
  { title: 'Minuta', desc: 'Dicta temas para la reunión semanal, con subtareas.' },
  {
    title: 'Proyectos',
    desc: 'Inicia iniciativas de varias semanas, con Lista, Tablero y Cronograma.',
  },
  { title: 'Bitácora', desc: 'Registra errores con severidad detectada automáticamente.' },
  { title: 'Consultas', desc: 'Pregunta por el estado del equipo, la carga o los pendientes.' },
  { title: 'Modificaciones', desc: 'Completa, mueve, reasigna o cambia prioridades.' },
  { title: 'Modo masivo', desc: 'Crea varias actividades de una vez desde una lista.' },
  { title: 'Alertas', desc: 'Detecta sobrecarga y avisa cuando alguien tiene mucho.' },
]

export function ProfilePage() {
  const { profile, user, signOut } = useAuth()
  const { preference, setPreference, accent, setAccent } = useTheme()
  const navigate = useNavigate()
  const toast = useToast()
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '')
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [avatarDraft, setAvatarDraft] = useState('')
  const [savingAvatar, setSavingAvatar] = useState(false)
  const [novedadesOpen, setNovedadesOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const saveProfile = async () => {
    if (!user) return
    setSaving(true)
    try {
      await profilesService.update(user.id, {
        full_name: normalizeFullName(fullName),
        avatar_url: avatarUrl || null,
      })
      toast.success('Perfil actualizado')
    } catch {
      toast.error('No se pudo guardar el perfil')
    } finally {
      setSaving(false)
    }
  }

  const openAvatar = () => {
    setAvatarDraft(avatarUrl)
    setAvatarOpen(true)
  }

  // El avatar se guarda al confirmar el dialogo (antes quedaba pendiente hasta tocar
  // "Guardar" en el nombre, y era facil perderlo).
  const saveAvatar = async () => {
    if (!user) return
    setSavingAvatar(true)
    try {
      await profilesService.update(user.id, { avatar_url: avatarDraft || null })
      setAvatarUrl(avatarDraft)
      setAvatarOpen(false)
      toast.success('Avatar actualizado')
    } catch {
      toast.error('No se pudo guardar el avatar')
    } finally {
      setSavingAvatar(false)
    }
  }

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    if (newPassword.length < 6) {
      setPasswordError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden')
      return
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setPasswordError(error.message)
    } else {
      setPasswordSuccess('Contraseña actualizada')
      setNewPassword('')
      setConfirmPassword('')
      setShowPassword(false)
    }
  }

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const nombre = profile?.full_name ?? 'Usuario'

  return (
    <div className="flex flex-col h-full bg-shell">
      <PageHeader title="Perfil" />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-3 sm:px-5 py-5 space-y-6">
          {/* Identidad */}
          <section className="flex flex-wrap items-center gap-4">
            <Avatar name={nombre} src={avatarUrl || null} size="lg" />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-semibold text-fg truncate">{profile?.full_name}</p>
                <Badge>{ROLE_LABELS[profile?.role ?? 'colaborador'] ?? profile?.role}</Badge>
              </div>
              <p className="text-sm text-fg-muted truncate">{profile?.email}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={openAvatar}>
              Cambiar avatar
            </Button>
          </section>

          {/* Datos personales */}
          <section className="space-y-2 pt-5 border-t border-border">
            <SectionLabel>Datos personales</SectionLabel>
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                void saveProfile()
              }}
            >
              <div className="flex-1">
                <Input
                  label="Nombre completo"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Tu nombre"
                  autoComplete="name"
                />
              </div>
              <Button type="submit" variant="secondary" loading={saving}>
                Guardar
              </Button>
            </form>
          </section>

          {/* Cambiar contrasena: plegada, se usa poco. */}
          <section className="pt-5 border-t border-border">
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-expanded={showPassword}
              className="w-full flex items-center justify-between text-left text-sm font-medium text-fg hover:text-accent"
            >
              Cambiar contraseña
              <Icon
                name="chevronDown"
                size={16}
                className={cx('text-fg-faint transition-transform', showPassword && 'rotate-180')}
              />
            </button>
            {passwordSuccess && !showPassword && (
              <p role="status" className="mt-2 text-sm text-success">
                {passwordSuccess}
              </p>
            )}

            {showPassword && (
              <form onSubmit={changePassword} className="mt-3 space-y-3 max-w-sm">
                {passwordError && (
                  <p
                    role="alert"
                    className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger"
                  >
                    {passwordError}
                  </p>
                )}
                <Input
                  label="Nueva contraseña"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
                <Input
                  label="Confirmar contraseña"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite la contraseña"
                />
                <Button type="submit">Actualizar contraseña</Button>
              </form>
            )}
          </section>

          {/* Apariencia: tema (claro por defecto desde el rediseno) y color de acento. */}
          <section className="space-y-3 pt-5 border-t border-border">
            <SectionLabel>Apariencia</SectionLabel>
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="w-14 text-xs text-fg-faint">Tema</span>
                <SegmentedControl
                  label="Tema"
                  value={preference}
                  onChange={setPreference}
                  options={[
                    { value: 'light', label: 'Claro' },
                    { value: 'dark', label: 'Oscuro' },
                    { value: 'system', label: 'Sistema' },
                  ]}
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="w-14 text-xs text-fg-faint">Acento</span>
                <div role="radiogroup" aria-label="Color de acento" className="flex gap-1.5">
                  {ACCENTS.map((a) => (
                    <button
                      key={a.value}
                      type="button"
                      role="radio"
                      aria-checked={accent === a.value}
                      onClick={() => setAccent(a.value)}
                      className={`inline-flex items-center gap-1.5 h-7 px-2 rounded-md border text-xs transition-colors ${
                        accent === a.value
                          ? 'border-fg text-fg'
                          : 'border-border-strong text-fg-muted hover:border-fg-faint'
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-sm"
                        style={{ background: a.swatch }}
                        aria-hidden="true"
                      />
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-xs text-fg-faint mt-3">Se guarda en este dispositivo.</p>
            <p className="text-xs text-fg-faint">Se guarda en este dispositivo.</p>
          </section>

          {/* Sobre Lumix: lista de texto, sin mosaicos de emoji. */}
          <section className="space-y-3 pt-5 border-t border-border">
            <SectionLabel>Sobre Lumix</SectionLabel>
            <p className="text-sm text-fg-muted leading-relaxed">
              Lumix transforma tus conversaciones en acciones. Escribe en lenguaje natural lo que
              necesitas y se encarga del resto. Escribe “ayuda” en el chat para ver ejemplos.
            </p>
            <dl className="grid grid-cols-1 sm:grid-cols-[8rem_1fr] gap-x-4 sm:gap-y-1.5 text-sm">
              {CAPACIDADES.map((c) => (
                <div key={c.title} className="contents">
                  <dt className="font-medium text-fg">{c.title}</dt>
                  <dd className="text-fg-muted mb-2 sm:mb-0">{c.desc}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
              <p className="text-xs text-fg-faint">
                Versión {APP_VERSION} · actualizada el {APP_VERSION_DATE}
              </p>
              <Button variant="ghost" size="xs" onClick={() => setNovedadesOpen(true)}>
                Ver novedades
              </Button>
            </div>
          </section>

          {/* Cerrar sesion: accion secundaria, no un bloque rojo a lo ancho. */}
          <section className="pt-5 border-t border-border">
            <Button
              variant="ghost"
              icon="logout"
              onClick={handleLogout}
              className="!text-danger hover:!bg-danger-soft"
            >
              Cerrar sesión
            </Button>
          </section>
        </div>
      </div>

      <Modal
        open={avatarOpen}
        onClose={() => setAvatarOpen(false)}
        title="Cambiar avatar"
        description="Tus iniciales o un emoji."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAvatarOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveAvatar} loading={savingAvatar}>
              Guardar
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setAvatarDraft('')}
            aria-pressed={!avatarDraft}
            className={cx(
              'w-full flex items-center gap-3 rounded-md border px-3 py-2 text-left text-sm',
              !avatarDraft
                ? 'border-accent bg-accent-soft text-fg'
                : 'border-border-strong text-fg-muted hover:bg-surface',
            )}
          >
            <Avatar name={nombre} size="sm" />
            Usar mis iniciales
          </button>
          <div role="group" aria-label="Emojis" className="grid grid-cols-8 gap-1">
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setAvatarDraft(emoji)}
                aria-pressed={avatarDraft === emoji}
                aria-label={`Avatar ${emoji}`}
                className={cx(
                  'h-9 flex items-center justify-center rounded-md text-lg transition-colors',
                  avatarDraft === emoji ? 'bg-accent-soft ring-2 ring-accent' : 'hover:bg-surface',
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </Modal>

      <NovedadesDialog open={novedadesOpen} onClose={() => setNovedadesOpen(false)} />
    </div>
  )
}
