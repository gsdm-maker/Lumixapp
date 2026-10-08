// Hoja de compromisos: la pantalla que se proyecta en la reunion semanal.
//
// DECISIONES DE DISEÑO, Y POR QUE
//
// 1. Marcar hecho es UN clic sobre una casilla. En una reunion de 5 minutos con el equipo
//    mirando, cualquier cosa que exija abrir un modal rompe el ritmo.
// 2. El % de cumplimiento con la meta de 90% al lado es la unica metrica de la reunion; vive
//    en UNA linea de resumen arriba (antes era un bloque grande), junto a lo que lleva mas de
//    dos semanas abierto, que es lo primero que hay que conversar.
// 3. Agrupado por persona, porque la pregunta que se hace es "a ti te tocaba esto". Una sola
//    tabla plana con filas de encabezado por persona, sin tarjetas dentro de tarjetas.
// 4. Las acciones de lo no cumplido -mover una semana, llevar a minuta- aparecen SOLO en
//    las filas no cumplidas, y solo para quien conduce. No se ofrece nada mas: en EOS lo no
//    hecho se arrastra o se discute, no se justifica en el momento.

import { useState } from 'react'
import { Button, IconButton } from '@shared/components/ui/Button'
import { EmptyState } from '@shared/components/ui/EmptyState'
import { ProgressBar } from '@shared/components/ui/Indicators'
import { PageHeader } from '@shared/components/ui/PageHeader'
import { SegmentedControl } from '@shared/components/ui/SegmentedControl'
import { SkeletonRows } from '@shared/components/ui/Skeleton'
import { useToast } from '@shared/components/ui/Toast'
import { useAuth } from '@core/auth/hooks/useAuth'
import { useCapabilities } from '@core/auth/hooks/useCapabilities'
import {
  semanaDe,
  useCompromisos,
  type Compromiso,
} from '@features/compromisos/hooks/useCompromisos'
import {
  CompromisosTabla,
  type AccionesCompromiso,
} from '@features/compromisos/components/CompromisosTabla'
import { tonoAvance } from '@features/compromisos/utils/filaCompromiso'
import { CerrarSemanaModal } from '@features/compromisos/components/CerrarSemanaModal'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** Numero de semana ISO 8601 (la que usa el calendario de la empresa: semana 1 = la del 4 de enero). */
function semanaISO(lunes: Date): number {
  const jueves = new Date(lunes)
  jueves.setDate(lunes.getDate() + 3)
  const primerJueves = new Date(jueves.getFullYear(), 0, 4)
  primerJueves.setDate(primerJueves.getDate() + 3 - ((primerJueves.getDay() + 6) % 7))
  return 1 + Math.round((jueves.getTime() - primerJueves.getTime()) / (7 * 86_400_000))
}

/** "5–11 oct", o "29 sep – 5 oct" si la semana cruza de mes. */
function rangoCorto(desde: Date, hasta: Date): string {
  return desde.getMonth() === hasta.getMonth()
    ? `${desde.getDate()}–${hasta.getDate()} ${MESES[hasta.getMonth()]}`
    : `${desde.getDate()} ${MESES[desde.getMonth()]} – ${hasta.getDate()} ${MESES[hasta.getMonth()]}`
}

