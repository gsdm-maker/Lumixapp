import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { navItems } from './navItems'
import { NovedadesModal } from '@shared/components/ui/NovedadesModal'
import { IconButton } from '@shared/components/ui/Button'
import { LumixIcon } from '@shared/components/ui/LumixIcon'
import { useAppHeight } from '@shared/hooks/useAppHeight'
import { useAuth } from '@core/auth/hooks/useAuth'
import { cx } from '@shared/utils/cx'

export function AppLayout() {
  const [menuAbierto, setMenuAbierto] = useState(false)
  const { pathname } = useLocation()
  const { profile } = useAuth()
  useAppHeight()

  // Titulo de la seccion en el encabezado movil (en escritorio lo da la barra lateral).
  const seccion =
    navItems.find((i) => pathname.startsWith(i.to))?.label ??
    (pathname.startsWith('/admin')
      ? 'Administración'
      : pathname.startsWith('/profile')
        ? 'Perfil'
        : 'Lumix')

  return (
    <div
      className="flex bg-shell text-fg-body"
      // position: fixed + top/height tomados en vivo de visualViewport (useAppHeight): el
      // layout pinta siempre donde el navegador dice que esta lo visible. Arregla el salto de
      // la parte de arriba al cerrar el teclado en iOS (ver useAppHeight.ts).
      style={{
        position: 'fixed',
        top: 'var(--app-top, 0px)',
        left: 0,
        width: '100%',
        height: 'var(--app-height, 100dvh)',
      }}
    >
      <NovedadesModal />

      {menuAbierto && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMenuAbierto(false)}
        />
      )}

      {/* Barra lateral: fija en escritorio, deslizable en movil. Corte en md (768px): un
          notebook con escalado de Windows al 125-150% reporta ~900-1100px logicos, y con lg
          caia del lado movil. */}
      <div
        className={cx(
          'fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-out md:relative md:translate-x-0',
          menuAbierto ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <Sidebar onClose={() => setMenuAbierto(false)} />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="md:hidden shrink-0 flex items-center gap-2 px-2 border-b border-border bg-panel"
          style={{
            height: 'calc(3rem + env(safe-area-inset-top))',
            paddingTop: 'env(safe-area-inset-top)',
          }}
        >
          <IconButton
            icon="menu"
            label="Abrir menú"
            size="md"
            onClick={() => setMenuAbierto(true)}
          />
          <LumixIcon size="sm" />
          <span className="text-sm font-semibold text-fg truncate">{seccion}</span>
        </header>

        {/* key = equipo activo: al cambiar de equipo (sin recargar) la pantalla se vuelve a
            montar y ningun hook queda con datos del equipo anterior. */}
        <main className="flex-1 overflow-hidden" key={profile?.team_id ?? 'sin-equipo'}>
          <Outlet />
        </main>

        <BottomNav onMore={() => setMenuAbierto(true)} />
      </div>
    </div>
  )
}
