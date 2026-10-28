import { useEffect, useMemo, useState, type RefObject } from 'react'
import type { ReplyTarget } from '@features/chat/types'
import type { Member } from '@features/chat/hooks/useChatMessages'
import { Button } from '@shared/components/ui/Button'
import { Icon } from '@shared/components/ui/Icon'
import { TIPO_ESTILO } from '@features/chat/components/composer/tipos'
import { Spinner } from '@shared/components/ui/Spinner'
import { cx } from '@shared/utils/cx'
import { QuotedMessage } from '@features/chat/components/QuotedMessage'
import {
  TIPO_LABEL,
  vistaPrevia,
  type Campo,
  type TipoMensaje,
} from '@features/chat/components/composer/vistaPrevia'

interface Props {
  inputRef: RefObject<HTMLTextAreaElement | null>
  /** Tipos que esta persona puede forzar (mismo filtro de permisos que los chips de antes). */
  tipos: TipoMensaje[]
  /** false si no se pudo enviar: el texto queda en el campo para reintentar. */
  onSend: (text: string, tipo: TipoMensaje) => Promise<boolean | void>
  sending: boolean
  aiProcessing: boolean
  bulkParsing: boolean
  replyTo: ReplyTarget | null
  onCancelReply: () => void
  onTyping: () => void
  /** Roster para adelantar a quien se asigna. Vacio = no se adelanta persona. */
  members: Member[]
  /** Tipo elegido. Vive en ChatPage para que el panel lateral ("Crear rapido") lo pueda fijar. */
  tipo: TipoMensaje
  onTipoChange: (t: TipoMensaje) => void
  /** Texto para dejar en el campo (sugerencias del panel); `n` cambia en cada pedido. */
  prellenar?: { texto: string; n: number }
}

const COMANDO_RE = /^\/(\p{L}+)\s+/u

/**
 * Campo del chat. El tipo se elige con los botones a la vista (grises, sin colores) o con un
 * comando al inicio ("/error ..."), y bajo el campo se adelanta lo que Lumix va a entender, para
 * corregir antes de enviar y no despues con otra pregunta.
 */
