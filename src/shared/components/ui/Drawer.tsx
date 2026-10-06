import type { ReactNode } from 'react'
import { SidePanel } from './SidePanel'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

/**
 * @deprecated Usar <SidePanel>. Se mantiene para no romper importaciones viejas.
 *
 * Historia: este panel fue lateral, despues se volvio un dialogo centrado a pedido de
 * Sebastian, y con el rediseno 2026 (propuesta UI/UX, ideas 8 y 13, aprobada por el) vuelve a
 * ser lateral, ahora sin oscurecer la lista en escritorio.
 */
export function Drawer(props: DrawerProps) {
  return <SidePanel {...props} />
}
