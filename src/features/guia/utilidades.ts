import { TAG, type TagColor } from '@shared/utils/colores'
import type { SeccionGuia } from '@features/guia/contenido'

// Ayudas de las guias (Lumix y consola): colores de los iconos y busqueda sin tildes.

export const colorIcono = (c?: TagColor | 'accent') =>
  c === 'accent' ? 'text-accent' : c ? TAG[c].text : 'text-fg-muted'
export const fondoIcono = (c?: TagColor | 'accent') =>
  c === 'accent' ? 'bg-accent-soft' : c ? TAG[c].soft : 'bg-surface'

/** Minusculas y sin tildes: "planificacion" encuentra "Planificación". */
export const normalizar = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')

export const textoDe = (s: SeccionGuia) =>
  normalizar(
    [
      s.titulo,
      s.resumen,
      ...s.acciones.flatMap((a) => [a.t, a.d]),
      ...(s.reglas ?? []),
      ...(s.permisos ?? []),
      ...(s.consejos ?? []),
    ].join(' '),
  )
