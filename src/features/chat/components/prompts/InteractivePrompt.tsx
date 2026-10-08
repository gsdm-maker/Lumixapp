import { useState } from 'react'
import type { HojaTipo } from '@shared/types'
import type { ChatMessage } from '@features/chat/types'
import type {
  PendingActivity,
  PendingCategory,
  PendingLoteSobrecarga,
  PendingMinuta,
  PendingOverload,
  PendingUpdate,
  useChatMessages,
} from '@features/chat/hooks/useChatMessages'
import { Button } from '@shared/components/ui/Button'
import { Modal } from '@shared/components/ui/Modal'
import { useToast } from '@shared/components/ui/Toast'
import { LumixPrompt } from '@features/chat/components/prompts/LumixPrompt'
import { metaDe, tipoDe } from '@features/chat/components/log/registro'
import type { Llamada } from '@features/chat/agente/tipos'

type Hook = ReturnType<typeof useChatMessages>

/** Lo que las preguntas necesitan del hook del chat. */
export type AccionesPregunta = Pick<
  Hook,
  | 'createOverloadActivity'
  | 'descartarAlerta'
  | 'moverLoteSobrecarga'
  | 'dejarLoteSobrecarga'
  | 'createResolvedActivity'
  | 'createMinutaTopic'
  | 'reassignResolved'
  | 'descartarNombre'
  | 'applyPendingUpdate'
  | 'descartarActividadElegida'
  | 'confirmCategory'
  | 'confirmarEliminarActividad'
  | 'descartarEliminar'
  | 'confirmarReclasificarProyecto'
  | 'descartarReclasificar'
  | 'confirmarReclasificarIngesta'
  | 'descartarReclasificarIngesta'
  | 'confirmarReclasificarError'
  | 'descartarReclasificarError'
  | 'confirmarAgente'
  | 'descartarAgente'
  | 'responderAgente'
>

// Un mismo "elegir persona" sirve para tres casos: crear una actividad, reasignar una
// existente, o asignar un tema de minuta. El campo presente decide cual.
type NameConfirm = {
  candidates: { id: string; name: string }[]
  pending?: PendingActivity
  reassign?: { activityId: string; title: string }
  minuta?: PendingMinuta
  // Responsables de minuta que ya se resolvieron solos (ej. "Genaro y Javier": Genaro
  // calzo directo, Javier necesito preguntar). No se pierden al responder la pregunta.
  otherResponsables?: { id: string; name: string }[]
  // 'minuta' o 'proyecto': se pierde si no viaja aca, y la pregunta de desambiguacion
  // siempre terminaba creando un tema de minuta aunque el original fuera un proyecto.
  tipoMinuta?: HojaTipo
  // Primer punto del proyecto (si vino en el mismo mensaje), para no perderlo al responder
  // la pregunta de a quien asignar.
  primerPunto?: string | null
}

interface Props {
  msg: ChatMessage
  acciones: AccionesPregunta
  /** La pregunta es de otra conversacion: se ve, pero no se responde (ver LumixPrompt). */
  ajena: boolean
  /** Nombre de quien decide (dueño de la conversacion), para la linea de resuelta. */
  decidedBy: string
  /** Usuario actual: "Asignarme a mi" y el creador de un tema de minuta. */
  me: { id: string; name: string } | null
}

// Con mas personas que esto, la fila de botones deja de leerse: se elige en una ventana.
const MAX_PERSONAS_EN_LINEA = 5

