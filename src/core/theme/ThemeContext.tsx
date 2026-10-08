import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  aplicarApariencia,
  guardarMenu,
  leerAcento,
  leerMenu,
  leerMenuNombres,
  leerPreferencia,
  resolverTema,
  type Accent,
  type PosicionMenu,
  type Theme,
  type ThemePreference,
} from './apariencia'

export type { Accent, PosicionMenu, Theme, ThemePreference }

interface ThemeContextValue {
  /** Lo que eligio la persona (incluye "sistema"). */
  preference: ThemePreference
  /** El tema que se esta mostrando de verdad. */
  theme: Theme
  accent: Accent
  setPreference: (p: ThemePreference) => void
  setAccent: (a: Accent) => void
  /** Donde va el menu de modulos en escritorio. */
  menu: PosicionMenu
  setMenu: (m: PosicionMenu) => void
  /** Menu lateral con los nombres de los modulos (si no, solo iconos). */
  menuNombres: boolean
  setMenuNombres: (v: boolean) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

/**
 * Tema y acento de la app.
 *
 * Claro es el default desde el rediseno 2026 (Lumix se usa de dia, en reuniones). La primera
 * aplicacion la hace public/tema-inicial.js antes de que cargue React, para que no haya un
 * destello del tema equivocado; este provider la mantiene sincronizada despues.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(leerPreferencia)
  const [accent, setAccent] = useState<Accent>(leerAcento)
  const [menu, setMenu] = useState<PosicionMenu>(leerMenu)
  const [menuNombres, setMenuNombres] = useState<boolean>(leerMenuNombres)
  const [sistemaOscuro, setSistemaOscuro] = useState(
    () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
  )

  // "Sistema" sigue al sistema operativo en vivo: cambiar el modo del celular se refleja sin
  // recargar.
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const onChange = (e: MediaQueryListEvent) => setSistemaOscuro(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const theme = resolverTema(preference, sistemaOscuro)

  useEffect(() => {
    aplicarApariencia(preference, theme, accent)
  }, [preference, theme, accent])

  useEffect(() => {
    guardarMenu(menu, menuNombres)
  }, [menu, menuNombres])

  return (
    <ThemeContext.Provider
      value={{
        preference,
        theme,
        accent,
        setPreference,
        setAccent,
        menu,
        setMenu,
        menuNombres,
        setMenuNombres,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme debe usarse dentro de ThemeProvider')
  return ctx
}
