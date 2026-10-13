import { useCallback, useEffect, useState } from 'react'

/** La mejor voz en espanol disponible: primero de Chile, despues Latinoamerica, despues Espana. */
function vozEspanol(): SpeechSynthesisVoice | undefined {
  const voces = window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith('es'))
  const orden = ['es-cl', 'es-419', 'es-mx', 'es-us', 'es-ar', 'es-co', 'es-es']
  for (const lang of orden) {
    const v = voces.find((x) => x.lang.toLowerCase() === lang)
    if (v) return v
  }
  return voces[0]
}

/**
 * Voz de Lumix con la sintesis del navegador (gratis, sin internet, sin pasar por la IA).
 * hablar() lee un texto; detener() lo corta. Si el navegador no tiene voz, `disponible` es false.
 */
export function useVozLumix() {
  const disponible = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [hablando, setHablando] = useState(false)

  // Al salir de la pantalla, Lumix se calla.
  useEffect(() => {
    if (!disponible) return
    return () => window.speechSynthesis.cancel()
  }, [disponible])

  const detener = useCallback(() => {
    if (!disponible) return
    window.speechSynthesis.cancel()
    setHablando(false)
  }, [disponible])

  const hablar = useCallback(
    (texto: string) => {
      if (!disponible) return
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(texto)
      const voz = vozEspanol()
      if (voz) u.voice = voz
      u.lang = voz?.lang ?? 'es-CL'
      u.rate = 1.02
      u.onend = () => setHablando(false)
      u.onerror = () => setHablando(false)
      setHablando(true)
      window.speechSynthesis.speak(u)
    },
    [disponible],
  )

  return { disponible, hablando, hablar, detener }
}
