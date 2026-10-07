// Lista de proyectos del equipo.
//
// Un proyecto es un tema raiz de tipo='proyecto' (migracion 042, misma tabla y motor que
// Minuta/Ingesta, listas separadas por tipo -ver docblock de useMinuta-). No comparte la
// cadencia semanal de Minuta: no hace falta "conversarlo" cada semana, se le da seguimiento
// como iniciativa. Si una subtarea puntual se traba y si amerita conversarse, se escala a
// Minuta desde el detalle (mismo patron que useCompromisos.llevarAMinuta).
//
// Rediseno 2026 (idea 12): tabla en vez de tarjetas, para comparar proyectos entre si. Cada
// fila trae una mini linea de tiempo sobre una escala comun, con la marca de hoy.

import { ProjectDot } from '@shared/components/ui/ProjectDot'
import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@shared/components/ui/Button'
import { PageHeader } from '@shared/components/ui/PageHeader'
import { Modal } from '@shared/components/ui/Modal'
import { Input } from '@shared/components/ui/Input'
import { EmptyState } from '@shared/components/ui/EmptyState'
import { SkeletonRows } from '@shared/components/ui/Skeleton'
import { StatusLabel } from '@shared/components/ui/StatusLabel'
import { useMinuta } from '@features/minuta/hooks/useMinuta'
import {
  ESTADO_PROYECTO,
  escalaTiempo,
  plural,
  resumenPersonas,
  resumirProyecto,
} from '@features/proyectos/utils/proyecto'
import { AlertasTexto, AvanceProyecto } from './ProyectoIndicadores'
import { ProjectTimelineCell, TimelineMeses } from './ProjectTimelineCell'

