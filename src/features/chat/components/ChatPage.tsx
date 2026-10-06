import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '@core/auth/hooks/useAuth'
import { useCapabilities } from '@core/auth/hooks/useCapabilities'
import { type BulkActivity } from '@core/ai-engine/client'
import { teamsService } from '@infrastructure/supabase/teams.service'
import { useChatMessages, type Member } from '@features/chat/hooks/useChatMessages'
import { useTypingIndicator } from '@features/chat/hooks/useTypingIndicator'
import { useActividadesVivas } from '@features/chat/hooks/useActividadesVivas'
import type { ChatMessage, ReplyTarget } from '@features/chat/types'
import { PageHeader } from '@shared/components/ui/PageHeader'
import { SegmentedControl } from '@shared/components/ui/SegmentedControl'
import { EmptyState } from '@shared/components/ui/EmptyState'
import { LoadingState } from '@shared/components/ui/Spinner'
import { ActivityCard, type ActivityCardMeta } from '@features/chat/components/ActivityCard'
import {
  ActivityListMessage,
  type ActivityListItem,
} from '@features/chat/components/ActivityListMessage'
import { BulkCreateModal } from '@features/chat/components/BulkCreateModal'
import { Composer } from '@features/chat/components/Composer'
import { ConversationRail } from '@features/chat/components/ConversationRail'
import { EditActivityModal } from '@features/chat/components/EditActivityModal'
import { LumixFirma } from '@features/chat/components/LumixLine'
import { MessageLine } from '@features/chat/components/MessageLine'
import { QuotedMessage } from '@features/chat/components/QuotedMessage'
import { InteractivePrompt } from '@features/chat/components/prompts/InteractivePrompt'
import type { TipoMensaje } from '@features/chat/components/composer/vistaPrevia'
import {
  AUTO_FOCUS_TYPES,
  agrupar,
  claveDia,
  entradaPorDecidir,
  esActividadCreada,
  esLumix,
  esPregunta,
  etiquetaDia,
  filtrar,
  metaDe,
  resumenDelDia,
  tipoDe,
  type Filtro,
} from '@features/chat/components/log/registro'

const TIPOS: TipoMensaje[] = [
  'auto',
  'actividad',
  'error',
  'ingesta',
  'masivo',
  'minuta',
  'proyecto',
]

