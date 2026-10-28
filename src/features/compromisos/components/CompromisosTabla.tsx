// Tabla de compromisos (idea 10 de la propuesta UI/UX): UNA tabla plana con filas de
// encabezado por persona, en vez de una tarjeta por persona dentro de un bloque por grupo.
// La columna "Semanas abierto" hace visible la regla de EOS de las dos semanas sin tener que
// explicarla: tres casillas que se llenan, y a la tercera la accion sugerida pasa a ser
// "A la minuta".

import { ProjectDot } from '@shared/components/ui/ProjectDot'
import { Fragment, useState } from 'react'
import { Avatar } from '@shared/components/ui/Avatar'
import { Button, IconButton } from '@shared/components/ui/Button'
import { ComentarioLibre } from '@shared/components/ui/ComentarioLibre'
import { Icon } from '@shared/components/ui/Icon'
import { DueDate, ProgressBar } from '@shared/components/ui/Indicators'
import { StatusLabel } from '@shared/components/ui/StatusLabel'
import { cx } from '@shared/utils/cx'
import type {
  Compromiso,
  GrupoDeTrabajoCompromisos,
  GrupoPersona,
} from '@features/compromisos/hooks/useCompromisos'
import {
  estadoCompromiso,
  semanasAbierto,
  tonoAvance,
} from '@features/compromisos/utils/filaCompromiso'

export interface AccionesCompromiso {
  conduce: boolean
  /** Marca hecho quien conduce, el responsable o quien edita actividades ajenas. */
  puedeMarcar: (c: Compromiso) => boolean
  alMarcar: (c: Compromiso) => void
  alMover: (c: Compromiso) => void
  alDiscutir: (c: Compromiso) => void
  alGuardarComentario: (c: Compromiso, next: string) => void
}

function Semanas({ n }: { n: number }) {
  return (
    <span
      role="img"
      aria-label={
        n === 0 ? 'Al día' : `Abierto ${n === 3 ? '3 o más' : n} semana${n === 1 ? '' : 's'}`
      }
      title={n === 3 ? 'Más de dos semanas: conviene conversarlo en la minuta' : undefined}
      className="inline-flex gap-0.5 align-middle"
    >
      {[1, 2, 3].map((i) => (
        <i
          key={i}
          className={cx(
            'w-2.5 h-2.5 rounded-sm',
            i > n ? 'bg-border' : n >= 3 ? 'bg-danger' : 'bg-warning',
          )}
        />
      ))}
    </span>
  )
}

function Origen({ c }: { c: Compromiso }) {
  return (
    <span className="inline-flex items-center gap-1 min-w-0">
      {c.origen === 'subtema' && (
        <>
          <Icon name="folder" size={12} className="shrink-0" />
          <span className="truncate" title="Compromiso de un subtema de minuta">
            {c.origenProyecto}
          </span>
        </>
      )}
      {c.origen === 'proyecto' && (
        <span
          className="inline-flex items-center gap-1.5 min-w-0"
          title="Compromiso de un proyecto"
        >
          {c.origenProyectoId && <ProjectDot id={c.origenProyectoId} className="!w-2 !h-2" />}
          <span className="truncate">{c.origenProyecto}</span>
        </span>
      )}
      {c.origen === 'minuta' && <span>Minuta</span>}
    </span>
  )
}

const COLS = 6

