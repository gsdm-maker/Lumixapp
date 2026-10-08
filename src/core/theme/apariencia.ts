// Preferencias de apariencia (tema + acento) y como se aplican al documento.
//
// Separado del contexto de React para poder probarlo y para que public/tema-inicial.js use
// exactamente las mismas claves y valores (ese archivo no puede importar TypeScript: si se
// cambia algo aca, cambiarlo tambien alla).

export type Theme = 'light' | 'dark'
export type ThemePreference = Theme | 'system'
export type Accent = 'violeta' | 'petroleo' | 'indigo' | 'azul'

/** Opciones de acento que se ofrecen en Perfil. El valor debe existir en index.css. */
export const ACCENTS: { value: Accent; label: string; swatch: string }[] = [
  { value: 'violeta', label: 'Violeta', swatch: 'rgb(97 59 231)' },
  { value: 'petroleo', label: 'Petróleo', swatch: 'rgb(11 107 114)' },
  { value: 'indigo', label: 'Índigo', swatch: 'rgb(79 70 229)' },
  { value: 'azul', label: 'Azul', swatch: 'rgb(37 99 235)' },
]

// Claves nuevas a proposito: la clave vieja ('lumix-theme') quedo en "dark" para TODOS, porque
// la version anterior la escribia en cada carga aunque nadie hubiera elegido. Con la vieja, el
// nuevo default claro nunca le llegaba a nadie.
export const STORAGE_TEMA = 'lumix-tema'
// Rediseno Orbita (oct 2026): clave nueva para que todos partan en el violeta del diseno nuevo;
// quien quiera otro acento lo vuelve a elegir en Perfil.
export const STORAGE_ACENTO = 'lumix-acento-orbita'

// Color de la barra del navegador/PWA por tema (el fondo del encabezado).
const THEME_COLOR: Record<Theme, string> = { light: '#f3f0ff', dark: '#0b0b12' }

function leer(clave: string): string | null {
  try {
    return window.localStorage.getItem(clave)
  } catch {
    return null
  }
}

function guardar(clave: string, valor: string) {
  try {
    window.localStorage.setItem(clave, valor)
  } catch {
    /* navegacion privada o almacenamiento bloqueado: la preferencia dura la sesion */
  }
}

export function leerPreferencia(): ThemePreference {
  const v = leer(STORAGE_TEMA)
  return v === 'dark' || v === 'system' ? v : 'light'
}

export function leerAcento(): Accent {
  const v = leer(STORAGE_ACENTO)
  return ACCENTS.some((a) => a.value === v) ? (v as Accent) : 'violeta'
}

export function resolverTema(preference: ThemePreference, sistemaOscuro: boolean): Theme {
  if (preference === 'system') return sistemaOscuro ? 'dark' : 'light'
  return preference
}

export function aplicarApariencia(preference: ThemePreference, theme: Theme, accent: Accent) {
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  root.setAttribute('data-accent', accent)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
  guardar(STORAGE_TEMA, preference)
  guardar(STORAGE_ACENTO, accent)
}
