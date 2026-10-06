import { useEffect, useLayoutEffect, useRef } from 'react'

/**
 * Comportamiento comun de toda capa superpuesta (dialogo, panel lateral):
 *  - Escape cierra.
 *  - Bloquea el scroll del fondo mientras esta abierta (solo si `lockScroll`).
 *  - Mueve el foco adentro al abrir y lo devuelve a donde estaba al cerrar, para que el
 *    teclado y los lectores de pantalla no queden "detras" de la capa.
 */
export function useOverlay(
  open: boolean,
  onClose: () => void,
  { lockScroll = true }: { lockScroll?: boolean } = {},
) {
  const containerRef = useRef<HTMLDivElement>(null)
  // onClose suele ser una funcion nueva en cada render: se lee desde un ref para no re-armar
  // los listeners (y robar el foco) en cada render del padre.
  const onCloseRef = useRef(onClose)
  useLayoutEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const previo = document.activeElement as HTMLElement | null

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
      }
    }
    document.addEventListener('keydown', onKey)
    if (lockScroll) document.body.style.overflow = 'hidden'

    // El primer elemento enfocable, o el contenedor mismo.
    const el = containerRef.current
    const enfocable = el?.querySelector<HTMLElement>(
      'input:not([type=hidden]), textarea, select, button:not([data-overlay-close]), [href], [tabindex]:not([tabindex="-1"])',
    )
    ;(enfocable ?? el)?.focus({ preventScroll: true })

    return () => {
      document.removeEventListener('keydown', onKey)
      if (lockScroll) document.body.style.overflow = ''
      previo?.focus?.({ preventScroll: true })
    }
  }, [open, lockScroll])

  return containerRef
}