export function ProyectosPage() {
  const { allItems, members, canManage, addItem, loading } = useMinuta('proyecto')
  const [creando, setCreando] = useState(false)
  const navigate = useNavigate()

  const memberName = (mid: string) => members.find((m) => m.id === mid)?.full_name || 'Desconocido'

  const filas = useMemo(
    () =>
      allItems
        .filter((it) => !it.parent_item_id)
        .map((p) => ({ proyecto: p, resumen: resumirProyecto(p, allItems) })),
    [allItems],
  )
  const escala = useMemo(
    () => escalaTiempo(filas.flatMap((f) => [f.resumen.inicio, f.resumen.fin])),
    [filas],
  )

  const abrir = (id: string) => navigate(`/proyectos/${id}`)

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Proyectos"
        meta={!loading && plural(filas.length, 'proyecto', 'proyectos')}
        actions={
          canManage && (
            <Button size="sm" icon="plus" onClick={() => setCreando(true)}>
              Nuevo proyecto
            </Button>
          )
        }
      />

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-3 sm:p-5">
            <SkeletonRows />
          </div>
        ) : filas.length === 0 ? (
          <EmptyState
            icon="folder"
            title="Todavía no hay proyectos"
            description='Se crean igual que un tema de minuta: por chat (eligiendo "Proyecto" en el selector) o con "Nuevo proyecto".'
            action={
              canManage && (
                <Button size="sm" variant="secondary" icon="plus" onClick={() => setCreando(true)}>
                  Nuevo proyecto
                </Button>
              )
            }
          />
        ) : (
          <>
            {/* Escritorio: tabla comparable. */}
            <table className="hidden md:table w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border text-left text-2xs font-semibold uppercase tracking-wide text-fg-faint">
                  <th className="py-2 pl-5 pr-3 font-semibold">Proyecto</th>
                  <th className="py-2 px-3 font-semibold w-36">Estado</th>
                  <th className="py-2 px-3 font-semibold w-32">Avance</th>
                  <th className="py-2 px-3 font-semibold w-40">Actividades</th>
                  <th className="py-2 px-3 font-semibold w-44">Alertas</th>
                  <th className="py-2 pl-3 pr-5 font-semibold w-[22%] min-w-48">
                    {escala ? <TimelineMeses escala={escala} /> : 'Fechas'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filas.map(({ proyecto: p, resumen: r }) => (
                  <tr
                    key={p.id}
                    onClick={() => abrir(p.id)}
                    className="border-b border-border cursor-pointer hover:bg-surface"
                  >
                    <td className="py-2 pl-5 pr-3 min-w-0">
                      {/* El nombre es un boton real: la fila es clickeable, pero con teclado
                          hace falta un elemento enfocable. */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          abrir(p.id)
                        }}
                        className="flex items-center gap-2 max-w-full text-left font-medium text-fg hover:underline"
                      >
                        <ProjectDot id={p.id} />
                        <span className="truncate">{p.tema}</span>
                      </button>
                      <span className="block text-xs text-fg-faint truncate">
                        {resumenPersonas(r.responsables, memberName)}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <StatusLabel {...ESTADO_PROYECTO[r.estado]} />
                    </td>
                    <td className="py-2 px-3">
                      <AvanceProyecto avance={r.avance} className="text-xs" />
                    </td>
                    <td className="py-2 px-3 text-xs text-fg-muted whitespace-nowrap">
                      {r.actividades}
                      {r.subtareas > 0 && (
                        <span className="text-fg-faint">
                          {' · '}
                          {plural(r.subtareas, 'subtarea', 'subtareas')}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-xs">
                      <AlertasTexto alertas={r.alertas} />
                    </td>
                    <td className="py-2 pl-3 pr-5">
                      {escala && (r.inicio || r.fin) ? (
                        <ProjectTimelineCell
                          escala={escala}
                          inicio={r.inicio}
                          fin={r.fin}
                          avance={r.avance}
                          atrasado={r.estado === 'atrasado'}
                        />
                      ) : (
                        <span className="text-xs text-fg-faint">Sin fechas</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Movil: lista de dos lineas (nombre y estado / avance y alertas). */}
            <ul className="md:hidden divide-y divide-border border-b border-border">
              {filas.map(({ proyecto: p, resumen: r }) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => abrir(p.id)}
                    className="w-full text-left px-4 py-2.5 hover:bg-surface"
                  >
                    <span className="flex items-center gap-3">
                      <ProjectDot id={p.id} />
                      <span className="flex-1 min-w-0 truncate text-sm font-medium text-fg">
                        {p.tema}
                      </span>
                      <StatusLabel {...ESTADO_PROYECTO[r.estado]} />
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-fg-muted">
                      <span className="tabular-nums">
                        {r.avance === null ? '—' : `${r.avance}%`}
                      </span>
                      <span className="text-fg-faint">·</span>
                      <span>{plural(r.actividades, 'actividad', 'actividades')}</span>
                      {(r.alertas.vencidas > 0 || r.alertas.hoy > 0 || r.alertas.proximas > 0) && (
                        <>
                          <span className="text-fg-faint">·</span>
                          <AlertasTexto alertas={r.alertas} />
                        </>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {creando && (
        <NuevoProyectoModal
          onClose={() => setCreando(false)}
          onCreate={async (nombre) => {
            const id = await addItem(nombre)
            setCreando(false)
            if (id) navigate(`/proyectos/${id}`)
          }}
        />
      )}
    </div>
  )
}

/** Formulario corto: solo el nombre. Fechas, responsables y actividades se cargan en el detalle,
 * que se abre apenas se crea. */
function NuevoProyectoModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (nombre: string) => Promise<void>
}) {
  const [nombre, setNombre] = useState('')
  const [guardando, setGuardando] = useState(false)

  const enviar = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!nombre.trim() || guardando) return
    setGuardando(true)
    try {
      await onCreate(nombre.trim())
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Nuevo proyecto"
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" onClick={() => enviar()} disabled={!nombre.trim()} loading={guardando}>
            Crear proyecto
          </Button>
        </>
      }
    >
      <form onSubmit={enviar}>
        <Input
          autoFocus
          label="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej. Migración a Fabric"
        />
      </form>
    </Modal>
  )
}
