import { useEffect, useState } from 'react'
import { Nucleo } from '@shared/components/ui/Nucleo'
import { Icon } from '@shared/components/ui/Icon'
import { cx } from '@shared/utils/cx'

/**
 * Duracion (ms) de cada paso del ciclo:
 * 0 limpio · 1 mensaje de la persona · 2 Lumix pensando · 3 respuesta · 4 actividad creada
 */
const DURACION = [500, 1400, 1100, 900, 2600]

/** Sigue la preferencia del sistema de reducir movimiento. */
function useReducedMotion() {
  const [reducido, setReducido] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  )
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const onChange = () => setReducido(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reducido
}

/**
 * Ejemplo animado de Lumix en el acceso: un mensaje se convierte en una actividad, en bucle.
 * Es decorativo (quien lo usa lo marca aria-hidden) y con prefers-reduced-motion se muestra el
 * estado final sin animar, para no distraer ni marea a quien lo pidio.
 */
export function DemoConversacion() {
  const reducido = useReducedMotion()
  const [pasoAnimado, setPasoAnimado] = useState(0)
  // Con movimiento reducido se salta directo al estado final, sin animar.
  const paso = reducido ? DURACION.length - 1 : pasoAnimado

  useEffect(() => {
    if (reducido) return
    // Avanza solo cuando termina el paso actual; al llegar al final, vuelve a empezar.
    const t = window.setTimeout(
      () => setPasoAnimado((p) => (p + 1) % DURACION.length),
      DURACION[pasoAnimado],
    )
    return () => window.clearTimeout(t)
  }, [pasoAnimado, reducido])

  const visible = (n: number) =>
    paso >= n ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'

  return (
    <div className="vidrio rounded-3xl p-4" aria-hidden="true">
      <div className="space-y-3">
        {/* Mensaje de la persona */}
        <div
          className={cx(
            'flex justify-end transition-all duration-500 ease-out motion-reduce:transition-none',
            visible(1),
          )}
        >
          <p className="w-fit max-w-[85%] rounded-2xl rounded-br-md bg-accent-fill px-3.5 py-2 text-sm text-on-accent">
            Mañana reviso los indicadores con Bruno
          </p>
        </div>

        {/* Lumix piensa (late) y responde */}
        <div
          className={cx(
            'flex items-end gap-2 transition-all duration-500 ease-out motion-reduce:transition-none',
            visible(2),
          )}
        >
          <Nucleo size={22} pensando={paso === 2} />
          <p
            className={cx(
              'max-w-[85%] rounded-2xl rounded-bl-md bg-panel px-3.5 py-2 text-sm text-fg transition-opacity duration-500 motion-reduce:transition-none',
              paso >= 3 ? 'opacity-100' : 'opacity-0',
            )}
          >
            Listo: creé «Revisar indicadores» para mañana, a cargo de Bruno.
          </p>
        </div>

        {/* Lo que el mensaje dejo: la actividad */}
        <div
          className={cx(
            'transition-all duration-500 ease-out motion-reduce:transition-none',
            visible(4),
          )}
        >
          <div className="rounded-xl border border-border bg-panel p-3">
            <div className="flex items-center gap-2">
              <Icon name="circleCheck" size={16} className="text-accent" />
              <span className="text-sm font-semibold text-fg">Revisar indicadores</span>
            </div>
            <div className="mt-2 flex items-center gap-2 pl-6">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent-soft text-2xs font-semibold text-accent">
                B
              </span>
              <span className="text-xs text-fg-muted">Bruno</span>
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-2xs font-medium text-accent">
                Mañana
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