function FilaCompromiso({ c, acciones }: { c: Compromiso; acciones: AccionesCompromiso }) {
  const { conduce } = acciones
  const [verNota, setVerNota] = useState(false)
  const hecha = c.status === 'completado'
  const semanas = semanasAbierto(c)
  // Los comentarios del compromiso son los del tema que lo origino. Se ocultan si estan
  // vacios y nadie puede editarlos, para no ensuciar la vista rapida de la reunion.
  const hayNota = !!c.temaId && (conduce || !!c.comentariosTema)
  const td = 'px-3 py-2 align-top border-b border-border'

  return (
    <>
      <tr className="hover:bg-surface-soft">
        <td className={cx(td, 'w-10 pl-4 sm:pl-5')}>
          {/* Casilla: el gesto principal de la reunion, un clic y sin modal. */}
          <button
            type="button"
            role="checkbox"
            aria-checked={hecha}
            aria-label={
              hecha ? `Marcar "${c.title}" como no hecha` : `Marcar "${c.title}" como hecha`
            }
            onClick={() => acciones.alMarcar(c)}
            disabled={!acciones.puedeMarcar(c)}
            title={
              acciones.puedeMarcar(c) ? undefined : 'Solo lo marca su responsable o quien conduce'
            }
            className={cx(
              'mt-0.5 w-4 h-4 rounded-sm border inline-flex items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-50',
              hecha
                ? 'bg-success border-success text-on-accent'
                : 'border-border-strong enabled:hover:border-success enabled:hover:bg-success-soft',
            )}
          >
            {hecha && <Icon name="check" size={12} strokeWidth={2.5} />}
          </button>
        </td>
        <td className={td}>
          <p className={cx('text-sm', hecha ? 'text-fg-faint line-through' : 'text-fg')}>
            {c.title}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-fg-faint">
            <Origen c={c} />
            {/* Cuantas veces se movio la fecha (migracion 035): un compromiso movido varias
                veces no es un atraso mas, es señal de que hay otra conversacion pendiente. */}
            {(c.plazo_change_count ?? 0) > 0 && (
              <span title="Veces que se movió la fecha de entrega desde que se creó">
                · movida {c.plazo_change_count} {c.plazo_change_count === 1 ? 'vez' : 'veces'}
              </span>
            )}
            {/* En el celular las columnas de fecha y estado no caben: van aqui. */}
            <span className="md:hidden inline-flex items-center gap-2">
              · <DueDate date={c.due_date} done={hecha} />
              <StatusLabel {...estadoCompromiso(c)} />
            </span>
          </div>
        </td>
        <td className={cx(td, 'hidden md:table-cell whitespace-nowrap')}>
          <DueDate date={c.due_date} done={hecha} className="text-sm" />
        </td>
        <td className={cx(td, 'hidden md:table-cell')}>{!hecha && <Semanas n={semanas} />}</td>
        <td className={cx(td, 'hidden md:table-cell')}>
          <StatusLabel {...estadoCompromiso(c)} />
        </td>
        <td className={cx(td, 'pr-4 sm:pr-5 text-right whitespace-nowrap')}>
          <div className="inline-flex items-center gap-1">
            {/* Solo en lo no cumplido, y solo para quien conduce: arrastrar o discutir. En EOS
                lo no hecho se mueve o se conversa, no se justifica en el momento. */}
            {!hecha && conduce && (
              <>
                <Button size="xs" variant="ghost" onClick={() => acciones.alMover(c)}>
                  +1 semana
                </Button>
                {/* Una vez escalado, la fila lo dice y el boton desaparece: antes no cambiaba
                    nada al apretarlo y se creaban temas repetidos. */}
                {c.enMinuta ? (
                  <span
                    className="px-2 text-xs text-fg-faint"
                    title="Queda para conversar en la minuta"
                  >
                    En la minuta
                  </span>
                ) : (
                  <Button
                    size="xs"
                    variant={semanas >= 3 ? 'primary' : 'ghost'}
                    onClick={() => acciones.alDiscutir(c)}
                    title="Si hay un bloqueo de fondo, va a la minuta para conversarlo"
                  >
                    A la minuta
                  </Button>
                )}
              </>
            )}
            {hayNota && (
              <IconButton
                icon="chat"
                size="xs"
                label={verNota ? 'Ocultar comentario' : 'Ver comentario'}
                aria-expanded={verNota}
                onClick={() => setVerNota((v) => !v)}
                className={c.comentariosTema ? 'text-accent' : undefined}
              />
            )}
          </div>
        </td>
      </tr>
      {hayNota && verNota && (
        <tr>
          <td className="border-b border-border" />
          <td colSpan={COLS - 1} className="px-3 pb-2.5 pt-0 pr-4 sm:pr-5 border-b border-border">
            <div className="max-w-xl">
              <ComentarioLibre
                value={c.comentariosTema}
                canEdit={conduce}
                onSave={(next) => acciones.alGuardarComentario(c, next)}
                textClassName="text-xs text-fg-muted"
              />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

/** Fila de encabezado de una persona: avance, cumplidos y vencidos en una linea. */
function FilaPersona({
  g,
  abierta,
  plegable,
  onToggle,
  soloVencidos,
  meta,
  sangria,
}: {
  g: GrupoPersona
  abierta: boolean
  plegable: boolean
  onToggle: () => void
  /** Lista de vencidos sin cerrar: el % de la persona seria siempre 0, asi que no se muestra. */
  soloVencidos: boolean
  meta: number
  sangria: boolean
}) {
  return (
    <tr>
      <td colSpan={COLS} className="p-0 border-b border-border bg-surface">
        <button
          type="button"
          onClick={onToggle}
          disabled={!plegable}
          aria-expanded={plegable ? abierta : undefined}
          className={cx(
            'w-full flex flex-wrap items-center gap-x-3 gap-y-1 py-2 pr-4 sm:pr-5 text-left text-sm',
            sangria ? 'pl-8 sm:pl-9' : 'pl-4 sm:pl-5',
            plegable && 'hover:bg-surface-2',
          )}
        >
          {plegable && (
            <Icon
              name={abierta ? 'chevronDown' : 'chevronRight'}
              size={14}
              className="text-fg-faint -ml-1"
            />
          )}
          <span className="inline-flex items-center gap-2 min-w-0">
            <Avatar name={g.nombre} src={g.avatar} size="xs" />
            <span className="font-medium text-fg truncate">{g.nombre}</span>
          </span>
          {!soloVencidos && (
            <span className="inline-flex items-center gap-2 text-xs text-fg-muted tabular-nums">
              <span className="font-semibold text-fg">{g.porcentaje}%</span>
              <ProgressBar
                value={g.porcentaje ?? 0}
                tone={tonoAvance(g.porcentaje, meta)}
                className="w-14"
                label={`Avance de ${g.nombre}`}
              />
              <span>
                {g.cumplidos}/{g.total}
              </span>
            </span>
          )}
          {g.vencidos > 0 && (
            <span className="text-xs text-danger">
              {g.vencidos} vencido{g.vencidos === 1 ? '' : 's'}
            </span>
          )}
        </button>
      </td>
    </tr>
  )
}

export function CompromisosTabla({
  personas,
  grupos,
  soloVencidos,
  meta,
  estaAbierta,
  alternar,
  grupoAbierto,
  alternarGrupo,
  plegable,
  acciones,
}: {
  personas: GrupoPersona[]
  /** Si viene, la tabla se agrupa por grupo de trabajo (grupo -> personas). */
  grupos: GrupoDeTrabajoCompromisos[] | null
  soloVencidos: boolean
  meta: number
  estaAbierta: (id: string) => boolean
  alternar: (id: string) => void
  grupoAbierto: (id: string) => boolean
  alternarGrupo: (id: string) => void
  plegable: boolean
  acciones: AccionesCompromiso
}) {
  const th = 'sticky top-0 z-[1] bg-panel border-b border-border px-3 py-2 font-medium text-left'

  const bloquePersona = (g: GrupoPersona, sangria: boolean) => (
    <Fragment key={g.id}>
      <FilaPersona
        g={g}
        abierta={estaAbierta(g.id)}
        plegable={plegable}
        onToggle={() => alternar(g.id)}
        soloVencidos={soloVencidos}
        meta={meta}
        sangria={sangria}
      />
      {estaAbierta(g.id) &&
        g.compromisos.map((c) => <FilaCompromiso key={c.id} c={c} acciones={acciones} />)}
    </Fragment>
  )

  return (
    <table className="w-full text-sm border-separate border-spacing-0">
      <thead className="text-xs text-fg-faint">
        <tr>
          <th className={cx(th, 'pl-4 sm:pl-5 w-10')}>
            <span className="sr-only">Hecho</span>
          </th>
          <th className={th}>Compromiso</th>
          <th className={cx(th, 'hidden md:table-cell')}>Entrega</th>
          <th className={cx(th, 'hidden md:table-cell')}>Semanas abierto</th>
          <th className={cx(th, 'hidden md:table-cell')}>Estado</th>
          <th className={cx(th, 'pr-4 sm:pr-5')}>
            <span className="sr-only">Acciones</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {grupos
          ? grupos.map((grupo) => {
              const id = grupo.id ?? 'sin-grupo'
              const abierto = grupoAbierto(id)
              const total = grupo.personas.reduce((s, p) => s + p.total, 0)
              const cumplidos = grupo.personas.reduce((s, p) => s + p.cumplidos, 0)
              const pct = total ? Math.round((cumplidos / total) * 100) : null
              return (
                <Fragment key={id}>
                  <tr>
                    <td colSpan={COLS} className="p-0 border-b border-border">
                      <button
                        type="button"
                        onClick={() => alternarGrupo(id)}
                        aria-expanded={abierto}
                        className="w-full flex items-center gap-2 pl-4 sm:pl-5 pr-4 py-2 text-left hover:bg-surface"
                      >
                        <Icon
                          name={abierto ? 'chevronDown' : 'chevronRight'}
                          size={14}
                          className="text-fg-faint -ml-1"
                        />
                        <span className="text-xs font-semibold text-fg-muted">{grupo.nombre}</span>
                        <span className="text-xs text-fg-faint">
                          {grupo.personas.length} persona{grupo.personas.length === 1 ? '' : 's'}
                        </span>
                        {pct !== null && (
                          <span className="text-xs font-semibold text-fg tabular-nums">{pct}%</span>
                        )}
                      </button>
                    </td>
                  </tr>
                  {abierto && grupo.personas.map((g) => bloquePersona(g, true))}
                </Fragment>
              )
            })
          : personas.map((g) => bloquePersona(g, false))}
      </tbody>
    </table>
  )
}