export function Composer({
  inputRef,
  tipos,
  onSend,
  sending,
  aiProcessing,
  bulkParsing,
  replyTo,
  onCancelReply,
  onTyping,
  members,
  tipo,
  onTipoChange: setTipo,
  prellenar,
}: Props) {
  const [input, setInput] = useState('')
  const [menuIdx, setMenuIdx] = useState(0)
  const [menuCerrado, setMenuCerrado] = useState(false)
  // No se pudo enviar el ultimo mensaje: se avisa y el texto sigue en el campo (Nielsen 9).
  const [fallo, setFallo] = useState(false)

  // Una sugerencia del panel deja su texto en el campo: enviar sigue siendo decision tuya, igual
  // que las preguntas del inicio del chat (mismo gesto en los dos lugares).
  useEffect(() => {
    if (!prellenar) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- el pedido llega desde afuera
    setInput(prellenar.texto)
    inputRef.current?.focus()
  }, [prellenar, inputRef])

  // Si cambian los permisos (cambio de equipo sin recargar) y el tipo elegido ya no esta
  // permitido, se vuelve a Auto en vez de enviar con un tipo prohibido.
  const tipoVigente = tipos.includes(tipo) ? tipo : 'auto'

  const busy = sending || aiProcessing || bulkParsing

  // Comando a medio escribir ("/er"): se ofrecen los que calzan.
  const parcial = /^\/(\S*)$/.exec(input)
  const sugerencias =
    parcial && !menuCerrado ? tipos.filter((t) => t.startsWith(parcial[1].toLowerCase())) : []
  const idx = Math.min(menuIdx, Math.max(sugerencias.length - 1, 0))

  const elegir = (t: TipoMensaje) => {
    setTipo(t)
    setInput('')
    setMenuIdx(0)
    inputRef.current?.focus()
  }

  const handleChange = (value: string) => {
    setMenuCerrado(false)
    // "/error se cayo el reporte": el comando fija el tipo y sale del texto, que es lo que
    // llega a Lumix. Solo cuenta si es un tipo permitido; si no, el texto queda tal cual.
    const cmd = COMANDO_RE.exec(value)
    const t = cmd?.[1].toLowerCase() as TipoMensaje | undefined
    if (cmd && t && tipos.includes(t)) {
      setTipo(t)
      setInput(value.slice(cmd[0].length))
    } else {
      setInput(value)
    }
    onTyping()
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || busy) return
    setFallo(false)
    const ok = await onSend(text, tipoVigente)
    if (ok === false) {
      setFallo(true)
      return
    }
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (sugerencias.length > 0) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const d = e.key === 'ArrowDown' ? 1 : -1
        setMenuIdx((idx + d + sugerencias.length) % sugerencias.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        elegir(sugerencias[idx])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setMenuCerrado(true)
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Crece con el contenido: con rows={1} fijo, un mensaje de mas de una linea quedaba con
  // scroll interno apenas visible -"se pierde de vista lo que estamos escribiendo", bug real
  // reportado por Sebastian probando en el celular-. Tope en ~6 lineas (160px) para que no se
  // coma toda la pantalla si alguien pega un texto largo.
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [input, inputRef])

  const preview = useMemo(
    () =>
      tipoVigente === 'masivo' || tipoVigente === 'error'
        ? {}
        : vistaPrevia(input, members, { personas: members.length > 0 }),
    [input, members, tipoVigente],
  )
  const campos: Campo[] = [
    ...(tipoVigente !== 'auto' ? [{ texto: TIPO_LABEL[tipoVigente], dudoso: false }] : []),
    ...[preview.persona, preview.fecha, preview.prioridad].filter((c): c is Campo => !!c),
  ]

  let estado: React.ReactNode
  if (fallo) {
    estado = (
      <span className="font-semibold text-danger">
        No se pudo enviar. Tu mensaje sigue en el campo: revisa la conexión y vuelve a enviarlo.
      </span>
    )
  } else if (bulkParsing || aiProcessing) {
    estado = (
      <span className="inline-flex items-center gap-1.5">
        <Spinner size={12} />
        {bulkParsing ? 'Analizando la lista de actividades…' : 'Lumix está procesando tu mensaje…'}
      </span>
    )
  } else if (input.trim() && campos.length > 0) {
    estado = (
      <span className="inline-flex flex-wrap items-center gap-1">
        <span className="mr-0.5">Lumix entenderá:</span>
        {campos.map((c, i) => (
          <span
            key={i}
            title={c.dudoso ? `${c.titulo ?? c.texto} · podría entenderlo distinto` : c.titulo}
            className={cx(
              'inline-flex items-center h-5 px-2 rounded-full border bg-panel',
              c.dudoso
                ? 'border-dashed border-warning text-warning'
                : 'border-border-strong text-fg',
            )}
          >
            {c.texto}
          </span>
        ))}
      </span>
    )
  } else if (tipoVigente === 'masivo') {
    estado = 'Pega varias actividades, una por línea; las revisas antes de crearlas.'
  }
  // Sin nada que decir, la linea de abajo no se muestra: vista limpia, como un chat de IA.

  return (
    <div
      className="shrink-0 px-3 sm:px-4 pt-1"
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="max-w-3xl mx-auto">
        {/* Tarjeta flotante: campo, tipo, vista previa y enviar viven juntos. El foco marca el
            borde completo, no solo el texto. */}
        <div className="vidrio relative rounded-[28px] transition-colors">
          {replyTo && (
            <div className="px-2 pt-2">
              <QuotedMessage reply={replyTo} onCancel={onCancelReply} />
            </div>
          )}

          {sugerencias.length > 0 && (
            <ul
              id="lista-comandos"
              role="listbox"
              aria-label="Comandos"
              className="absolute bottom-full left-2 mb-2 w-60 rounded-xl border border-border-strong bg-panel shadow-lg py-1 z-10"
            >
              {sugerencias.map((t, i) => (
                // mousedown y no click: el click llega despues del blur del campo y en el celular
                // el teclado alcanzaba a cerrarse. Sin boton adentro: una opcion no lleva otro
                // control interactivo (WCAG 4.1.2).
                <li
                  key={t}
                  id={`comando-${t}`}
                  role="option"
                  aria-selected={i === idx}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    elegir(t)
                  }}
                  className={cx(
                    'w-full flex items-center justify-between px-3 h-8 text-sm cursor-pointer',
                    i === idx ? 'bg-surface text-fg' : 'text-fg-muted hover:bg-surface',
                  )}
                >
                  <span className="font-mono text-xs text-accent">/{t}</span>
                  <span className="text-xs text-fg-faint">{TIPO_LABEL[t]}</span>
                </li>
              ))}
            </ul>
          )}

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              tipoVigente === 'masivo'
                ? 'Pega la lista de actividades (una por línea)…'
                : 'Escribe un mensaje o pide algo a Lumix…'
            }
            rows={1}
            aria-label="Mensaje"
            data-composer=""
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={sugerencias.length > 0}
            aria-controls={sugerencias.length > 0 ? 'lista-comandos' : undefined}
            aria-activedescendant={
              sugerencias.length > 0 ? `comando-${sugerencias[idx]}` : undefined
            }
            // text-base (16px) en movil: Safari/iOS hace zoom automatico al enfocar un campo
            // con letra menor a 16px (bug real reportado). En escritorio vuelve a la escala.
            className="block w-full resize-none overflow-y-auto max-h-40 bg-transparent px-4 pt-3 pb-1 text-base sm:text-sm text-fg placeholder:text-fg-faint focus:outline-none"
          />

          <div className="flex items-center gap-2 px-2 pb-2 pt-1">
            {/* Tipos a la vista, con el estilo sencillo de la barra lateral: iconos grises y el
                elegido con un fondo suave (sin colores). En el celular se desplazan de lado. */}
            <div
              role="group"
              aria-label="Tipo de mensaje"
              className="min-w-0 flex-1 flex gap-0.5 overflow-x-auto py-1 -my-1 [scrollbar-width:none]"
            >
              {tipos.map((t) => {
                const activo = t === tipoVigente
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => {
                      setTipo(t)
                      inputRef.current?.focus()
                    }}
                    className={cx(
                      'shrink-0 inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs transition-colors',
                      activo
                        ? 'bg-surface-2 text-fg font-medium'
                        : 'text-fg-muted hover:bg-surface hover:text-fg',
                    )}
                  >
                    <Icon name={TIPO_ESTILO[t].icon} size={14} />
                    {TIPO_LABEL[t]}
                  </button>
                )
              })}
            </div>
            <Button
              icon="send"
              aria-label="Enviar"
              title="Enviar"
              loading={busy}
              disabled={!input.trim()}
              onClick={handleSend}
              // 40px en movil: es el boton mas tocado de toda la app.
              className="shrink-0 h-10 w-10 sm:h-9 sm:w-9 px-0 !rounded-full"
            />
          </div>
        </div>

        {/* Bajo el campo, solo cuando aporta: que hara Lumix, que esta haciendo o si fallo. */}
        <div className="mt-1.5 px-2 min-h-5 text-2xs text-fg-faint">
          <span className="block truncate" aria-live="polite">
            {estado}
          </span>
        </div>
      </div>
    </div>
  )
}
