import { useEffect, useRef } from 'react'
import { CAPTCHA_SITE_KEY } from '@core/auth/captcha'

// Captcha del registro y del ingreso (revision de seguridad, H5): Cloudflare Turnstile, gratis y
// casi siempre invisible. Se enciende poniendo VITE_TURNSTILE_SITE_KEY en el .env (y en Netlify)
// y activando el captcha en Supabase con su clave secreta; sin la variable, no se muestra nada y
// el ingreso funciona como siempre.

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

interface Turnstile {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string
      callback: (token: string) => void
      'expired-callback': () => void
      'error-callback': () => void
      language?: string
      theme?: 'auto' | 'light' | 'dark'
    },
  ) => string
  remove: (id: string) => void
  reset: (id: string) => void
}

declare global {
  interface Window {
    turnstile?: Turnstile
  }
}

/** Carga el script de Turnstile una sola vez. */
function cargarScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  const previo = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`)
  return new Promise((resolve, reject) => {
    const s = previo ?? document.createElement('script')
    s.addEventListener('load', () => resolve())
    s.addEventListener('error', () => reject(new Error('No se pudo cargar el captcha')))
    if (!previo) {
      s.src = SCRIPT
      s.async = true
      document.head.appendChild(s)
    }
  })
}

/**
 * El widget de Turnstile. Avisa el token cuando la persona pasa la verificacion (y null cuando
 * vence). `reinicio` cambia para pedir un token nuevo (cada token sirve una sola vez).
 */
export function Captcha({
  onToken,
  reinicio = 0,
}: {
  onToken: (token: string | null) => void
  reinicio?: number
}) {
  const caja = useRef<HTMLDivElement>(null)
  const id = useRef<string | null>(null)
  const avisar = useRef(onToken)
  useEffect(() => {
    avisar.current = onToken
  }, [onToken])

  useEffect(() => {
    if (!CAPTCHA_SITE_KEY) return
    let vigente = true
    cargarScript()
      .then(() => {
        if (!vigente || !caja.current || !window.turnstile) return
        id.current = window.turnstile.render(caja.current, {
          sitekey: CAPTCHA_SITE_KEY,
          language: 'es',
          theme: 'auto',
          callback: (t) => avisar.current(t),
          'expired-callback': () => avisar.current(null),
          'error-callback': () => avisar.current(null),
        })
      })
      .catch(() => avisar.current(null))
    return () => {
      vigente = false
      if (id.current && window.turnstile) window.turnstile.remove(id.current)
      id.current = null
    }
  }, [])

  useEffect(() => {
    if (reinicio && id.current && window.turnstile) {
      window.turnstile.reset(id.current)
      avisar.current(null)
    }
  }, [reinicio])

  if (!CAPTCHA_SITE_KEY) return null
  return <div ref={caja} className="flex justify-center" />
}
