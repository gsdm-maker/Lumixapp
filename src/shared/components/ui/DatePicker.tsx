import { useEscapePrimero } from '@shared/hooks/useEscapePrimero'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { cx } from '@shared/utils/cx'
import { Icon } from './Icon'
import { Button, IconButton } from './Button'

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]
const DIAS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']

const pad = (n: number) => String(n).padStart(2, '0')
const toYMD = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`

// Ancho y alto aproximado del calendario, para decidir si cabe bajo el boton o va arriba.
const ANCHO = 280
const ALTO = 340

interface Props {
  value: string | null // YYYY-MM-DD
  onChange: (value: string | null) => void
  placeholder?: string
  className?: string
}

const TRIGGER =
  'h-7 px-2 rounded-md border border-border-strong bg-field text-sm text-fg hover:border-fg-faint'

// Selector de fecha propio, siempre en español y formato DD-MM-AAAA (independiente del
// idioma del navegador, que es lo que rompe el <input type="date"> nativo).
//
// En escritorio el calendario se ancla al boton (antes tapaba toda la pantalla con un fondo
// negro para elegir un dia); en el celular sale como hoja desde abajo, al alcance del pulgar.
// Va en position: fixed calculada desde el boton para que no lo recorte una tabla o un panel
// con overflow.
export function DatePicker({ value, onChange, placeholder = 'Seleccionar', className }: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<CSSProperties | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const sel = value
    ? { y: +value.slice(0, 4), m: +value.slice(5, 7) - 1, d: +value.slice(8, 10) }
    : null
  const today = new Date()
  const [view, setView] = useState<{ y: number; m: number }>(
    sel ? { y: sel.y, m: sel.m } : { y: today.getFullYear(), m: today.getMonth() },
  )

  const label = sel ? `${pad(sel.d)}-${pad(sel.m + 1)}-${sel.y}` : placeholder

  const firstDow = (new Date(view.y, view.m, 1).getDay() + 6) % 7 // lunes = 0
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const prev = () => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))
  const next = () => setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }))

  const openPicker = () => {
    if (sel) setView({ y: sel.y, m: sel.m })
    const r = triggerRef.current?.getBoundingClientRect()
    const movil = window.matchMedia('(max-width: 639px)').matches
    if (!r || movil) {
      setPos(null)
    } else {
      const left = Math.min(Math.max(8, r.left), window.innerWidth - ANCHO - 8)
      const cabeAbajo = r.bottom + 4 + ALTO <= window.innerHeight
      setPos(
        cabeAbajo ? { top: r.bottom + 4, left } : { bottom: window.innerHeight - r.top + 4, left },
      )
    }
    setOpen(true)
  }

  const close = () => {
    setOpen(false)
    triggerRef.current?.focus({ preventScroll: true })
  }
  useEscapePrimero(open, close)

  const pick = (v: string | null) => {
    onChange(v)
    close()
  }

  // Al abrir, el foco va al dia elegido (o al de hoy) para poder seguir con el teclado.
  useLayoutEffect(() => {
    if (!open) return
    const el = panelRef.current
    const destino =
      el?.querySelector<HTMLElement>('[aria-pressed="true"]') ??
      el?.querySelector<HTMLElement>('[aria-current="date"]') ??
      el?.querySelector<HTMLElement>('button')
    destino?.focus({ preventScroll: true })
  }, [open])

  // Si cambia el tamano de la ventana, la posicion calculada ya no sirve: se cierra.
  useEffect(() => {
    if (!open) return
    const onResize = () => setOpen(false)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openPicker}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cx(
          'inline-flex items-center gap-1.5 whitespace-nowrap transition-colors',
          className ?? TRIGGER,
          !sel && !className && 'text-fg-faint',
        )}
      >
        <Icon name="calendar" size={14} className="text-fg-faint" />
        {label}
      </button>
      {open && (
        <div
          className={cx('fixed inset-0 z-[60]', !pos && 'flex items-end bg-black/40')}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close()
          }}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Elegir fecha"
            style={pos ? { ...pos, width: ANCHO } : undefined}
            onKeyDown={(e) => {
              // Escape cierra solo el calendario: se detiene aca para que no cierre tambien el
              // dialogo o panel que lo contiene (esos escuchan Escape en document).
              if (e.key === 'Escape') {
                e.stopPropagation()
                close()
              }
            }}
            className={cx(
              'bg-panel border border-border-strong shadow-xl p-3',
              pos ? 'fixed rounded-lg' : 'w-full rounded-t-xl',
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <IconButton icon="chevronLeft" label="Mes anterior" size="xs" onClick={prev} />
              <span className="text-sm font-medium text-fg capitalize" aria-live="polite">
                {MESES[view.m]} {view.y}
              </span>
              <IconButton icon="chevronRight" label="Mes siguiente" size="xs" onClick={next} />
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-2xs text-fg-faint mb-1">
              {DIAS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((d, i) => {
                if (d === null) return <span key={i} />
                const elegido = !!sel && sel.y === view.y && sel.m === view.m && sel.d === d
                const esHoy =
                  today.getFullYear() === view.y &&
                  today.getMonth() === view.m &&
                  today.getDate() === d
                return (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={elegido}
                    aria-current={esHoy ? 'date' : undefined}
                    aria-label={`${d} de ${MESES[view.m]} de ${view.y}`}
                    onClick={() => pick(toYMD(view.y, view.m, d))}
                    className={cx(
                      'h-9 sm:h-8 rounded-md text-sm sm:text-xs tabular-nums transition-colors',
                      elegido
                        ? 'bg-accent-fill text-on-accent font-semibold'
                        : esHoy
                          ? 'bg-accent-soft text-accent font-medium'
                          : 'text-fg-body hover:bg-surface',
                    )}
                  >
                    {d}
                  </button>
                )
              })}
            </div>
            <div
              className="flex justify-between mt-3 pt-2 border-t border-border"
              style={pos ? undefined : { paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            >
              <Button variant="ghost" size="xs" onClick={() => pick(null)}>
                Limpiar
              </Button>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  const t = new Date()
                  pick(toYMD(t.getFullYear(), t.getMonth(), t.getDate()))
                }}
              >
                Hoy
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
