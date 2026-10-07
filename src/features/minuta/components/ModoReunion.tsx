// Modo reunion (idea 9 de la propuesta UI/UX).
//
// La tabla de la Minuta sirve para PREPARAR la reunion: todas las celdas editables, todos los
// temas a la vez. Para CONDUCIRLA estorba: con 18 temas en pantalla la conversacion salta de
// uno a otro y nadie sabe cuanto falta. Esta vista muestra un tema a la vez, en grande (se
// proyecta en la sala), con la cola al costado y las tres decisiones posibles a una tecla.
//
// Es solo UI sobre lo que ya existia: no guarda nada propio. "Asignar" es el mismo modal y la
// misma funcion de siempre, "Ya lo conversamos" la misma accion de la tabla, y "Dejar para la
// proxima" no toca el dato (el tema sigue en Por asignar para la semana siguiente). El resumen
// final vive solo en memoria mientras dura la reunion.

import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { Button } from '@shared/components/ui/Button'
import { EditableText } from '@shared/components/ui/EditableText'
import { EmptyState } from '@shared/components/ui/EmptyState'
import { Icon } from '@shared/components/ui/Icon'
import { Kbd, ProgressBar, SectionLabel } from '@shared/components/ui/Indicators'
import { PageHeader } from '@shared/components/ui/PageHeader'
import { StatusLabel } from '@shared/components/ui/StatusLabel'
import { useToast } from '@shared/components/ui/Toast'
import { cx } from '@shared/utils/cx'
import { MINUTE_ESTADO } from '@shared/utils/estados'
import type { DecoratedItem } from '@features/minuta/hooks/useMinuta'
import { AsignarActividadModal } from '@features/minuta/components/AsignarActividadModal'
import { PlazoCampo, ResponsableCampo } from '@features/minuta/components/CamposTema'
import type { Hoja } from '@features/minuta/components/hoja'
import { esEscalado, puedeAsignarse, sinActividad } from '@features/minuta/utils/temas'

type Decision = 'asignado' | 'conversado' | 'proxima'

const DECISION: Record<Decision, string> = {
  asignado: 'Asignado',
  conversado: 'Conversado',
  proxima: 'Para la próxima',
}

type CrearActividades = ComponentProps<typeof AsignarActividadModal>['onCreate']