/** Pregunta interactiva de Lumix, en linea. Cada tipo conserva su logica de antes. */
export function InteractivePrompt({ msg, acciones, ajena, decidedBy, me }: Props) {
  const meta = metaDe(msg)
  const resolution = typeof meta.resolution === 'string' ? meta.resolution : null
  const base = {
    question: msg.content,
    resolution: meta.resolved ? (resolution ?? 'Resuelta') : null,
    decidedBy,
    ajena,
  }

  switch (tipoDe(msg)) {
    case 'overload':
      return (
        <Sobrecarga
          base={base}
          pending={meta.pending as PendingOverload}
          msgId={msg.id}
          acciones={acciones}
        />
      )
    case 'overload_lote':
      return (
        <Lote
          base={base}
          pending={meta.pending as PendingLoteSobrecarga}
          msgId={msg.id}
          acciones={acciones}
        />
      )
    case 'name_confirm':
      return (
        <ElegirPersona
          base={base}
          data={meta as unknown as NameConfirm}
          msgId={msg.id}
          acciones={acciones}
          me={me}
        />
      )
    case 'activity_pick':
      return (
        <ElegirActividad
          base={base}
          data={meta as unknown as { candidates: { id: string; title: string }[] }}
          pending={meta.pending as PendingUpdate}
          msgId={msg.id}
          acciones={acciones}
        />
      )
    case 'category_confirm':
      return (
        <Categoria
          base={base}
          pending={meta.pending as PendingCategory}
          msgId={msg.id}
          acciones={acciones}
        />
      )
    case 'delete_confirm':
      return (
        <Confirmacion
          base={base}
          label="Eliminar"
          variant="danger"
          onConfirm={() =>
            acciones.confirmarEliminarActividad(
              meta.activityId as string,
              meta.title as string,
              msg.id,
            )
          }
          onCancel={() => acciones.descartarEliminar(msg.id)}
        />
      )
    case 'reclass_proyecto_confirm': {
      const m = meta as {
        activityId: string
        tema: string
        comentarios: string
        primerPunto: string | null
        plazo: string | null
        senderId: string
      }
      return (
        <Confirmacion
          base={base}
          label="Convertir en proyecto"
          onConfirm={() =>
            acciones.confirmarReclasificarProyecto(
              m.activityId,
              m.tema,
              m.comentarios,
              m.primerPunto,
              m.plazo,
              m.senderId,
              msg.id,
            )
          }
          onCancel={() => acciones.descartarReclasificar(msg.id)}
        />
      )
    }
    case 'reclass_ingesta_confirm': {
      const m = meta as {
        activityId: string
        title: string
        comentarios: string
        plazo: string | null
        senderId: string
      }
      return (
        <Confirmacion
          base={base}
          label="Convertir en ingesta"
          onConfirm={() =>
            acciones.confirmarReclasificarIngesta(
              m.activityId,
              m.title,
              m.comentarios,
              m.plazo,
              m.senderId,
              msg.id,
            )
          }
          onCancel={() => acciones.descartarReclasificarIngesta(msg.id)}
        />
      )
    }
    case 'reclass_error_confirm': {
      const m = meta as { activityId: string; title: string; comentarios: string; senderId: string }
      return (
        <Confirmacion
          base={base}
          label="Convertir en error"
          onConfirm={() =>
            acciones.confirmarReclasificarError(
              m.activityId,
              m.title,
              m.comentarios,
              m.senderId,
              msg.id,
            )
          }
          onCancel={() => acciones.descartarReclasificarError(msg.id)}
        />
      )
    }
    // Agente del chat: lo que va a hacer (avisa a otros o toca varias cosas) espera un OK.
    case 'agente_confirmar':
      return (
        <Confirmacion
          base={base}
          label="Confirmar"
          onConfirm={() => acciones.confirmarAgente(msg.id, meta.llamadas as Llamada[])}
          onCancel={() => acciones.descartarAgente(msg.id)}
        />
      )
    // Agente del chat: le falta un dato. Las opciones son atajos; tambien se puede escribir.
    case 'agente_aclaracion':
      return (
        <Opciones
          base={base}
          opciones={Array.isArray(meta.opciones) ? (meta.opciones as string[]) : []}
          onElegir={(o) => acciones.responderAgente(msg.id, o)}
        />
      )
    default:
      return null
  }
}

function Opciones({
  base,
  opciones,
  onElegir,
}: {
  base: Base
  opciones: string[]
  onElegir: (opcion: string) => Promise<unknown>
}) {
  const { ocupado, correr } = useOcupado()
  if (!opciones.length) return <LumixPrompt {...base}>{null}</LumixPrompt>
  return (
    <LumixPrompt {...base}>
      {opciones.map((o) => (
        <Button
          key={o}
          size="xs"
          variant="secondary"
          loading={ocupado === o}
          disabled={!!ocupado}
          onClick={() => correr(o, () => onElegir(o))}
        >
          {o}
        </Button>
      ))}
    </LumixPrompt>
  )
}

type Base = {
  question: string
  resolution: string | null
  decidedBy: string
  ajena: boolean
}