export function CompromisosPage() {
  const {
    porPersona,
    porGrupo,
    vencidosPorPersona,
    totalVencidos,
    resumen,
    loading,
    offset,
    setOffset,
    etiqueta,
    esSemanaActual,
    marcar,
    moverUnaSemana,
    llevarAMinuta,
    guardarComentario,
    reload,
  } = useCompromisos()
  // Conducir (mover de semana, llevar a minuta, comentar el tema) tiene permiso propio desde
  // la migracion 049. Antes se usaba "ver todas las actividades": un invitado veia los
  // botones y la base se los rechazaba, porque esas escrituras van a la minuta.
  const { canConducirCompromisos: conduce, canEditAllActivities } = useCapabilities()
  const { profile } = useAuth()
  const toast = useToast()

  // Arranca TODO PLEGADO: la primera mirada es el tablero del equipo -quien va como- y
  // recien despues se abre a la persona de la que se esta hablando.
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())
  const alternar = (id: string) =>
    setAbiertos((cur) => {
      const n = new Set(cur)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  // "Por grupo" agrega un nivel de plegado propio (grupo -> personas). Solo se ofrece si el
  // equipo realmente tiene grupos con gente asignada.
  const [vista, setVista] = useState<'persona' | 'grupo'>('persona')
  const [gruposAbiertos, setGruposAbiertos] = useState<Set<string>>(new Set())
  const alternarGrupo = (id: string) =>
    setGruposAbiertos((cur) => {
      const n = new Set(cur)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  // Modo "vencidos sin cerrar": cambia la ventana semanal por TODO lo vencido y abierto, de
  // cualquier semana. Sin esto, lo que nadie movio ni cumplio quedaba escondido en su semana
  // y solo se veia retrocediendo con la flecha -la trampa que reporto Sebastian-.
  const [verVencidos, setVerVencidos] = useState(false)
  const [cerrando, setCerrando] = useState(false)
  const lista = verVencidos ? vencidosPorPersona : porPersona
  const porGrupoActivo = !verVencidos && vista === 'grupo' && porGrupo.length > 0

  // Si solo hay una persona -un colaborador viendo lo suyo- plegar no aporta nada.
  const soloUno = lista.length === 1
  const estaAbierta = (id: string) => soloUno || abiertos.has(id)
  const todoAbierto =
    lista.length > 0 &&
    lista.every((g) => abiertos.has(g.id)) &&
    (!porGrupoActivo || porGrupo.every((g) => gruposAbiertos.has(g.id ?? 'sin-grupo')))
  const expandirTodo = () => {
    if (todoAbierto) {
      setAbiertos(new Set())
      setGruposAbiertos(new Set())
    } else {
      setAbiertos(new Set(lista.map((g) => g.id)))
      setGruposAbiertos(new Set(porGrupo.map((g) => g.id ?? 'sin-grupo')))
    }
  }

  // Regla de EOS: nada deberia quedar mas de dos semanas dando vueltas. Se cuenta sobre TODO
  // lo vencido (no solo esta semana): lo de la semana en curso nunca lleva dos semanas.
  const vencidosLista = vencidosPorPersona.flatMap((g) => g.compromisos)
  const masDeDosSemanas = vencidosLista.filter((c) => c.diasVencida > 14).length
  const abiertosSemana = porPersona
    .flatMap((g) => g.compromisos)
    .filter((c) => c.status !== 'completado')

  const { desde, hasta } = semanaDe(offset)

  const acciones: AccionesCompromiso = {
    conduce,
    puedeMarcar: (c) => conduce || canEditAllActivities || c.responsible_id === profile?.id,
    alMarcar: (c) =>
      marcar(c.id, c.status !== 'completado').catch(() => toast.error('No se pudo guardar')),
    alMover: (c) =>
      moverUnaSemana(c)
        .then(() => toast.success('Movido a la próxima semana'))
        .catch(() => toast.error('No se pudo mover')),
    alDiscutir: (c) =>
      llevarAMinuta(c)
        .then(() => toast.success('Agregado a la minuta para conversarlo'))
        .catch(() => toast.error('No se pudo agregar a la minuta')),
    alGuardarComentario: (c: Compromiso, next: string) => {
      if (!c.temaId) return
      guardarComentario(c.temaId, next).catch(() => toast.error('No se pudo guardar el comentario'))
    },
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={verVencidos ? 'Vencidos sin cerrar' : 'Compromisos'}
        meta={verVencidos ? `${totalVencidos} en total, de cualquier semana` : undefined}
        leading={
          verVencidos ? (
            <IconButton
              icon="arrowLeft"
              label="Volver a la semana"
              onClick={() => setVerVencidos(false)}
            />
          ) : undefined
        }
        actions={
          <>
            {conduce && !verVencidos && resumen.total > 0 && (
              <Button size="sm" variant="secondary" onClick={() => setCerrando(true)}>
                Cerrar semana
              </Button>
            )}
            <IconButton icon="refresh" label="Actualizar" onClick={reload} />
          </>
        }
      >
        {!verVencidos && (
          // Una sola linea de resumen (idea 10): semana, %, cuantos, y lo que lleva mas de dos
          // semanas. Antes era un bloque de tres filas con barra a todo el ancho.
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <div className="inline-flex items-center">
              <IconButton
                icon="chevronLeft"
                size="xs"
                label="Semana anterior"
                onClick={() => setOffset(offset - 1)}
              />
              <span className="px-1 text-fg-body whitespace-nowrap tabular-nums" title={etiqueta}>
                Semana {semanaISO(desde)} · {rangoCorto(desde, hasta)}
              </span>
              <IconButton
                icon="chevronRight"
                size="xs"
                label="Semana siguiente"
                onClick={() => setOffset(offset + 1)}
              />
              {!esSemanaActual && (
                <Button size="xs" variant="ghost" onClick={() => setOffset(0)}>
                  Esta semana
                </Button>
              )}
            </div>
            {resumen.total > 0 && (
              <>
                <span className="inline-flex items-baseline gap-1.5">
                  <span className="text-2xl font-semibold text-fg tabular-nums">
                    {resumen.porcentaje}%
                  </span>
                  <span className="text-fg-muted">cumplido · meta {resumen.meta}%</span>
                  <ProgressBar
                    value={resumen.porcentaje ?? 0}
                    tone={tonoAvance(resumen.porcentaje, resumen.meta)}
                    className="w-20 self-center ml-1"
                    label="Cumplimiento de la semana"
                  />
                </span>
                <span className="text-fg-muted tabular-nums">
                  {resumen.cumplidos} de {resumen.total}
                </span>
              </>
            )}
            {masDeDosSemanas > 0 && (
              <span className="text-danger">
                {masDeDosSemanas} abierto{masDeDosSemanas === 1 ? '' : 's'} hace más de 2 semanas
              </span>
            )}
          </div>
        )}
      </PageHeader>

      <div className="shrink-0 flex flex-wrap items-center gap-2 px-3 sm:px-5 py-2 border-b border-border bg-panel">
        {/* Siempre visible y con el numero adelante: aunque nadie lo apriete, el equipo ve
            cuanto quedo atras. Si no hay nada, lo dice tranquilo en vez de desaparecer. */}
        {!verVencidos &&
          !loading &&
          (totalVencidos > 0 ? (
            <Button
              size="sm"
              variant="ghost"
              icon="alert"
              className="text-danger hover:text-danger"
              onClick={() => {
                setVerVencidos(true)
                setVista('persona')
              }}
            >
              Ver {totalVencidos} compromiso{totalVencidos === 1 ? '' : 's'} vencido
              {totalVencidos === 1 ? '' : 's'} sin cerrar
            </Button>
          ) : (
            <span className="text-xs text-fg-faint">Sin compromisos vencidos</span>
          ))}
        <div className="flex-1" />
        {!verVencidos && porGrupo.length > 0 && (
          <SegmentedControl
            label="Agrupar"
            value={vista}
            onChange={setVista}
            options={[
              { value: 'persona', label: 'Por persona' },
              { value: 'grupo', label: 'Por grupo' },
            ]}
          />
        )}
        {lista.length > 1 && (
          <Button size="sm" variant="ghost" onClick={expandirTodo}>
            {todoAbierto ? 'Contraer todo' : 'Expandir todo'}
          </Button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-auto bg-panel">
        {loading ? (
          <div className="p-3 sm:px-5">
            <SkeletonRows />
          </div>
        ) : verVencidos && lista.length === 0 ? (
          <EmptyState
            icon="check"
            title="No hay compromisos vencidos sin cerrar"
            description="Todo lo comprometido está al día."
          />
        ) : lista.length === 0 ? (
          // Importante ser preciso: puede haber actividades del equipo esa semana y aun asi no
          // haber compromisos. Solo cuenta lo que se asigno desde la minuta o un proyecto.
          <EmptyState
            icon="calendar"
            title="No hay compromisos para esta semana"
            description={`Aquí solo aparece lo asignado desde la minuta o un proyecto con entrega entre el ${etiqueta}. Las actividades creadas por el chat o el listado no son compromisos del equipo.`}
          />
        ) : (
          <div className="lamina overflow-clip mx-3 sm:mx-5 my-3">
            <CompromisosTabla
              personas={lista}
              grupos={porGrupoActivo ? porGrupo : null}
              soloVencidos={verVencidos}
              meta={resumen.meta}
              estaAbierta={estaAbierta}
              alternar={alternar}
              grupoAbierto={(id) => gruposAbiertos.has(id)}
              alternarGrupo={alternarGrupo}
              plegable={!soloUno}
              acciones={acciones}
            />
          </div>
        )}
      </div>

      {cerrando && (
        <CerrarSemanaModal
          open
          onClose={() => setCerrando(false)}
          etiqueta={`Semana ${semanaISO(desde)} · ${rangoCorto(desde, hasta)}`}
          abiertos={abiertosSemana}
          porcentaje={resumen.porcentaje}
          cumplidos={resumen.cumplidos}
          total={resumen.total}
          moverUnaSemana={moverUnaSemana}
          llevarAMinuta={llevarAMinuta}
          onListo={reload}
        />
      )}
    </div>
  )
}
