// Boton para instalar Lumix como aplicacion.
//
// LO QUE SE PUEDE Y LO QUE NO
//
// En Chrome, Edge y Android el navegador avisa con `beforeinstallprompt` que la app se
// puede instalar. Ese evento se guarda y se dispara desde nuestro propio boton: un clic y
// queda instalada, sin pasos manuales.
//
// En iPhone NO existe esa posibilidad. Safari no deja instalar por codigo -es una decision
// de Apple- asi que ahi lo unico honesto es mostrar las instrucciones. Se detecta iOS y se
// explica el gesto exacto en vez de ofrecer un boton que no haria nada.
//
// Si ya esta instalada, no se muestra nada: `display-mode: standalone` indica que la app
// esta corriendo fuera del navegador.

import { useEffect, useState } from 'react'
import { Icon } from './Icon'

/** El evento no esta en los tipos estandar de TypeScript porque no es de todos los navegadores. */
interface PromptDeInstalacion extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const yaInstalada = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  // iOS marca las apps agregadas a inicio con esta propiedad, fuera del estandar.
  (window.navigator as unknown as { standalone?: boolean }).standalone === true

const esIOS = () =>
  /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
  // iPadOS se declara como Mac; se distingue porque tiene pantalla tactil.
  (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1)

// Enlace discreto al pie de la barra lateral: es una accion de una vez, no debe competir con
// la navegacion.
const BOTON =
  'w-full inline-flex items-center gap-1.5 h-7 text-xs text-fg-muted hover:text-accent text-left transition-colors'

export function InstalarApp({ className = '' }: { className?: string }) {
  const [evento, setEvento] = useState<PromptDeInstalacion | null>(null)
  // Se calcula al montar y no dentro del efecto: asi no hay un primer render con el valor
  // equivocado ni un re-render extra. La app es solo cliente, window siempre existe.
  const [instalada, setInstalada] = useState(yaInstalada)
  const [verPasosIOS, setVerPasosIOS] = useState(false)

  useEffect(() => {
    const alPoderInstalar = (e: Event) => {
      e.preventDefault() // sin esto Chrome muestra su propio aviso y perdemos el control
      setEvento(e as PromptDeInstalacion)
    }
    const alInstalar = () => {
      setInstalada(true)
      setEvento(null)
    }

    window.addEventListener('beforeinstallprompt', alPoderInstalar)
    window.addEventListener('appinstalled', alInstalar)
    return () => {
      window.removeEventListener('beforeinstallprompt', alPoderInstalar)
      window.removeEventListener('appinstalled', alInstalar)
    }
  }, [])

  if (instalada) return null

  const instalar = async () => {
    if (!evento) return
    await evento.prompt()
    const { outcome } = await evento.userChoice
    // El evento sirve UNA sola vez: si lo rechaza, el navegador lo volvera a ofrecer solo.
    setEvento(null)
    if (outcome === 'accepted') setInstalada(true)
  }

  // iPhone / iPad: no hay instalacion por codigo, solo se puede explicar.
  if (esIOS()) {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => setVerPasosIOS((v) => !v)}
          aria-expanded={verPasosIOS}
          className={BOTON}
        >
          <Icon name="install" size={14} />
          Instalar Lumix
        </button>
        {verPasosIOS && (
          <div className="mt-1.5 rounded-md bg-surface border border-border p-2 text-xs text-fg-muted leading-relaxed">
            <p className="text-fg mb-1">En iPhone se agrega desde Safari:</p>
            <p>
              1. Toca <span className="font-medium text-fg">Compartir</span> (el cuadrado con la
              flecha, abajo)
            </p>
            <p>
              2. Elige <span className="font-medium text-fg">Agregar a inicio</span>
            </p>
            <p>
              3. Toca <span className="font-medium text-fg">Agregar</span>
            </p>
            <p className="mt-1 text-fg-faint">Solo funciona en Safari, no en Chrome.</p>
          </div>
        )}
      </div>
    )
  }

  // Android / escritorio: sin el evento no hay nada que ofrecer, asi que no se muestra un
  // boton que fallaria. El navegador lo dispara cuando la app cumple los requisitos.
  if (!evento) return null

  return (
    <button type="button" onClick={instalar} className={`${BOTON} ${className}`}>
      <Icon name="install" size={14} />
      Instalar Lumix
    </button>
  )
}
