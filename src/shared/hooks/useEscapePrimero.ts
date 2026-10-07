import { useEffect, useLayoutEffect, useRef } from 'react'

/**
 * Escape cierra ESTE popover antes que nadie (calendario, selector de personas), aunque este
 * dentro de un dialogo de Radix. Radix escucha Escape en `document` en fase de captura; la unica
 * forma de llegar antes es escuchar en `window` en captura y detener el evento ahi. Sin esto,
 * un Escape en el calendario cerraba tambien el dialogo que lo contenia.
 */
export function useEscapePrimero(open: boolean, onClose: () => void) {
  const cb = useRef(onClose)
  useLayoutEffect(() => {
    cb.current = onClose
  })
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      e.preventDefault()
      cb.current()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])
}
