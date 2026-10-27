import { createContext, useContext } from 'react'

/**
 * Puente entre la barra lateral (AppLayout) y la pantalla que quiere mostrar algo en ella.
 *
 * La barra lateral tiene el boton flotante "Mi semana": al tocarlo esconde los modulos y abre un
 * espacio (`ranura`) donde la pantalla dibuja su panel con un portal. Asi los datos siguen
 * viviendo en la pantalla (el chat) y la barra no necesita saber nada de ellos. "Volver al
 * menu", Escape o cambiar de pagina devuelven los modulos.
 */
export interface PanelLateral {
  /** Hay barra lateral en escritorio (la persona no eligio el menu arriba). */
  disponible: boolean
  abierto: boolean
  alternar: () => void
  cerrar: () => void
  /** Donde la pantalla dibuja su panel; null mientras esta cerrado. */
  ranura: HTMLElement | null
}

export const PanelLateralContext = createContext<PanelLateral>({
  disponible: false,
  abierto: false,
  alternar: () => {},
  cerrar: () => {},
  ranura: null,
})

export const usePanelLateral = () => useContext(PanelLateralContext)
