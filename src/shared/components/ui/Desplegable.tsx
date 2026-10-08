import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useOverlay } from '@shared/hooks/useOverlay'
import { cx } from '@shared/utils/cx'

interface DesplegableProps {
  /** Contenido del boton que abre. */
  boton: ReactNode
  /** Nombre del boton para lectores de pantalla (si `boton` no tiene texto). */
  label?: string
  botonClassName?: string
  /** Lado al que se alinea el panel (cuando se abre hacia abajo). */
  alinear?: 'izquierda' | 'derecha'
  /** Hacia donde se abre: abajo (menu superior) o al costado (menu lateral, desde abajo). */
  abrirHacia?: 'abajo' | 'izquierda' | 'derecha'
  panelClassName?: string
  /** Recibe `cerrar` para que una opcion cierre el menu al elegirse. */
  children: (cerrar: () => void) => ReactNode
}

/**
 * Panel desplegable (menu de la persona, cambio de equipo). Patron "boton que despliega" de
 * WAI-ARIA, no role="menu": adentro hay de todo (textos, selectores, enlaces) y se recorre con Tab
 * como cualquier contenido. Se cierra con Escape (respetando la pila de capas), con un clic afuera,
 * al salir con Tab y al elegir una opcion.
 */
export function Desplegable({
  boton,
  label,
  botonClassName,
  alinear = 'derecha',
  abrirHacia = 'abajo',
  panelClassName,
  children,
}: DesplegableProps) {
  const [abierto, setAbierto] = useState(false)
  const cerrar = () => setAbierto(false)
  const panelRef = useOverlay(abierto, cerrar, { lockScroll: false })
  const raizRef = useRef<HTMLDivElement>(null)
  const id = useId()

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => {
      if (!raizRef.current?.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierto])

  return (
    <div
      ref={raizRef}
      className="relative"
      // El foco salio del boton y del panel (Tab): se cierra, para no dejarlo abierto atras.
      onBlur={(e) => {
        if (abierto && !raizRef.current?.contains(e.relatedTarget as Node | null)) setAbierto(false)
      }}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={abierto}
        aria-controls={id}
        onClick={() => setAbierto((a) => !a)}
        className={botonClassName}
      >
        {boton}
      </button>
      {abierto && (
        <div
          ref={panelRef}
          id={id}
          tabIndex={-1}
          className={cx(
            'absolute z-50 min-w-56 rounded-2xl border border-border bg-panel p-1.5 shadow-lg outline-none animate-in fade-in-0 zoom-in-95 duration-150',
            abrirHacia === 'izquierda'
              ? 'bottom-0 right-full mr-3 origin-bottom-right'
              : abrirHacia === 'derecha'
                ? 'bottom-0 left-full ml-3 origin-bottom-left'
                : alinear === 'derecha'
                  ? 'top-full mt-2 right-0 origin-top-right'
                  : 'top-full mt-2 left-0 origin-top-left',
            panelClassName,
          )}
        >
          {children(cerrar)}
        </div>
      )}
    </div>
  )
}

/** Opcion de un Desplegable: una fila clickeable. */
export function OpcionMenu({
  children,
  onClick,
  peligro,
  className,
}: {
  children: ReactNode
  onClick: () => void
  peligro?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'w-full flex items-center gap-2.5 min-h-10 px-3 rounded-xl text-sm text-left transition-colors',
        peligro ? 'text-danger hover:bg-danger-soft' : 'text-fg hover:bg-surface',
        className,
      )}
    >
      {children}
    </button>
  )
}
