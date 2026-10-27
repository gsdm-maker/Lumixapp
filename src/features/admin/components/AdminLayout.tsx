import { useEffect } from 'react'
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  adminService,
  empresaFoco,
  type EmpresaAdmin,
} from '@infrastructure/supabase/admin.service'
import { Select } from '@shared/components/ui/Input'
import { useCargaAdmin, useEmpresaFoco } from '../hooks/useAdmin'
import { useAuth } from '@core/auth/hooks/useAuth'
import { Icon, type IconName } from '@shared/components/ui/Icon'
import { Button } from '@shared/components/ui/Button'
import { LumixIcon } from '@shared/components/ui/LumixIcon'
import { cx } from '@shared/utils/cx'

type Seccion = { to: string; label: string; icon: IconName; end?: boolean }

const SECCIONES: Seccion[] = [
  { to: '/admin', label: 'Personas', icon: 'users', end: true },
  { to: '/admin/estructura', label: 'Estructura', icon: 'layers' },
  { to: '/admin/actividad', label: 'Actividad', icon: 'historial' },
  { to: '/admin/guia', label: 'Guía', icon: 'guia' },
]

/** Solo para el Admin de una empresa: el estado y los pagos de SU suscripcion (el Owner los ve en Empresas). */
const SECCION_SUSCRIPCION: Seccion = {
  to: '/admin/suscripcion',
  label: 'Suscripción',
  icon: 'pago',
}

/** Solo para el Owner de la plataforma: crear empresas y nombrar su Admin. */
const SECCION_OWNER: Seccion = { to: '/admin/empresas', label: 'Empresas', icon: 'database' }

/** Lo que la consola comparte con sus paginas (useOutletContext). */
export type ContextoAdmin = { recargarEmpresas: () => void }

/** Lista de empresas para el selector del Owner (un Admin no la pide: no puede). */
const sinEmpresas = () => Promise.resolve([] as EmpresaAdmin[])

/**
 * Consola de administracion: separada de la app de trabajo, con su propio menu y una franja
 * que deja claro que se esta en modo administracion. Para el Admin de cada empresa (ve solo
 * la suya) y el Owner de la plataforma (elige en que empresa trabaja y ve "Empresas"). A
 * cualquier otra persona la manda al chat (y aunque entrara, la Edge Function rechaza todo:
 * esto es orden, no la seguridad).
 */
export function AdminLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const esOwner = profile?.es_owner === true
  const foco = useEmpresaFoco()
  const empresas = useCargaAdmin<EmpresaAdmin>(esOwner ? adminService.listarEmpresas : sinEmpresas)

  // Un Admin siempre trabaja en su empresa: si el navegador recordaba otra (de una sesion de
  // Owner), se olvida.
  useEffect(() => {
    if (profile && !esOwner && foco) empresaFoco.set(null)
  }, [profile, esOwner, foco])

  if (!profile) return null
  if (profile.role !== 'admin' && !esOwner) return <Navigate to="/chat" replace />

  const secciones = esOwner ? [SECCION_OWNER, ...SECCIONES] : [...SECCIONES, SECCION_SUSCRIPCION]
  const enFoco =
    empresas.datos.find((e) => e.id === foco) ?? empresas.datos.find((e) => e.esMia) ?? null

  const salir = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    // Alto fijo y scroll adentro de <main>: la app bloquea el scroll del body (index.css).
    <div className="h-dvh flex flex-col overflow-hidden fondo-orbita text-fg-body">
      <a
        href="#contenido-admin"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[90] focus:rounded-full focus:bg-panel focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-fg focus:shadow-lg"
      >
        Saltar al contenido
      </a>

      {/* Franja de modo: siempre a la vista, para no confundir la consola con la app. */}
      <div className="flex items-center gap-2 px-4 sm:px-6 h-9 bg-fg text-shell text-xs font-semibold">
        <Icon name="shield" size={14} />
        Modo administración
        <span className="hidden sm:inline font-normal opacity-75">
          {esOwner && enFoco
            ? `· trabajando en ${enFoco.nombre}`
            : '· los cambios aplican a toda tu empresa'}
        </span>
      </div>

      <header className="flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-border">
        <LumixIcon size="sm" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg leading-tight">Administración</p>
          <p className="text-xs text-fg-faint truncate">{profile.full_name}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {esOwner && empresas.datos.length > 0 && (
            <Select
              size="sm"
              aria-label="Empresa en la que trabajas"
              value={enFoco?.id ?? ''}
              onChange={(e) => {
                const id = e.target.value
                empresaFoco.set(empresas.datos.find((x) => x.id === id)?.esMia ? null : id)
              }}
              className="w-48"
            >
              {empresas.datos.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                  {e.esMia ? ' (tuya)' : ''}
                </option>
              ))}
            </Select>
          )}
          <Button variant="secondary" size="sm" icon="arrowLeft" onClick={() => navigate('/chat')}>
            Volver a Lumix
          </Button>
          <Button variant="ghost" size="sm" icon="logout" onClick={salir}>
            <span className="hidden sm:inline">Cerrar sesión</span>
            <span className="sr-only sm:hidden">Cerrar sesión</span>
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        <nav
          aria-label="Secciones de administración"
          className="shrink-0 flex md:flex-col gap-1 md:overflow-y-auto px-3 py-2 md:p-4 md:w-56 border-b md:border-b-0 md:border-r border-border overflow-x-auto"
        >
          {secciones.map((s) => (
            <NavLink
              key={s.to}
              to={s.to}
              end={s.end}
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-2.5 h-10 px-3 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
                  isActive
                    ? 'bg-panel text-fg shadow-sm'
                    : 'text-fg-muted hover:text-fg hover:bg-surface',
                )
              }
            >
              <Icon name={s.icon} size={17} />
              {s.label}
            </NavLink>
          ))}
        </nav>

        <main
          id="contenido-admin"
          tabIndex={-1}
          className="flex-1 min-w-0 min-h-0 overflow-y-auto overscroll-contain outline-none"
        >
          {/* Al cambiar de empresa, cada pagina se monta de nuevo y lee la elegida. */}
          <Outlet
            key={foco ?? 'propia'}
            context={{ recargarEmpresas: empresas.recargar } satisfies ContextoAdmin}
          />
        </main>
      </div>
    </div>
  )
}
