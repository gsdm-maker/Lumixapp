import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, type IconName } from '@shared/components/ui/Icon'
import { InstalarApp } from '@shared/components/ui/InstalarApp'
import { OpcionMenu } from '@shared/components/ui/Desplegable'
import { useAuth } from '@core/auth/hooks/useAuth'
import { useTheme, type PosicionMenu } from '@core/theme/ThemeContext'
import { ROLE_LABEL } from '@core/auth/roles'
import { cx } from '@shared/utils/cx'
import { useEquipos } from './useEquipos'
import { LogroRacha } from './LogroRacha'

const POSICION_ICONO: { value: PosicionMenu; label: string; icon: IconName }[] = [
  { value: 'izquierda', label: 'Menú a la izquierda', icon: 'menuIzquierda' },
  { value: 'arriba', label: 'Menú arriba', icon: 'menuArriba' },
  { value: 'derecha', label: 'Menú a la derecha', icon: 'menuDerecha' },
]

/**
 * Contenido del menu de la persona (avatar). El equipo se cambia con el selector a la vista
 * (SelectorEquipo), no aca. Contenido: rol y equipo, logro, perfil, guia, equipos, consola de
 * administracion (solo admin),
 * WhatsApp (pronto), donde va el menu, instalar y cerrar sesion. Lo usan el menu superior y el
 * lateral.
 */
export function MenuPersona({ cerrar }: { cerrar: () => void }) {
  const { profile, teamRole, signOut } = useAuth()
  const { equipoActual } = useEquipos()
  const { menu, setMenu } = useTheme()
  const navigate = useNavigate()
  const isAdmin = profile?.role === 'admin'

  const ir = (ruta: string) => {
    navigate(ruta)
    cerrar()
  }
  const salir = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <>
      <div className="px-3 pt-2 pb-2.5 border-b border-border mb-1.5">
        <p className="text-sm font-semibold text-fg truncate">{profile?.full_name}</p>
        <p className="text-xs text-fg-faint">
          {ROLE_LABEL[isAdmin ? 'admin' : (teamRole ?? profile?.role ?? '')] ?? 'Colaborador'}
          {equipoActual ? ` · ${equipoActual.name}` : ''}
        </p>
      </div>
      <LogroRacha />
      <OpcionMenu onClick={() => ir('/profile')}>
        <Icon name="user" size={17} className="text-fg-faint" />
        Mi perfil y apariencia
      </OpcionMenu>
      <OpcionMenu onClick={() => ir('/guia')}>
        <Icon name="guia" size={17} className="text-fg-faint" />
        Guía de Lumix
      </OpcionMenu>
      <OpcionMenu onClick={() => ir('/teams')}>
        <Icon name="users" size={17} className="text-fg-faint" />
        Equipos
      </OpcionMenu>
      {isAdmin && (
        <OpcionMenu onClick={() => ir('/admin')}>
          <Icon name="shield" size={17} className="text-fg-faint" />
          Administración
        </OpcionMenu>
      )}

      {/* Acceso rapido: donde va el menu (lo mismo que en Perfil > Apariencia). */}
      <div className="flex items-center gap-2.5 min-h-10 px-3 text-sm text-fg">
        <Icon name="layers" size={17} className="text-fg-faint" />
        Menú
        <div
          role="group"
          aria-label="Posición del menú"
          className="ml-auto flex gap-0.5 rounded-full bg-surface p-[3px]"
        >
          {POSICION_ICONO.map((p) => (
            <button
              key={p.value}
              type="button"
              aria-pressed={menu === p.value}
              aria-label={p.label}
              title={p.label}
              onClick={() => setMenu(p.value)}
              className={cx(
                'w-7 h-7 rounded-full grid place-items-center transition-colors',
                menu === p.value ? 'bg-panel text-fg shadow-sm' : 'text-fg-faint hover:text-fg',
              )}
            >
              <Icon name={p.icon} size={15} />
            </button>
          ))}
        </div>
      </div>

      <div
        className="flex items-center gap-2.5 min-h-10 px-3 rounded-xl text-sm text-tag-green"
        title="Muy pronto: avisos y órdenes a Lumix por WhatsApp"
      >
        <Icon name="chat" size={17} />
        Lumix por WhatsApp
        <span className="ml-auto text-2xs font-semibold px-2 py-0.5 rounded-full bg-tag-green-soft">
          pronto
        </span>
      </div>
      <InstalarApp className="px-3" />
      <div className="h-px bg-border my-1.5 mx-2" />
      <OpcionMenu peligro onClick={salir}>
        <Icon name="logout" size={17} />
        Cerrar sesión
      </OpcionMenu>
    </>
  )
}

/** Boton redondo de vidrio (buscar, tema, notificaciones). */
export function BotonRedondo({
  label,
  onClick,
  activo,
  className,
  children,
}: {
  label: string
  onClick: () => void
  activo?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cx(
        'vidrio relative w-10 h-10 rounded-full grid place-items-center transition-colors',
        activo ? 'text-accent' : 'text-fg-muted hover:text-fg',
        className,
      )}
    >
      {children}
    </button>
  )
}

/** Contador de notificaciones sobre la campana. */
export function ContadorNoLeidas({ n }: { n: number }) {
  if (n <= 0) return null
  return (
    <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 inline-flex items-center justify-center rounded-full bg-danger-fill text-on-accent text-2xs font-bold ring-2 ring-shell">
      {n > 99 ? '99+' : n}
    </span>
  )
}
