import type { ReactNode } from 'react'
import { Nucleo } from '@shared/components/ui/Nucleo'
import { Icon, type IconName } from '@shared/components/ui/Icon'
import { DemoConversacion } from './DemoConversacion'

const BENEFICIOS: { icon: IconName; titulo: string; texto: string }[] = [
  {
    icon: 'chat',
    titulo: 'Registra conversando',
    texto: 'Escribe lo que pasó o lo que hay que hacer; Lumix lo deja como actividad.',
  },
  {
    icon: 'calendar',
    titulo: 'Ve la carga de tu semana',
    texto: 'Quién tiene qué y cuándo, sin sobrecargar a nadie.',
  },
  {
    icon: 'handshake',
    titulo: 'Cumple lo comprometido',
    texto: 'Minuta, compromisos y atrasos a la vista de todo el equipo.',
  },
]

/**
 * Marco de las pantallas de acceso (ingresar, crear cuenta, cambio de clave, prueba terminada)
 * con el lenguaje del rediseno Orbita: fondo con halo, nucleo de Lumix y tarjeta de vidrio. En
 * pantallas anchas, a la izquierda va la marca (que es Lumix y como se usa) y a la derecha el
 * formulario; en el celular, solo el nucleo y el formulario.
 */
export function AuthShell({
  title,
  subtitle,
  overline,
  children,
  footer,
}: {
  title: ReactNode
  subtitle?: ReactNode
  overline?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    // La app bloquea el scroll del body (index.css): este marco trae el suyo, para que en una
    // pantalla baja (celular apaisado) el formulario no quede cortado.
    <div className="h-dvh overflow-y-auto fondo-orbita">
      <div className="min-h-full grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* Marca: solo en pantallas anchas. Se compacta por ALTURA, no solo por ancho: un
            notebook de 14" suele ser ancho pero bajo, y con el bloque completo habia que hacer
            scroll. La demostracion animada se mantiene siempre (es lo que explica el producto);
            en pantallas bajas se achica el titular y, si hace falta, se sueltan los beneficios. */}
        <aside className="hidden lg:flex flex-col justify-between gap-8 p-8 2xl:p-12">
          <div className="flex items-center gap-2.5">
            <Nucleo size={26} />
            <span className="text-lg font-extrabold tracking-tight text-fg">Lumix</span>
          </div>

          <div className="max-w-lg">
            <h2 className="text-4xl 2xl:text-5xl font-extrabold leading-[1.05] tracking-tight text-fg [@media(max-height:820px)]:text-3xl">
              Le hablas.
              <br />
              Lumix organiza.
            </h2>
            <p className="mt-3 text-base text-fg-muted [@media(max-height:820px)]:text-sm">
              El sistema operativo conversacional para tu trabajo y el de tu equipo.
            </p>

            <ul className="mt-6 space-y-4 [@media(max-height:760px)]:hidden">
              {BENEFICIOS.map((b) => (
                <li key={b.titulo} className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft">
                    <Icon name={b.icon} size={17} className="text-accent" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-fg">{b.titulo}</span>
                    <span className="block text-sm text-fg-muted">{b.texto}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-6">
              <DemoConversacion />
            </div>
          </div>

          <p className="text-xs text-fg-faint">15 días de prueba · sin tarjeta</p>
        </aside>

        {/* Formulario */}
        <div className="flex items-center justify-center p-4 sm:p-8">
          <main className="w-full max-w-sm">
            <div className="flex flex-col items-center text-center mb-6 lg:items-start lg:text-left animate-aparecer [@media(max-height:700px)]:mb-4">
              <span className="lg:hidden">
                <Nucleo size={56} flotar label="Lumix" />
              </span>
              {overline && <span className="etiqueta-orbita mb-2">{overline}</span>}
              <h1 className="mt-5 lg:mt-0 text-2xl font-extrabold tracking-tight text-fg">
                {title}
              </h1>
              {subtitle && <p className="text-sm text-fg-muted mt-1">{subtitle}</p>}
            </div>
            <div
              className="vidrio rounded-3xl p-6 animate-aparecer [@media(max-height:700px)]:p-5"
              style={{ animationDelay: '60ms' }}
            >
              {children}
            </div>
            {footer && (
              <div className="text-sm text-fg-muted text-center mt-5 lg:text-left [@media(max-height:700px)]:mt-4">
                {footer}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

/** Mensaje de error o de exito de un formulario de acceso. */
export function AuthMessage({
  tone,
  children,
}: {
  tone: 'error' | 'success'
  children: ReactNode
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={
        tone === 'error'
          ? 'mb-4 rounded-xl bg-danger-soft px-3 py-2.5 text-sm text-danger flex items-start gap-2.5 animate-aparecer'
          : 'mb-4 rounded-xl bg-success-soft px-3 py-2.5 text-sm text-success flex items-start gap-2.5 animate-aparecer'
      }
    >
      <Icon
        name={tone === 'error' ? 'alert' : 'checkCircle'}
        size={16}
        className="mt-0.5 shrink-0"
      />
      <span>{children}</span>
    </div>
  )
}
