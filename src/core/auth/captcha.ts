/** Clave publica de Cloudflare Turnstile. Vacia = captcha apagado (revision de seguridad, H5). */
export const CAPTCHA_SITE_KEY =
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? ''