export function ChatPage() {
  const { user, profile } = useAuth()
  const teamId = profile?.team_id ?? ''
  const [teamName, setTeamName] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todo')
  const [roster, setRoster] = useState<Member[]>([])
  const [editTarget, setEditTarget] = useState<ActivityListItem | null>(null)
  const [bulkItems, setBulkItems] = useState<BulkActivity[] | null>(null)
  const [bulkParsing, setBulkParsing] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (teamId) teamsService.getById(teamId).then((t) => setTeamName(t?.name || ''))
  }, [teamId])

  const chat = useChatMessages()
  const {
    messages,
    loading,
    sending,
    aiProcessing,
    sendMessage,
    classifyAndAct,
    parseBulk,
    bulkCreate,
    quickUpdate,
    bulkQuickUpdate,
    editActivityFields,
    listMembers,
    confirmarEliminarActividad,
  } = chat
  const { vivas } = useActividadesVivas(messages)

  const { canAssignOthers, canManageMinuta, canManageProyectos, canManageIngestas } =
    useCapabilities()
  // Cada tipo con el permiso de su destino (antes Proyecto pedia el de Minuta, e Ingesta no
  // pedia nada). Error queda abierto a todos a proposito (Sebastian): cualquiera puede
  // reportar un error por el chat.
  const tipoPermitido: Partial<Record<TipoMensaje, boolean>> = {
    minuta: canManageMinuta,
    proyecto: canManageProyectos,
    ingesta: canManageIngestas,
  }
  const tipos = TIPOS.filter((t) => tipoPermitido[t] ?? true)

  // El roster sirve a tres cosas: editar una actividad, reasignar varias desde el listado y
  // adelantar en el campo a quien se asigna. Se pide una vez y solo si puede asignar a otros
  // (sin ese permiso todo queda a su nombre y no hay a quien elegir).
  useEffect(() => {
    if (canAssignOthers && roster.length === 0) {
      listMembers()
        .then(setRoster)
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAssignOthers])
  const editMembers = useMemo(
    () => roster.map((m) => ({ id: m.id, full_name: m.full_name })),
    [roster],
  )

  const { typingUsers, broadcastTyping } = useTypingIndicator()

  const entradas = useMemo(() => agrupar(messages), [messages])
  const visibles = useMemo(() => filtrar(entradas, filtro), [entradas, filtro])
  const porDecidir = useMemo(() => entradas.filter(entradaPorDecidir).length, [entradas])
  const resumen = useMemo(() => resumenDelDia(messages), [messages])

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight)
  }, [messages, filtro])

  // RESPONDER A UN MENSAJE.
  //
  // Al responder se guarda una copia del autor y el texto citado, no solo el id: el chat carga
  // los ultimos 50 mensajes y el original puede quedar fuera de esa ventana, y ahi la cita se
  // veria vacia. Tambien se guarda de que actividad habla, cuando se sabe: eso es lo que le
  // permite a Lumix aplicar el cambio sin preguntar a cual actividad te refieres.
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null)
  // Cada linea lleva data-msg-id y se busca dentro del contenedor cuando hace falta (saltar a
  // una cita, mostrar una pregunta nueva). Sin refs por linea: un callback ref por mensaje se
  // re-conectaba en cada render (cada tecla), y leer refs durante el render no esta permitido.
  const lineaDe = useCallback(
    (id: string) =>
      scrollRef.current?.querySelector<HTMLElement>(`[data-msg-id="${CSS.escape(id)}"]`) ?? null,
    [],
  )

  const startReply = useCallback(
    (msg: ChatMessage) => {
      const meta = msg.metadata as
        | { activityId?: string; activity_id?: string; title?: string }
        | null
        | undefined
      setReplyTo({
        id: msg.id,
        author: msg.sender_id === user?.id ? 'Tú' : (msg.sender?.full_name ?? 'Usuario'),
        // En una tarjeta se cita el titulo de la actividad, no el texto de Lumix
        // ("Actividad creada."): citar la confirmacion no dice a que le respondiste.
        text: meta?.title ?? msg.content,
        activityId: meta?.activityId ?? meta?.activity_id,
      })
      inputRef.current?.focus()
    },
    [user?.id],
  )

  // Saltar a un mensaje. Solo si sigue cargado en el hilo: si es mas viejo que los ultimos 50,
  // la cita se muestra igual pero no lleva a ninguna parte. Si el filtro lo esconde, se vuelve
  // a "Todo" para poder mostrarlo.
  const jumpTo = useCallback(
    (id: string) => {
      const ir = () => {
        const el = lineaDe(id)
        if (!el) return
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        const marca = ['ring-2', 'ring-inset', 'ring-accent', 'rounded-md']
        el.classList.add(...marca)
        setTimeout(() => el.classList.remove(...marca), 1200)
      }
      if (!lineaDe(id) && filtro !== 'todo') {
        setFiltro('todo')
        setTimeout(ir, 60)
      } else ir()
    },
    [filtro, lineaDe],
  )

  // Traer a la vista las preguntas nuevas (antes se abrian solas en una ventana: si quedaban
  // como un mensaje mas, el usuario creia que ya se habia creado y nunca las respondia). Ahora
  // la pregunta esta en el registro; basta con que se vea.
  //
  // DOS FILTROS QUE NO SON OPCIONALES, desde que estas alertas se guardan (migracion 031):
  //
  // 1. Solo las MIAS. El admin lee todo el chat del equipo, y no tiene que saltar a la
  //    pregunta de otra persona (que ademas no puede responder).
  // 2. Solo las que LLEGAN durante la sesion. Las que ya estaban al abrir el chat se marcan
  //    como vistas: si no, una sin resolver se traeria a la vista en cada recarga.
  const vistasRef = useRef<Set<string>>(new Set())
  const cargaInicialRef = useRef(true)
  useEffect(() => {
    // Se espera al fin de la carga y no a que haya mensajes: un chat que arranca vacio
    // tambien tiene que quedar marcado, o la primera pregunta de la sesion no se mostraria.
    if (loading) return
    if (cargaInicialRef.current) {
      cargaInicialRef.current = false
      messages.forEach((m) => vistasRef.current.add(m.id))
      return
    }
    const nueva = messages.find(
      (m) =>
        AUTO_FOCUS_TYPES.includes(tipoDe(m) ?? '') &&
        !metaDe(m).resolved &&
        (!m.owner_id || m.owner_id === user?.id) &&
        !vistasRef.current.has(m.id),
    )
    if (!nueva) return
    vistasRef.current.add(nueva.id)
    // block 'nearest' y sin foco: mover el foco a un boton cerraria el teclado del celular
    // en medio de la escritura.
    lineaDe(nueva.id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages, loading, user?.id, lineaDe])

  const handleSend = useCallback(
    async (text: string, tipo: TipoMensaje) => {
      const sent = await sendMessage({ content: text, category: null, reply_to: replyTo })
      setReplyTo(null)
      if (!sent) return
      if (tipo === 'masivo') {
        setBulkParsing(true)
        try {
          setBulkItems(await parseBulk(text))
        } catch (err) {
          console.error('Bulk parse failed:', err)
          setBulkItems([])
        } finally {
          setBulkParsing(false)
        }
      } else {
        classifyAndAct(sent, tipo)
      }
    },
    [replyTo, sendMessage, classifyAndAct, parseBulk],
  )

  const me = user && profile ? { id: user.id, name: profile.full_name ?? 'Yo' } : null

  // Quien decide una pregunta: su dueño, el unico que puede cerrarla.
  const nombreDe = (ownerId?: string) => {
    if (!ownerId || ownerId === user?.id) return 'Tú'
    return (
      messages.find((m) => m.sender_id === ownerId && !esLumix(m))?.sender?.full_name ??
      'su responsable'
    )
  }

  const card = (guardada: ActivityCardMeta, msg: ChatMessage) => {
    // Estado actual de la actividad, no la foto guardada en el mensaje (ver useActividadesVivas).
    const viva = vivas?.get(guardada.activityId)
    if (vivas && !viva) {
      return (
        <LumixFirma
          text={`"${guardada.title}" ya no existe o no la puedes ver.`}
          icon="trash"
          timestamp={msg.created_at}
          className="text-xs"
        />
      )
    }
    const meta: ActivityCardMeta = viva
      ? {
          ...guardada,
          title: viva.title,
          status: viva.status,
          dueDate: viva.due_date,
          priority: viva.priority,
        }
      : guardada
    return (
      <ActivityCard
        meta={meta}
        canAssignOthers={canAssignOthers}
        onComplete={() => quickUpdate(meta.activityId, { status: 'completado' })}
        onReschedule={(dueDate) => quickUpdate(meta.activityId, { due_date: dueDate })}
        onReassign={(memberId, memberName) =>
          quickUpdate(meta.activityId, { responsibleId: memberId, responsibleName: memberName })
        }
        onReply={() => startReply(msg)}
        listMembers={async () => {
          const m = await listMembers()
          return m.map((x) => ({ id: x.id, full_name: x.full_name }))
        }}
      />
    )
  }

  // Lo que Lumix dijo o hizo, segun el tipo de mensaje. Va colgado del mensaje de origen o,
  // si no hay uno cargado, en su propia linea.
  const renderLumix = (msg: ChatMessage): ReactNode => {
    const meta = metaDe(msg)
    const tipo = tipoDe(msg)

    if (tipo === 'activity_card') {
      return (
        <>
          {card(meta as unknown as ActivityCardMeta, msg)}
          <LumixFirma text={msg.content} timestamp={msg.created_at} className="text-xs" />
        </>
      )
    }

    if (tipo === 'activity_list') {
      return (
        <>
          <LumixFirma text={msg.content} timestamp={msg.created_at} />
          <ActivityListMessage
            items={(meta as unknown as { activities: ActivityListItem[] }).activities}
            onSelect={setEditTarget}
            canAssignOthers={canAssignOthers}
            members={editMembers}
            onBulkUpdate={bulkQuickUpdate}
            onQuickUpdate={async (id, changes) => {
              await quickUpdate(id, changes)
            }}
            onDelete={async (id, title) => {
              await confirmarEliminarActividad(id, title)
            }}
          />
        </>
      )
    }

    if (esPregunta(msg)) {
      return (
        <InteractivePrompt
          msg={msg}
          acciones={chat}
          ajena={!!msg.owner_id && msg.owner_id !== user?.id}
          decidedBy={nombreDe(msg.owner_id)}
          me={me}
        />
      )
    }

    // Confirmacion de creacion con la foto de la actividad: se dibuja como objeto de trabajo.
    // Las anteriores a ese cambio no la traen y quedan como texto.
    if (esActividadCreada(msg) && typeof meta.dueDate === 'string') {
      return (
        <>
          {card(
            {
              activityId: meta.activity_id as string,
              title: (meta.title as string) ?? '',
              responsibleName: (meta.responsibleName as string) ?? '',
              dueDate: meta.dueDate,
              status: (meta.status as string) ?? 'pendiente',
              priority: (meta.priority as number) ?? 2,
            },
            msg,
          )}
          <LumixFirma
            text="Actividad creada"
            icon="check"
            timestamp={msg.created_at}
            className="text-xs"
          />
        </>
      )
    }

    return <LumixFirma text={msg.content} timestamp={msg.created_at} />
  }

  const typingText =
    typingUsers.length > 0
      ? typingUsers.length === 1
        ? `${typingUsers[0].name} está escribiendo…`
        : `${typingUsers.length} personas están escribiendo…`
      : null

  const vacioFiltro: Record<Exclude<Filtro, 'todo'>, { title: string; description: string }> = {
    trabajo: {
      title: 'Sin trabajo registrado',
      description: 'Aquí aparecen los mensajes que crearon actividades, errores o preguntas.',
    },
    decidir: {
      title: 'Nada por decidir',
      description: 'Las preguntas de Lumix pendientes aparecen aquí.',
    },
  }

  let diaAnterior = ''

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Chat general"
        meta={[teamName, !loading && `${messages.length} mensajes`].filter(Boolean).join(' · ')}
        actions={
          <SegmentedControl<Filtro>
            label="Filtrar el chat"
            value={filtro}
            onChange={setFiltro}
            options={[
              { value: 'todo', label: 'Todo' },
              {
                value: 'trabajo',
                label: (
                  <>
                    <span className="sm:hidden">Trabajo</span>
                    <span className="hidden sm:inline">Solo trabajo</span>
                  </>
                ),
              },
              {
                value: 'decidir',
                label: 'Por decidir',
                count: porDecidir > 0 ? porDecidir : undefined,
              },
            ]}
          />
        }
      />

      <div className="flex flex-1 min-h-0">
        <div className="flex flex-1 min-w-0 flex-col">
          {/* El ancho se acota en pantallas grandes: una columna que ocupa todo el ancho se lee
              peor (lineas larguisimas). */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto py-2">
              {loading ? (
                <LoadingState />
              ) : messages.length === 0 ? (
                <EmptyState
                  icon="chat"
                  title="No hay mensajes aún"
                  description="Escribe lo que hay que hacer y Lumix lo ordena."
                />
              ) : visibles.length === 0 && filtro !== 'todo' ? (
                <EmptyState icon="filter" {...vacioFiltro[filtro]} />
              ) : (
                visibles.map((e) => {
                  const dia = claveDia(e.msg.created_at)
                  const separador = dia !== diaAnterior
                  diaAnterior = dia
                  const preview = metaDe(e.msg).reply_preview as ReplyTarget | undefined
                  return (
                    <Fragment key={e.msg.id}>
                      {separador && (
                        <div className="flex items-center gap-3 px-3 sm:px-4 pt-3 pb-1">
                          <span className="text-xs font-medium text-fg-faint">
                            {etiquetaDia(e.msg.created_at)}
                          </span>
                          <span className="h-px flex-1 bg-border" />
                        </div>
                      )}
                      {e.kind === 'persona' ? (
                        <MessageLine
                          msgId={e.msg.id}
                          timestamp={e.msg.created_at}
                          author={
                            e.msg.sender_id === user?.id
                              ? 'Tú'
                              : (e.msg.sender?.full_name ?? 'Usuario')
                          }
                          own={e.msg.sender_id === user?.id}
                          category={e.msg.category}
                          optimistic={e.msg.id.startsWith('opt-')}
                          content={e.msg.content}
                          onReply={() => startReply(e.msg)}
                          quoted={
                            preview && (
                              <QuotedMessage
                                reply={preview}
                                onJump={
                                  messages.some((m) => m.id === preview.id)
                                    ? () => jumpTo(preview.id)
                                    : undefined
                                }
                              />
                            )
                          }
                        >
                          {e.resultados.length > 0 &&
                            e.resultados.map((r) => (
                              <div key={r.id} data-msg-id={r.id} className="space-y-1.5">
                                {renderLumix(r)}
                              </div>
                            ))}
                        </MessageLine>
                      ) : (
                        <MessageLine msgId={e.msg.id} timestamp={e.msg.created_at}>
                          {renderLumix(e.msg)}
                        </MessageLine>
                      )}
                    </Fragment>
                  )
                })
              )}

              {typingText && (
                <p className="px-3 sm:px-4 sm:pl-[5.75rem] py-1 text-xs text-fg-faint">
                  {typingText}
                </p>
              )}
            </div>
          </div>

          <Composer
            inputRef={inputRef}
            tipos={tipos}
            onSend={handleSend}
            sending={sending}
            aiProcessing={aiProcessing}
            bulkParsing={bulkParsing}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
            onTyping={broadcastTyping}
            members={canAssignOthers ? roster : []}
          />
        </div>

        <ConversationRail resumen={resumen} onJump={jumpTo} />
      </div>

      {editTarget && (
        <EditActivityModal
          item={editTarget}
          canAssignOthers={canAssignOthers}
          members={editMembers}
          onSave={editActivityFields}
          onClose={() => setEditTarget(null)}
        />
      )}

      {bulkItems && (
        <BulkCreateModal
          items={bulkItems}
          onCreate={bulkCreate}
          onClose={() => setBulkItems(null)}
        />
      )}
    </div>
  )
}