export function ModoReunion({
  ids,
  hoja,
  crearActividades,
  onSalir,
}: {
  /** Cola congelada al empezar: un tema que se asigna sale de "Por asignar", pero NO de la
   *  reunion -si la cola se recalculara, la posicion "Tema 7 de 18" saltaria sola. */
  ids: string[]
  hoja: Hoja
  crearActividades: CrearActividades
  onSalir: () => void
}) {
  const toast = useToast()
  const [indice, setIndice] = useState(0)
  const [decisiones, setDecisiones] = useState<Record<string, Decision>>({})
  const [resumen, setResumen] = useState(false)
  const [asignando, setAsignando] = useState<{ id: string; solo?: string[] } | null>(null)
  const [inicio] = useState(() => Date.now())
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])
  const minutos = Math.max(0, Math.floor((ahora - inicio) / 60_000))

  // Un tema eliminado durante la reunion (desde otra pestaña, o una recarga) desaparece de la
  // cola en vez de dejar un hueco.
  const temas = ids
    .map((id) => hoja.allItems.find((i) => i.id === id))
    .filter((t): t is DecoratedItem => !!t)
  const total = temas.length
  const actual = !resumen && indice < total ? temas[indice] : null

  const avanzar = () => {
    if (indice + 1 >= total) setResumen(true)
    else setIndice(indice + 1)
  }
  const retroceder = () => {
    if (resumen) setResumen(false)
    else setIndice(Math.max(0, indice - 1))
  }
  const decidir = (id: string, d: Decision) => setDecisiones((cur) => ({ ...cur, [id]: d }))

  // A quien se le puede crear la actividad ahora: todos los responsables si aun no tiene
  // ninguna, o solo los que faltan si ya tenia (mismo criterio que la fila de la tabla).
  const paraAsignar = (it: DecoratedItem): string[] | null => {
    if (!hoja.canAssign) return null
    if (puedeAsignarse(it)) return it.responsables
    const faltan = !it.para_todos && it.linkedActivities.length > 0 ? sinActividad(it) : []
    return faltan.length ? faltan : null
  }

  const asignar = (it: DecoratedItem) => {
    const quienes = paraAsignar(it)
    if (!quienes) {
      toast.info(
        it.para_todos
          ? 'Un tema para todo el equipo no genera actividad'
          : 'Primero elige un responsable',
      )
      return
    }
    setAsignando({ id: it.id, solo: puedeAsignarse(it) ? undefined : quienes })
  }

  /**
   * "Ya lo conversamos". En un tema escalado desde Compromisos es la accion de siempre (pasa a
   * En desarrollo y la actividad sigue su curso). En un tema nuevo, sin actividad, conversarlo
   * y no asignar nada significa que no requiere trabajo: se cierra como Resuelto -si quedara en
   * otro estado seguiria en "Por asignar" para siempre-. Es reversible, por eso Deshacer.
   */
  const conversado = (it: DecoratedItem) => {
    if (!hoja.canManage) return
    if (esEscalado(it)) {
      hoja.yaConversado(it)
    } else {
      const previo = it.estado
      hoja.guardar(it.id, { estado: 'resuelto' })
      toast.success('Tema cerrado sin actividad', {
        action: {
          label: 'Deshacer',
          onClick: () => {
            hoja.guardar(it.id, { estado: previo })
            setDecisiones((cur) => {
              const n = { ...cur }
              delete n[it.id]
              return n
            })
          },
        },
      })
    }
    decidir(it.id, 'conversado')
    avanzar()
  }

  const proxima = (it: DecoratedItem) => {
    decidir(it.id, 'proxima')
    avanzar()
  }

  // Atajos de teclado. Se leen desde un ref para registrar el listener una sola vez y que
  // siempre vea el estado actual.
  const atajos = useRef<(e: KeyboardEvent) => void>(() => {})
  useEffect(() => {
    atajos.current = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      // Con un dialogo o selector abierto encima (Crear actividad, calendario, responsables),
      // las teclas son de ese dialogo, no de la reunion. Los selectores compartidos no tienen
      // role, por eso tambien se mira la capa fija que dibujan.
      if (asignando || document.querySelector('[role="dialog"], .fixed.inset-0')) return
      const k = e.key.toLowerCase()
      if (k === 'escape') {
        e.preventDefault()
        if (resumen) onSalir()
        else setResumen(true)
        return
      }
      if (k === 'arrowright') {
        e.preventDefault()
        if (!resumen) avanzar()
        return
      }
      if (k === 'arrowleft') {
        e.preventDefault()
        retroceder()
        return
      }
      if (!actual) return
      if (k === 'a') {
        e.preventDefault()
        asignar(actual)
      } else if (k === 'c' && hoja.canManage) {
        e.preventDefault()
        conversado(actual)
      } else if (k === 'p') {
        e.preventDefault()
        proxima(actual)
      }
    }
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => atajos.current(e)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const itemAsignando = asignando
    ? (hoja.allItems.find((i) => i.id === asignando.id) ?? null)
    : null

  const asignados = temas.filter((t) => decisiones[t.id] === 'asignado')
  const conversados = temas.filter((t) => decisiones[t.id] === 'conversado')
  const pendientes = temas.filter((t) => !decisiones[t.id] || decisiones[t.id] === 'proxima')

  return (
    <div className="flex flex-col h-full bg-panel">
      <PageHeader
        title="Reunión semanal"
        meta={`${total} ${total === 1 ? 'tema' : 'temas'} · ${minutos} min`}
        actions={
          <>
            <span className="hidden sm:inline text-xs text-fg-muted tabular-nums mr-2">
              {resumen ? 'Resumen' : `Tema ${Math.min(indice + 1, total)} de ${total}`}
            </span>
            {!resumen && total > 0 && (
              <Button size="sm" variant="secondary" onClick={() => setResumen(true)}>
                Terminar
              </Button>
            )}
            <Button size="sm" variant="ghost" icon="x" onClick={onSalir}>
              <span className="hidden sm:inline">Salir</span>
            </Button>
          </>
        }
      />
      <ProgressBar
        value={total ? ((resumen ? total : indice + 1) / total) * 100 : 0}
        tone="accent"
        label="Avance de la reunión"
        className="rounded-none"
      />

      {total === 0 ? (
        <EmptyState
          icon="check"
          title="No hay temas por conversar"
          description="Todo lo de la minuta ya está asignado o resuelto."
          action={
            <Button size="sm" variant="secondary" onClick={onSalir}>
              Volver a la minuta
            </Button>
          }
        />
      ) : (
        <div className="flex-1 min-h-0 grid lg:grid-cols-[17rem_1fr]">
          {/* Cola de temas. En el celular no cabe al lado: se usa la barra de avance. */}
          <nav
            aria-label="Temas de la reunión"
            className="hidden lg:block min-h-0 overflow-y-auto border-r border-border"
          >
            <ol>
              {temas.map((t, i) => {
                const d = decisiones[t.id]
                const esActual = !resumen && i === indice
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setResumen(false)
                        setIndice(i)
                      }}
                      aria-current={esActual ? 'step' : undefined}
                      className={cx(
                        'w-full flex items-start gap-2.5 px-4 py-2 text-left text-sm border-b border-border border-l-2',
                        esActual
                          ? 'border-l-accent bg-accent-soft text-fg font-medium'
                          : 'border-l-transparent hover:bg-surface',
                        !esActual && d && 'text-fg-faint',
                        !esActual && !d && 'text-fg-body',
                      )}
                    >
                      <span className="w-5 shrink-0 text-xs text-fg-faint tabular-nums">
                        {i + 1}
                      </span>
                      <span className="flex-1 min-w-0 line-clamp-2">{t.tema}</span>
                      {d && (
                        <Icon
                          name={d === 'proxima' ? 'arrowRight' : 'check'}
                          size={14}
                          className="shrink-0 mt-0.5"
                          aria-label={DECISION[d]}
                        />
                      )}
                    </button>
                  </li>
                )
              })}
            </ol>
          </nav>

          <div className="min-h-0 overflow-y-auto">
            {actual ? (
              <TemaEnFoco
                key={actual.id}
                it={actual}
                hoja={hoja}
                decision={decisiones[actual.id]}
                posicion={`${indice + 1} de ${total}`}
                puedeAsignar={!!paraAsignar(actual)}
                onAsignar={() => asignar(actual)}
                onConversado={() => conversado(actual)}
                onProxima={() => proxima(actual)}
                onAnterior={retroceder}
                onSiguiente={avanzar}
                primero={indice === 0}
              />
            ) : (
              <div className="max-w-2xl px-4 sm:px-8 py-8 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-fg">Resumen de la reunión</h2>
                  <p className="text-xs text-fg-faint mt-0.5">
                    {total} {total === 1 ? 'tema' : 'temas'} en {minutos} min
                  </p>
                </div>
                <dl className="flex flex-wrap gap-x-10 gap-y-3">
                  <Cifra n={asignados.length} label="asignados" />
                  <Cifra n={conversados.length} label="conversados" />
                  <Cifra n={pendientes.length} label="pendientes" />
                </dl>
                {pendientes.length > 0 && (
                  <div className="space-y-1.5">
                    <SectionLabel>Quedan para la próxima</SectionLabel>
                    <ul className="divide-y divide-border border-y border-border">
                      {pendientes.map((t) => (
                        <li key={t.id} className="py-1.5 text-sm text-fg-body">
                          {t.tema}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={retroceder}>
                    Volver a los temas
                  </Button>
                  <Button onClick={onSalir}>Terminar</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <AsignarActividadModal
        key={itemAsignando?.id ?? 'closed'}
        item={itemAsignando}
        soloResponsables={asignando?.solo}
        memberName={hoja.memberName}
        onClose={() => setAsignando(null)}
        onCreate={async (item, opts) => {
          const r = await crearActividades(item, opts)
          // Solo si de verdad se creo (si falla, el modal avisa y la reunion no avanza).
          decidir(item.id, 'asignado')
          if (temas[indice]?.id === item.id) avanzar()
          return r
        }}
      />
    </div>
  )
}

function Cifra({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="sr-only">{label}</dt>
      <dd className="text-2xl font-semibold text-fg tabular-nums">{n}</dd>
      <span className="text-sm text-fg-muted" aria-hidden="true">
        {label}
      </span>
    </div>
  )
}

function TemaEnFoco({
  it,
  hoja,
  decision,
  posicion,
  puedeAsignar,
  onAsignar,
  onConversado,
  onProxima,
  onAnterior,
  onSiguiente,
  primero,
}: {
  it: DecoratedItem
  hoja: Hoja
  decision?: Decision
  posicion: string
  puedeAsignar: boolean
  onAsignar: () => void
  onConversado: () => void
  onProxima: () => void
  onAnterior: () => void
  onSiguiente: () => void
  primero: boolean
}) {
  const subtareas = hoja.allItems.filter((d) => d.parent_item_id === it.id).length
  return (
    <div className="max-w-3xl px-4 sm:px-8 py-6 sm:py-8 space-y-6">
      <div className="space-y-2">
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-fg-faint">
          <span className="lg:hidden tabular-nums">Tema {posicion} ·</span>
          <StatusLabel {...MINUTE_ESTADO[it.effectiveEstado]} />
          {esEscalado(it) && <span>· volvió desde Compromisos</span>}
          {decision && <span className="text-fg-muted">· {DECISION[decision]}</span>}
        </p>
        <EditableText
          value={it.tema}
          canEdit={hoja.canManage}
          onSave={(next) => hoja.guardarTema(it.id, next)}
          textClassName="text-2xl font-semibold text-fg leading-snug"
          preventEmpty
        />
      </div>

      <EditableText
        as="p"
        value={it.comentarios}
        canEdit={hoja.canManage}
        onSave={(next) => hoja.guardarComentarios(it.id, next)}
        editarAlTocar
        placeholder="Notas de la conversación…"
        emptyLabel="Sin comentarios"
        textClassName="text-sm text-fg-body"
      />

      <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 items-center text-sm max-w-md">
        <dt className="text-xs text-fg-faint">Responsable</dt>
        <dd className="min-w-0">
          <ResponsableCampo
            item={it}
            esIngesta={false}
            canEdit={hoja.canManage}
            members={hoja.members}
            single={hoja.esMinuta}
            memberName={hoja.memberName}
            onChange={(p) => hoja.guardar(it.id, p)}
          />
        </dd>
        <dt className="text-xs text-fg-faint">Plazo</dt>
        <dd>
          <PlazoCampo
            item={it}
            allItems={hoja.allItems}
            canEdit={hoja.canManage}
            onChange={(v) => hoja.guardarPlazo(it, v)}
          />
        </dd>
        {subtareas > 0 && (
          <>
            <dt className="text-xs text-fg-faint">Subtareas</dt>
            <dd className="text-fg-body">
              {subtareas}
              <button
                type="button"
                onClick={() => hoja.verCronograma(it)}
                className="ml-2 text-xs text-accent hover:underline"
              >
                Ver cronograma
              </button>
            </dd>
          </>
        )}
      </dl>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button onClick={onAsignar} disabled={!puedeAsignar}>
          Asignar actividad <Tecla>A</Tecla>
        </Button>
        {hoja.canManage && (
          <Button variant="secondary" onClick={onConversado}>
            Ya lo conversamos <Tecla>C</Tecla>
          </Button>
        )}
        <Button variant="secondary" onClick={onProxima}>
          Dejar para la próxima <Tecla>P</Tecla>
        </Button>
        <div className="flex gap-1 sm:ml-auto">
          <Button variant="ghost" onClick={onAnterior} disabled={primero}>
            <Icon name="arrowLeft" size={16} />
            <span className="sr-only">Tema anterior</span>
          </Button>
          <Button variant="ghost" onClick={onSiguiente}>
            Siguiente <Tecla>→</Tecla>
          </Button>
        </div>
      </div>
      {!puedeAsignar && hoja.canAssign && !it.para_todos && it.responsables.length === 0 && (
        <p className="text-xs text-fg-faint -mt-3">Elige un responsable para poder asignar.</p>
      )}
    </div>
  )
}

/** La tecla solo se muestra con teclado fisico (desde sm): en el celular no hay donde apretarla. */
function Tecla({ children }: { children: ReactNode }) {
  return (
    <span className="hidden sm:inline-flex ml-1">
      <Kbd>{children}</Kbd>
    </span>
  )
}
