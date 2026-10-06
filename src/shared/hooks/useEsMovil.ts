import { useSyncExternalStore } from 'react'

// true debajo de `sm` (640px). Para cuando la vista movil y la de escritorio no pueden estar
// montadas a la vez y esconderlas con `sm:hidden` no alcanza. Caso real: Planificacion, donde
// las dos vistas registran zonas de arrastre (dnd-kit) con los mismos ids y una soltaria sobre
// la oculta.
const QUERY = '(max-width: 639px)'

function suscribir(cb: () => void) {
  const mq = window.matchMedia(QUERY)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

export function useEsMovil(): boolean {
  return useSyncExternalStore(
    suscribir,
    () => window.matchMedia(QUERY).matches,
    () => false,
  )
}