/** Ejecuta una opcion con un solo "ocupado" por pregunta: evita resolverla dos veces. */
function useOcupado() {
  const [ocupado, setOcupado] = useState<string | null>(null)
  const correr = async (clave: string, fn: () => Promise<unknown>) => {
    setOcupado(clave)
    try {
      await fn()
    } finally {
      setOcupado(null)
    }
  }
  return { ocupado, correr }
}

// Alerta de sobrecarga (modelo anterior: la actividad NO existe todavia, hay que decidir antes
// de seguir). La sugerencia de Lumix es moverla, por eso va primero.
function Sobrecarga({
  base,
  pending,
  msgId,
  acciones,
}: {
  base: Base
  pending: PendingOverload
  msgId: string
  acciones: AccionesPregunta
}) {
  const { ocupado, correr } = useOcupado()
  const [otros, setOtros] = useState(false)
  const [dias, setDias] = useState('')
  const crear = (n: number) =>
    correr(`d${n}`, () => acciones.createOverloadActivity(pending, n, msgId))

  return (
    <LumixPrompt
      {...base}
      detail={
        <p className="text-xs text-fg-faint">
          {pending.responsibleName} ya tiene {pending.sameDayCount} actividades ese día. "
          {pending.title}" todavía no se ha creado.
        </p>
      }
    >
      {otros ? (
        <>
          <input
            type="number"
            min={1}
            max={365}
            value={dias}
            onChange={(e) => setDias(e.target.value)}
            autoFocus
            aria-label="Días hábiles"
            placeholder="días"
            className="h-7 w-20 rounded-md border border-border-strong bg-field px-2 text-base sm:text-sm text-fg text-center focus:outline-none focus:border-accent"
          />
          <span className="text-xs text-fg-faint">días hábiles</span>
          <Button
            size="xs"
            loading={ocupado === 'otros'}
            disabled={!!ocupado || !(parseInt(dias, 10) > 0)}
            onClick={() =>
              correr('otros', () =>
                acciones.createOverloadActivity(pending, parseInt(dias, 10), msgId),
              )
            }
          >
            Mover y crear
          </Button>
          <Button size="xs" variant="ghost" disabled={!!ocupado} onClick={() => setOtros(false)}>
            Volver
          </Button>
        </>
      ) : (
        <>
          <Button
            size="xs"
            loading={ocupado === 'd3'}
            disabled={!!ocupado}
            onClick={() => crear(3)}
          >
            Mover +3 días hábiles
          </Button>
          <Button
            size="xs"
            variant="secondary"
            loading={ocupado === 'd7'}
            disabled={!!ocupado}
            onClick={() => crear(7)}
          >
            Mover +7
          </Button>
          <Button
            size="xs"
            variant="secondary"
            loading={ocupado === 'd0'}
            disabled={!!ocupado}
            onClick={() => crear(0)}
          >
            Crear igual
          </Button>
          <Button size="xs" variant="ghost" disabled={!!ocupado} onClick={() => setOtros(true)}>
            Otros días…
          </Button>
          {/* Cancelar es una DECISION, no un cierre: queda registrada. Si solo cerrara, la
              alerta seguiria pendiente y volveria a aparecer en cada recarga. */}
          <Button
            size="xs"
            variant="ghost"
            disabled={!!ocupado}
            onClick={() => correr('x', () => acciones.descartarAlerta(msgId))}
          >
            No crear
          </Button>
        </>
      )}
    </LumixPrompt>
  )
}

// Carga acumulada del dia, agrupada. A diferencia de la alerta de arriba, aca las actividades
// YA estan creadas: es una sugerencia, no una pregunta que bloquee.
function Lote({
  base,
  pending,
  msgId,
  acciones,
}: {
  base: Base
  pending: PendingLoteSobrecarga
  msgId: string
  acciones: AccionesPregunta
}) {
  const toast = useToast()
  const { ocupado, correr } = useOcupado()
  const mover = (d: number) =>
    correr(`d${d}`, async () => {
      const cuando = await acciones.moverLoteSobrecarga(pending, d, msgId)
      if (cuando) toast.success(`Movidas al ${cuando}`)
    })

  return (
    <LumixPrompt
      {...base}
      detail={
        <ul className="text-xs text-fg-muted space-y-0.5">
          {pending.items.map((it) => (
            <li key={it.id} className="truncate">
              · {it.title}
            </li>
          ))}
        </ul>
      }
    >
      <Button size="xs" loading={ocupado === 'd3'} disabled={!!ocupado} onClick={() => mover(3)}>
        Mover +3 días hábiles
      </Button>
      <Button
        size="xs"
        variant="secondary"
        loading={ocupado === 'd7'}
        disabled={!!ocupado}
        onClick={() => mover(7)}
      >
        Mover +7
      </Button>
      <Button
        size="xs"
        variant="ghost"
        disabled={!!ocupado}
        onClick={() => correr('dejar', () => acciones.dejarLoteSobrecarga(msgId))}
      >
        Dejarlas en esa fecha
      </Button>
    </LumixPrompt>
  )
}

