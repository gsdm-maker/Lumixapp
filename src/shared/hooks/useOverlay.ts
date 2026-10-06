import { useEffect, useLayoutEffect, useRef } from 'react'

// Pila de capas abiertas (dialogos, paneles), la ultima es la de arriba. Escape solo cierra esa:
// sin la pila, cada capa escuchaba keydown en `document` y un Escape cerraba todas juntas (ej.
// confirmar "Eliminar" desde el panel lateral cerraba tambien el panel). stopPropagation no
// alcanza porque todos los listeners viven en el mismo nodo.
const pila: symbol[] = []

// Cuantas capas pidieron bloquear el scroll: el fondo se libera recien cuando cierra la ultima
// (antes, cerrar un dialogo anidado liberaba el scroll aunque el de abajo siguiera abierto).
let bloqueos = 0

/**
 * Comportamiento comun de toda capa superpuesta (dialogo, panel lateral):
 *  - Escape cierra solo la capa de mas arriba.
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
    const id = Symbol('capa')
    pila.push(id)
    const previo = document.activeElement as HTMLElement | null

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || pila[pila.length - 1] !== id) return
      e.stopPropagation()
      onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    if (lockScroll) {
      bloqueos += 1
      document.body.style.overflow = 'hidden'
    }

    // El primer elemento enfocable, o el contenedor mismo.
    const el = containerRef.current
    const enfocable = el?.querySelector<HTMLElement>(
      'input:not([type=hidden]), textarea, select, button:not([data-overlay-close]), [href], [tabindex]:not([tabindex="-1"])',
    )
    ;(enfocable ?? el)?.focus({ preventScroll: true })

    return () => {
      document.removeEventListener('keydown', onKey)
      const i = pila.indexOf(id)
      if (i >= 0) pila.splice(i, 1)
      if (lockScroll) {
        bloqueos = Math.max(0, bloqueos - 1)
        if (bloqueos === 0) document.body.style.overflow = ''
      }
      previo?.focus?.({ preventScroll: true })
    }
  }, [open, lockScroll])

  return containerRef
}
