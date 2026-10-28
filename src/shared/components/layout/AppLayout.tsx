import { useMemo, useState } from 'react'
import { useOverlay } from '@shared/hooks/useOverlay'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { AvisoSuscripcion } from './AvisoSuscripcion'
import { MenuLateral } from './MenuLateral'
import { useTheme } from '@core/theme/ThemeContext'
import { BottomNav } from './BottomNav'
import { navItems } from './navItems'
import { NovedadesModal } from '@shared/components/ui/NovedadesModal'
import { CommandPalette } from './CommandPalette'
import { IconButton } from '@shared/components/ui/Button'
import { LumixIcon } from '@shared/components/ui/LumixIcon'
import { useAppHeight } from '@shared/hooks/useAppHeight'
import { useAuth } from '@core/auth/hooks/useAuth'
import { cx } from '@shared/utils/cx'
import { PanelLateralContext, type PanelLateral } from './panelLateral'

export function AppLayout() {
  const [menuAbierto, setMenuAbierto] = useState(false)
  // Abierto: Escape lo cierra y el foco entra y vuelve (useOverlay). Cerrado: `inert`, asi el
  // teclado no entra a enlaces que no se ven.
  const menuRef = useOverlay(menuAbierto, () => setMenuAbierto(false))
  const { pathname } = useLocation()
  const { profile } = useAuth()
  const { menu } = useTheme()
  useAppHeight()

  // "Mi semana" en la barra lateral (ver panelLateral.ts). Se guarda en que pagina se abrio: al
  // cambiar de pagina queda cerrado solo, sin un efecto que lo cierre.
  const [semanaEn, setSemanaEn] = useState<string | null>(null)
  const [ranura, setRanura] = useState<HTMLElement | null>(null)
  const disponible = menu !== 'arriba'
  const semanaAbierta = disponible && semanaEn === pathname
  const panelLateral = useMemo<PanelLateral>(
    () => ({
      disponible,
      abierto: semanaAbierta,
      alternar: () => setSemanaEn(semanaAbierta ? null : pathname),
      cerrar: () => setSemanaEn(null),
      ranura: semanaAbierta ? ranura : null,
    }),
    [disponible, semanaAbierta, pathname, ranura],
  )

  // Titulo de la seccion en el encabezado movil (en escritorio lo da la barra lateral).
  const seccion =
    navItems.find((i) => pathname.startsWith(i.to))?.label ??
    (pathname.startsWith('/admin')
      ? 'Administración'
      : pathname.startsWith('/profile')
        ? 'Perfil'
        : 'Lumix')

  return (
    <PanelLateralContext.Provider value={panelLateral}>
      <div
        className="flex fondo-orbita text-fg-body"
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
        {/* Saltar al contenido (WCAG 2.4.1): primer elemento enfocable, visible solo con teclado. */}
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[90] focus:rounded-full focus:bg-panel focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-fg focus:shadow-lg"
        >
          Saltar al contenido
        </a>
        <NovedadesModal />
        <CommandPalette />

        {menuAbierto && (
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setMenuAbierto(false)}
          />
        )}

        {/* Menu lateral: solo en el celular (deslizable, se abre con "Mas"). En escritorio manda el
          menu superior (TopBar). Corte en md (768px): un notebook con escalado de Windows al
          125-150% reporta ~900-1100px logicos, y con lg caia del lado movil. */}
        <div
          ref={menuRef}
          id="menu-movil"
          role="dialog"
          aria-modal={menuAbierto}
          aria-label="Menú"
          inert={!menuAbierto}
          className={cx(
            'fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-out md:hidden',
            menuAbierto ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <Sidebar onClose={() => setMenuAbierto(false)} />
        </div>

        {/* Escritorio: el menu de modulos va donde la persona eligio (Perfil > Apariencia). */}
        {menu !== 'arriba' && <MenuLateral lado={menu} onRanura={setRanura} />}

        <div className="flex-1 flex flex-col min-w-0">
          {/* Menu arriba: barra superior. Menu al costado: buscar, tema, notificaciones y la
              persona van en la barra lateral, y el contenido usa todo el alto. */}
          {menu === 'arriba' && <TopBar />}
          <header
            className="md:hidden shrink-0 flex items-center gap-2 px-2 border-b border-border vidrio"
            style={{
              height: 'calc(3rem + env(safe-area-inset-top))',
              paddingTop: 'env(safe-area-inset-top)',
            }}
          >
            <IconButton
              icon="menu"
              label="Abrir menú"
              aria-expanded={menuAbierto}
              aria-controls="menu-movil"
              size="md"
              onClick={() => setMenuAbierto(true)}
            />
            <LumixIcon size="sm" />
            <span className="text-sm font-semibold text-fg truncate">{seccion}</span>
          </header>

          <AvisoSuscripcion />

          {/* key = equipo activo: al cambiar de equipo (sin recargar) la pantalla se vuelve a
            montar y ningun hook queda con datos del equipo anterior. */}
          <main
            id="contenido"
            tabIndex={-1}
            className="flex-1 overflow-hidden outline-none"
            key={profile?.team_id ?? 'sin-equipo'}
          >
            <Outlet />
          </main>

          <BottomNav onMore={() => setMenuAbierto(true)} />
        </div>
      </div>
    </PanelLateralContext.Provider>
  )
}
