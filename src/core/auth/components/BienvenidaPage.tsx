import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '@infrastructure/supabase/client'
import { useAuth } from '@core/auth/hooks/useAuth'
import { MODULOS, MODULOS_POR_DEFECTO, type Modulo } from '@core/auth/modulos'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import { Icon, type IconName } from '@shared/components/ui/Icon'
import { LumixIcon } from '@shared/components/ui/LumixIcon'
import { LoadingState } from '@shared/components/ui/Spinner'
import { cx } from '@shared/utils/cx'
import { AuthMessage } from './AuthShell'

type Tipo = 'personal' | 'empresa'

/**
 * Bienvenida de quien recien crea su cuenta (migracion 056): elige si Lumix es para el o para su
 * empresa, le pone nombre a la empresa y elige los modulos. Al terminar se crea su espacio (con
 * la persona como Lider de la primera unidad, y como Admin si es una empresa) y empieza la
 * prueba de 15 dias. Todo se puede cambiar despues.
 */
export function BienvenidaPage() {
  const { user, profile, loading, recargar } = useAuth()
  const navigate = useNavigate()
  const [paso, setPaso] = useState<1 | 2 | 3>(1)
  const [tipo, setTipo] = useState<Tipo | null>(null)
  const [nombre, setNombre] = useState('')
  const [modulos, setModulos] = useState<Modulo[]>(MODULOS_POR_DEFECTO)
  const [error, setError] = useState('')
  const [creando, setCreando] = useState(false)

  if (loading)
    return (
      <div className="min-h-dvh flex items-center justify-center bg-shell">
        <LoadingState label="Cargando…" />
      </div>
    )
  if (!user) return <Navigate to="/login" replace />
  // Ya tiene su espacio (o es el Owner): nada que configurar.
  if (profile?.empresa_id || profile?.es_owner) return <Navigate to="/entrar" replace />

  const pasos = tipo === 'empresa' ? 3 : 2
  const numero = tipo === 'personal' && paso === 3 ? 2 : paso
  const primerNombre = (profile?.full_name ?? '').split(' ')[0]

  const elegirTipo = (t: Tipo) => {
    setTipo(t)
    setError('')
    setPaso(t === 'empresa' ? 2 : 3)
  }

  const alternar = (m: Modulo) =>
    setModulos((ms) => (ms.includes(m) ? ms.filter((x) => x !== m) : [...ms, m]))

  const empezar = async () => {
    if (!tipo) return
    setError('')
    setCreando(true)
    const { error: err } = await supabase.rpc('crear_mi_espacio', {
      p_tipo: tipo,
      p_nombre: tipo === 'empresa' ? nombre.trim() : '',
      p_modulos: MODULOS.map((m) => m.key).filter((k) => modulos.includes(k)),
    })
    if (err) {
      setCreando(false)
      setError(err.message)
      return
    }
    await recargar()
    navigate('/entrar', { replace: true })
  }

  return (
    // La app bloquea el scroll del body (index.css): la Bienvenida trae el suyo, y en pantallas
    // bajas el contenido parte arriba en vez de centrarse y cortarse.
    <div className="h-dvh overflow-y-auto fondo-orbita">
      <div className="min-h-full flex items-center justify-center p-4">
        <main className="w-full max-w-2xl">
          <div className="flex flex-col items-center text-center mb-6">
            <LumixIcon size="lg" />
            <h1 className="text-2xl font-semibold text-fg mt-4">
              Bienvenido{primerNombre ? `, ${primerNombre}` : ''}
            </h1>
            <p className="text-sm text-fg-muted mt-1">
              Configura Lumix en un minuto. Tienes 15 días de prueba y todo se puede cambiar
              después.
            </p>
            {tipo && (
              <p className="mt-3 text-xs font-semibold text-fg-faint">
                Paso {numero} de {pasos}
              </p>
            )}
          </div>

          <div className="vidrio rounded-3xl p-5 sm:p-6">
            {error && <AuthMessage tone="error">{error}</AuthMessage>}

            {paso === 1 && (
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-fg">¿Para quién es Lumix?</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Opcion
                    icon="user"
                    titulo="Para mí"
                    texto="Organizo mi propio trabajo. Sin jerarquía ni equipo que administrar."
                    onClick={() => elegirTipo('personal')}
                  />
                  <Opcion
                    icon="users"
                    titulo="Para mi empresa o equipo"
                    texto="Quedo como Admin: armo la estructura (gerencias, áreas, equipos) y sumo a mi gente."
                    onClick={() => elegirTipo('empresa')}
                  />
                </div>
              </section>
            )}

            {paso === 2 && (
              <form
                className="space-y-4"
                noValidate
                onSubmit={(e) => {
                  e.preventDefault()
                  if (nombre.trim().length < 2) return setError('Escribe el nombre de la empresa.')
                  setError('')
                  setPaso(3)
                }}
              >
                <h2 className="text-lg font-semibold text-fg">Tu empresa</h2>
                <Input
                  label="Nombre de la empresa o equipo"
                  placeholder="Ej.: Comercial Andes"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  maxLength={80}
                  autoFocus
                />
                <p className="text-sm text-fg-muted">
                  Parte con los niveles{' '}
                  <b className="text-fg">Gerencia › Subgerencia › Área › Equipo</b>. Los cambias
                  después en Administración → Estructura, igual que las unidades y la gente.
                </p>
                <div className="flex justify-between gap-2 pt-2">
                  <Button variant="ghost" type="button" onClick={() => setPaso(1)}>
                    Atrás
                  </Button>
                  <Button type="submit">Siguiente</Button>
                </div>
              </form>
            )}

            {paso === 3 && (
              <section className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-fg">¿Qué quieres usar?</h2>
                  <p className="text-sm text-fg-muted">
                    El chat con Lumix siempre está. Marca lo demás según lo que necesites.
                  </p>
                </div>
                <ul className="grid gap-2 sm:grid-cols-2">
                  <li className="flex items-start gap-3 rounded-lg border border-border bg-shell p-3">
                    <Icon name="chat" size={18} className="mt-0.5 text-accent" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-fg">Chat con Lumix</p>
                      <p className="text-xs text-fg-muted">
                        Siempre incluido: le hablas y Lumix registra.
                      </p>
                    </div>
                  </li>
                  {MODULOS.map((m) => {
                    const on = modulos.includes(m.key)
                    return (
                      <li key={m.key}>
                        <label
                          className={cx(
                            'flex h-full cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                            on ? 'border-accent bg-accent-soft' : 'border-border hover:bg-surface',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => alternar(m.key)}
                            className="mt-1 h-4 w-4 accent-accent"
                          />
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 text-sm font-semibold text-fg">
                              <Icon name={m.icon} size={15} className="text-fg-muted" />
                              {m.label}
                            </p>
                            <p className="text-xs text-fg-muted">{m.descripcion}</p>
                          </div>
                        </label>
                      </li>
                    )
                  })}
                </ul>
                {tipo === 'empresa' && (
                  <p className="text-xs text-fg-muted">
                    Después puedes elegir módulos distintos para cada área en Administración →
                    Estructura (por ejemplo, Ingestas solo para el equipo de datos).
                  </p>
                )}
                {/* Fija abajo: con muchos modulos la lista es larga y el boton no debe perderse. */}
                <div className="sticky bottom-0 -mx-5 -mb-5 flex justify-between gap-2 rounded-b-3xl border-t border-border bg-panel px-5 py-3 sm:-mx-6 sm:-mb-6 sm:px-6">
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => setPaso(tipo === 'empresa' ? 2 : 1)}
                  >
                    Atrás
                  </Button>
                  <Button loading={creando} onClick={() => void empezar()}>
                    Empezar mi prueba de 15 días
                  </Button>
                </div>
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

function Opcion({
  icon,
  titulo,
  texto,
  onClick,
}: {
  icon: IconName
  titulo: string
  texto: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-2 rounded-lg border border-border p-4 text-left transition-colors hover:border-accent hover:bg-accent-soft"
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft">
        <Icon name={icon} size={18} className="text-accent" />
      </span>
      <span className="text-sm font-semibold text-fg">{titulo}</span>
      <span className="text-xs text-fg-muted">{texto}</span>
    </button>
  )
}