// Confirmacion de responsable: crear actividad, reasignar una existente o asignar un tema de
// minuta. Nada se guarda hasta que se elige una persona.
function ElegirPersona({
  base,
  data,
  msgId,
  acciones,
  me,
}: {
  base: Base
  data: NameConfirm
  msgId: string
  acciones: AccionesPregunta
  me: { id: string; name: string } | null
}) {
  const { ocupado, correr } = useOcupado()
  const [lista, setLista] = useState(false)

  const pick = (id: string, name: string) =>
    correr(id, async () => {
      if (data.reassign) {
        await acciones.reassignResolved(data.reassign.activityId, id, name, msgId)
      } else if (data.minuta) {
        if (!me) return
        const responsables = [...(data.otherResponsables ?? []), { id, name }]
        await acciones.createMinutaTopic(
          data.minuta,
          responsables,
          me.id,
          msgId,
          data.tipoMinuta,
          data.primerPunto,
        )
      } else if (data.pending) {
        await acciones.createResolvedActivity(data.pending, id, name, msgId)
      }
      setLista(false)
    })

  const asignarmeAMi = !!me && !data.candidates.some((c) => c.id === me.id)
  const enLinea = data.candidates.length <= MAX_PERSONAS_EN_LINEA
  const cancelar = () => correr('x', () => acciones.descartarNombre(msgId))

  return (
    <>
      <LumixPrompt {...base}>
        {enLinea ? (
          data.candidates.map((c) => (
            <Button
              key={c.id}
              size="xs"
              variant="secondary"
              icon="user"
              loading={ocupado === c.id}
              disabled={!!ocupado}
              onClick={() => pick(c.id, c.name)}
            >
              {c.name}
            </Button>
          ))
        ) : (
          <Button size="xs" icon="users" disabled={!!ocupado} onClick={() => setLista(true)}>
            Elegir persona…
          </Button>
        )}
        {me && asignarmeAMi && (
          <Button
            size="xs"
            variant="ghost"
            loading={ocupado === me.id}
            disabled={!!ocupado}
            onClick={() => pick(me.id, me.name)}
          >
            Asignarme a mí
          </Button>
        )}
        <Button size="xs" variant="ghost" disabled={!!ocupado} onClick={cancelar}>
          Cancelar
        </Button>
      </LumixPrompt>

      {/* Equipo completo (el nombre no calzo con nadie): la lista no cabe en una fila. */}
      <Modal
        open={lista}
        onClose={() => !ocupado && setLista(false)}
        dismissible={!ocupado}
        size="sm"
        title={
          data.reassign ? 'Reasignar actividad' : data.minuta ? 'Asignar tema' : 'Asignar actividad'
        }
        description={`"${data.reassign?.title ?? data.minuta?.tema ?? data.pending?.title ?? ''}"`}
        footer={
          <Button variant="secondary" disabled={!!ocupado} onClick={() => setLista(false)}>
            Cerrar
          </Button>
        }
      >
        <ul className="-mx-2 space-y-0.5">
          {data.candidates.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                disabled={!!ocupado}
                onClick={() => pick(c.id, c.name)}
                className="w-full flex items-center justify-between gap-2 px-2 h-9 rounded-md text-left text-sm text-fg hover:bg-surface disabled:opacity-50"
              >
                {c.name}
                {ocupado === c.id && <span className="text-xs text-fg-faint">Asignando…</span>}
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  )
}

// Seleccion de actividad a modificar (la IA no supo cual). Los titulos son largos: van uno
// bajo otro, no en fila.
function ElegirActividad({
  base,
  data,
  pending,
  msgId,
  acciones,
}: {
  base: Base
  data: { candidates: { id: string; title: string }[] }
  pending: PendingUpdate
  msgId: string
  acciones: AccionesPregunta
}) {
  const { ocupado, correr } = useOcupado()
  return (
    <LumixPrompt
      {...base}
      detail={
        !base.ajena && (
          <ul className="space-y-1">
            {data.candidates.map((c) => (
              <li key={c.id}>
                <Button
                  size="xs"
                  variant="secondary"
                  loading={ocupado === c.id}
                  disabled={!!ocupado}
                  onClick={() =>
                    correr(c.id, () => acciones.applyPendingUpdate(c.id, pending, msgId))
                  }
                  className="max-w-full justify-start"
                >
                  <span className="truncate">{c.title}</span>
                </Button>
              </li>
            ))}
          </ul>
        )
      }
    >
      <Button
        size="xs"
        variant="ghost"
        disabled={!!ocupado}
        onClick={() => correr('x', () => acciones.descartarActividadElegida(msgId))}
      >
        Cancelar
      </Button>
    </LumixPrompt>
  )
}

const CATEGORIA: Record<
  'actividad' | 'error' | 'ingesta' | 'proyecto',
  { label: string; hint: string; articulo: string }
> = {
  actividad: { label: 'Actividad', hint: 'Lo más común', articulo: 'una actividad' },
  error: { label: 'Error', hint: 'Reportar una falla', articulo: 'un error' },
  ingesta: {
    label: 'Ingesta de datos',
    hint: 'Carga o proceso de datos',
    articulo: 'una ingesta',
  },
  proyecto: {
    label: 'Proyecto',
    hint: 'Con subtareas, se sigue en el tiempo',
    articulo: 'un proyecto',
  },
}

// Categoria ambigua (actividad vs error/ingesta/proyecto). Lo que predijo la IA va primero y
// marcado; si predijo otra cosa, manda "Actividad", que es lo mas comun. Sin "Cancelar": antes
// cerrar la ventana dejaba la pregunta pendiente igual, y en linea ya no hay nada que cerrar.
function Categoria({
  base,
  pending,
  msgId,
  acciones,
}: {
  base: Base
  pending: PendingCategory
  msgId: string
  acciones: AccionesPregunta
}) {
  const { ocupado, correr } = useOcupado()
  const opciones = ['actividad' as const, ...pending.options]
  const sugerida = opciones.find((o) => o === pending.predictedCategory) ?? 'actividad'
  const orden = [sugerida, ...opciones.filter((o) => o !== sugerida)]

  return (
    <LumixPrompt {...base}>
      {orden.map((o) => (
        <Button
          key={o}
          size="xs"
          variant={o === sugerida ? 'primary' : 'secondary'}
          title={CATEGORIA[o].hint}
          loading={ocupado === o}
          disabled={!!ocupado}
          onClick={() => correr(o, () => acciones.confirmCategory(pending, o, msgId))}
        >
          {CATEGORIA[o].label}
        </Button>
      ))}
      {sugerida !== 'actividad' && (
        <span className="text-xs text-fg-faint">
          · Lumix cree que es {CATEGORIA[sugerida].articulo}
        </span>
      )}
    </LumixPrompt>
  )
}

// Confirmaciones de una sola accion (eliminar, convertir). Exigen un toque explicito: antes
// eran ventanas que no se cerraban tocando afuera; en linea la pregunta simplemente espera.
function Confirmacion({
  base,
  label,
  variant = 'primary',
  onConfirm,
  onCancel,
}: {
  base: Base
  label: string
  variant?: 'primary' | 'danger'
  onConfirm: () => Promise<unknown>
  onCancel: () => Promise<unknown>
}) {
  const { ocupado, correr } = useOcupado()
  return (
    <LumixPrompt {...base}>
      <Button
        size="xs"
        variant={variant}
        loading={ocupado === 'ok'}
        disabled={!!ocupado}
        onClick={() => correr('ok', onConfirm)}
      >
        {label}
      </Button>
      <Button size="xs" variant="ghost" disabled={!!ocupado} onClick={() => correr('x', onCancel)}>
        Cancelar
      </Button>
    </LumixPrompt>
  )
}
