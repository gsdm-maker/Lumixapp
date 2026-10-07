import { useEscapePrimero } from '@shared/hooks/useEscapePrimero'
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { cx } from '@shared/utils/cx'
import { Icon } from './Icon'
import { Button } from './Button'

interface Member {
  id: string
  full_name: string
}

interface Props {
  members: Member[]
  selected: string[]
  paraTodos: boolean
  onChange: (next: { responsables: string[]; para_todos: boolean }) => void
  className?: string
  // Minuta es un tema puntual: un solo responsable, no un reparto de tareas (eso es
  // Proyectos). Elegir a otra persona reemplaza, no suma.
  single?: boolean
}

const ANCHO = 256
const ALTO_MAX = 360

const TRIGGER =
  'w-full h-7 text-left rounded-md border border-border-strong bg-field px-2 text-sm text-fg-body hover:border-fg-faint truncate'

/** Casilla dibujada con el set de iconos (antes era un glifo ✓ dentro de un cuadrado). */
function Casilla({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'w-4 h-4 shrink-0 rounded-sm border flex items-center justify-center',
        on ? 'bg-accent-fill border-transparent text-on-accent' : 'border-border-strong bg-field',
      )}
    >
      {on && <Icon name="check" size={12} strokeWidth={2.5} />}
    </span>
  )
}

// Selector de responsables: cajita que abre un panel con checkboxes (o unico, si single).
// En escritorio el panel se ancla al boton; en el celular sale como hoja desde abajo. Va en
// position: fixed para que no lo recorte la tabla o el panel con overflow que lo contiene.
export function MemberMultiSelect({
  members,
  selected,
  paraTodos,
  onChange,
  className,
  single,
}: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<CSSProperties | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const label = paraTodos
    ? 'Todos'
    : selected.length === 0
      ? 'Sin asignar'
      : selected.length <= 2
        ? selected.map((id) => members.find((m) => m.id === id)?.full_name ?? '—').join(', ')
        : `${selected.length} personas`

  const abrir = () => {
    const r = triggerRef.current?.getBoundingClientRect()
    const movil = window.matchMedia('(max-width: 639px)').matches
    if (!r || movil) {
      setPos(null)
    } else {
      const left = Math.min(Math.max(8, r.left), window.innerWidth - ANCHO - 8)
      const cabeAbajo = r.bottom + 4 + ALTO_MAX <= window.innerHeight
      setPos(
        cabeAbajo ? { top: r.bottom + 4, left } : { bottom: window.innerHeight - r.top + 4, left },
      )
    }
    setOpen(true)
  }

  const cerrar = () => {
    setOpen(false)
    triggerRef.current?.focus({ preventScroll: true })
  }
  useEscapePrimero(open, cerrar)

  useLayoutEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true })
  }, [open])

  const toggleMember = (id: string) => {
    if (single) {
      onChange({ responsables: selected.includes(id) ? [] : [id], para_todos: false })
      cerrar()
      return
    }
    const next = selected.includes(id) ? selected.filter((r) => r !== id) : [...selected, id]
    onChange({ responsables: next, para_todos: false })
  }

  const opcion =
    'w-full flex items-center gap-2 h-9 sm:h-8 px-2 rounded-md hover:bg-surface text-left'

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={abrir}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={className ?? TRIGGER}
      >
        {label}
      </button>
      {open && (
        <div
          className={cx('fixed inset-0 z-[60]', !pos && 'flex items-end bg-black/40')}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) cerrar()
          }}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Responsables"
            style={pos ? { ...pos, width: ANCHO, maxHeight: ALTO_MAX } : undefined}
            onKeyDown={(e) => {
              // Escape cierra solo este selector, no el dialogo/panel que lo contiene.
              if (e.key === 'Escape') {
                e.stopPropagation()
                cerrar()
              }
            }}
            className={cx(
              'flex flex-col bg-panel border border-border-strong shadow-xl p-1.5',
              pos ? 'fixed rounded-lg' : 'w-full max-h-[70dvh] rounded-t-xl',
            )}
          >
            <p className="px-2 pt-1 pb-1.5 text-xs font-medium text-fg-faint">
              {single ? 'Responsable' : 'Responsables'}
            </p>

            <div className="flex-1 overflow-y-auto">
              <button
                type="button"
                role="checkbox"
                aria-checked={paraTodos}
                onClick={() => onChange({ responsables: [], para_todos: !paraTodos })}
                className={opcion}
              >
                <Casilla on={paraTodos} />
                <span className="text-sm font-medium text-fg">Todos</span>
              </button>

              <div className="h-px bg-border my-1" />

              {/* Si esta "Todos", se oculta la lista individual (es colectivo). */}
              {paraTodos ? (
                <p className="px-2 py-1.5 text-xs text-fg-faint">
                  Colectivo: aplica a todo el equipo. Desmarca “Todos” para elegir personas.
                </p>
              ) : (
                members.map((m) => {
                  const on = selected.includes(m.id)
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role={single ? 'radio' : 'checkbox'}
                      aria-checked={on}
                      onClick={() => toggleMember(m.id)}
                      className={opcion}
                    >
                      <Casilla on={on} />
                      <span className="text-sm text-fg-body truncate">{m.full_name}</span>
                    </button>
                  )
                })
              )}
            </div>

            <div
              className="flex justify-between gap-2 pt-1.5 mt-1 border-t border-border"
              style={pos ? undefined : { paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            >
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onChange({ responsables: [], para_todos: false })}
              >
                Limpiar
              </Button>
              <Button variant="ghost" size="xs" className="text-accent" onClick={cerrar}>
                Listo
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
