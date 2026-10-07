import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'

/**
 * Texto de solo lectura + lapiz para editar (o, con `editarAlTocar`, tocando el mismo texto).
 *
 * Antes el campo de texto (tema, comentarios) era editable con solo tocarlo -un
 * <textarea> siempre activo, sin ningun icono- y con un alto fijo (rows={2} o una
 * aproximacion por longitud) que escondia el texto largo detras de scroll interno poco
 * visible. Eso invitaba ediciones accidentales y cortaba texto real (caso reportado).
 *
 * Ahora el texto se ve SIEMPRE completo (whitespace-pre-wrap, sin alto fijo), y editar es
 * una accion explicita: tocar el lapiz abre un campo que crece con el contenido.
 */
export function EditableText({
  value,
  onSave,
  canEdit,
  placeholder,
  textClassName = '',
  emptyLabel = '-',
  as = 'span',
  // Un tema no puede quedar vacio (mismo criterio que tenia el textarea anterior); los
  // comentarios si pueden, por eso es opcional y no el default.
  preventEmpty = false,
  // Editar tocando el mismo texto, sin lapiz (pedido de Sebastian para los comentarios de la
  // Minuta). Antes se habia quitado "editar al tocar" porque un textarea SIEMPRE abierto
  // invitaba ediciones accidentales; aca un toque solo abre el campo, y si no se escribe nada
  // no se guarda nada. El texto se ve igual que siempre: solo cambia el cursor y un fondo suave
  // al pasar el mouse.
  editarAlTocar = false,
}: {
  value: string
  onSave: (next: string) => void
  canEdit: boolean
  placeholder?: string
  textClassName?: string
  emptyLabel?: string
  as?: 'span' | 'p'
  preventEmpty?: boolean
  editarAlTocar?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!editing) return
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [editing, draft])

  const confirmar = () => {
    setEditing(false)
    const next = draft.trim()
    if (preventEmpty && !next) {
      setDraft(value)
      return
    }
    if (next !== value) onSave(next)
  }

  const cancelar = () => {
    setDraft(value)
    setEditing(false)
  }

  if (editing) {
    return (
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            confirmar()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            // Escape cancela la edicion y nada mas: sin esto tambien cerraba el panel o
            // dialogo que contiene el campo.
            e.stopPropagation()
            cancelar()
          }
        }}
        rows={1}
        spellCheck={false}
        placeholder={placeholder}
        // 16px en el celular (Safari/iOS hace zoom al enfocar un campo con letra menor); en
        // escritorio mantiene el tamano del texto (textClassName), asi editar no "salta" de
        // tamano, que se sentia raro (feedback).
        className={`w-full resize-none overflow-hidden rounded-md border border-accent bg-field px-1.5 py-1 max-sm:!text-base focus:outline-none focus:ring-2 focus:ring-accent/20 ${textClassName}`}
      />
    )
  }

  const Tag = as
  // Contenedor SIEMPRE <div>: un <p> (bloque) no puede ir dentro de un <span> (en linea) -
  // HTML invalido que el navegador "arregla" solo cortando el span a la mitad, rompiendo el
  // flex y produciendo justo el efecto contrario al buscado (texto que se corta/contrae).
  const abrir = () => {
    setDraft(value)
    setEditing(true)
  }

  if (editarAlTocar && canEdit) {
    return (
      <Tag
        role="button"
        tabIndex={0}
        title="Clic para editar"
        // stopPropagation: editar el texto no debe disparar el clic de la fila que lo contiene.
        onClick={(e) => {
          e.stopPropagation()
          abrir()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            e.stopPropagation()
            abrir()
          }
        }}
        className={`block w-full whitespace-pre-wrap break-words cursor-text rounded-md -mx-1.5 px-1.5 py-0.5 transition-colors hover:bg-surface focus-visible:bg-surface ${textClassName}`}
      >
        {value || <span className="text-fg-faint">{placeholder ?? emptyLabel}</span>}
      </Tag>
    )
  }

  return (
    <div className="flex items-start gap-1.5 w-full">
      <Tag className={`whitespace-pre-wrap break-words flex-1 ${textClassName}`}>
        {value || <span className="text-fg-faint">{emptyLabel}</span>}
      </Tag>
      {canEdit && (
        <button
          type="button"
          onClick={abrir}
          title="Editar"
          aria-label="Editar"
          className="shrink-0 mt-0.5 p-0.5 -m-0.5 rounded text-fg-faint hover:text-accent hover:bg-surface transition-colors"
        >
          <Icon name="pencil" size={13} />
        </button>
      )}
    </div>
  )
}
