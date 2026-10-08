import { useCallback, useEffect, useState } from 'react'

/**
 * Carga de una lista de la consola de administracion (personas, equipos, actividad), con
 * recarga despues de cada cambio. Siempre lee del servidor: la consola es poco usada y asi
 * nunca muestra un estado viejo.
 */
export function useCargaAdmin<T>(cargar: () => Promise<T[]>) {
  const [datos, setDatos] = useState<T[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const aplicar = useCallback(
    (p: Promise<T[]>, vigente: () => boolean = () => true) =>
      p
        .then((d) => {
          if (!vigente()) return
          setDatos(d)
          setError('')
        })
        .catch((e: Error) => vigente() && setError(e.message))
        .finally(() => vigente() && setCargando(false)),
    [],
  )

  useEffect(() => {
    let vigente = true
    void aplicar(cargar(), () => vigente)
    return () => {
      vigente = false
    }
  }, [cargar, aplicar])

  const recargar = useCallback(() => aplicar(cargar()), [cargar, aplicar])

  return { datos, cargando, error, recargar }
}
