import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useOverlay } from '@shared/hooks/useOverlay'
import { cx } from '@shared/utils/cx'

interface DesplegableProps {
  /** Contenido del boton que abre. */
  boton: ReactNode
  /** Nombre del boton para lectores de pantalla (si `boton` no tiene texto). */
  label?: string
  botonClassName?: string
  /** Lado al que se alinea el panel. */
  alinear?: 'izquierda' | 'derecha'
  panelClassName?: string
  /** Recibe `cerrar` para que una opcion cierre el menu al elegirse. */
  children: (cerrar: () => void) => ReactNode
}

/**
 * Menu desplegable simple (menu de usuario, "Mas" del menu superior). Se cierra con Escape
 * (respetando la pila de capas: si hay un dialogo encima, cierra el dialogo primero), con un clic
 * afuera y al elegir una opcion.
 */
export function Desplegable({
  boton,
  label,
  botonClassName,
  alinear = 'derecha',
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
    <div ref={raizRef} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
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
          role="menu"
          tabIndex={-1}
          className={cx(
            'absolute top-full mt-2 z-50 min-w-56 rounded-2xl border border-border bg-panel p-1.5 shadow-lg outline-none animate-in fade-in-0 zoom-in-95 duration-150',
            alinear === 'derecha' ? 'right-0 origin-top-right' : 'left-0 origin-top-left',
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
      role="menuitem"
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
