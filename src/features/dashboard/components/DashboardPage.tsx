import { useState } from 'react'
import { PageHeader } from '@shared/components/ui/PageHeader'
import { SegmentedControl } from '@shared/components/ui/SegmentedControl'
import { Button } from '@shared/components/ui/Button'
import { EmptyState } from '@shared/components/ui/EmptyState'
import { Skeleton } from '@shared/components/ui/Skeleton'
import { useCapabilities } from '@core/auth/hooks/useCapabilities'
import { useDashboard } from '@features/dashboard/hooks/useDashboard'
import { AiAccuracyPanel } from '@features/dashboard/components/AiAccuracyPanel'
import { Kpis } from '@features/dashboard/components/Kpis'
import { BarrasRendimiento, LineaCompromisos } from '@features/dashboard/components/Graficos'
import {
  CargaPanel,
  ErroresPanel,
  Leyenda,
  LeyendaCarga,
  ListaActividades,
  Panel,
  ProyectosPanel,
  VerTodo,
} from '@features/dashboard/components/Paneles'
import {
  CAPACIDAD_HORAS,
  PERIODO,
  semanaISO,
  type Periodo,
} from '@features/dashboard/utils/metricas'
import { exportarDashboard } from '@features/dashboard/utils/exportar'

type Vista = 'equipo' | 'ia'

// Como se nombra el periodo en los textos de las tarjetas.
const TEXTOS: Record<Periodo, { contra: string; en: string }> = {
  semana: { contra: 'la semana anterior', en: 'esta semana' },
  mes: { contra: 'las 4 semanas anteriores', en: 'en 4 semanas' },
  trimestre: { contra: 'el trimestre anterior', en: 'en el trimestre' },
}

const LISTA = 5

/**
 * Dashboard del equipo: cuatro indicadores con su tendencia, rendimiento y compromisos semana
 * a semana, carga por persona, proyectos y listas que llevan directo a la accion. Todo sale de
 * datos que ya existen; el periodo elegido solo cambia el calculo, no vuelve a cargar.
 */
export function DashboardPage() {
  const { isGlobalAdmin, can } = useCapabilities()
  const [vista, setVista] = useState<Vista>('equipo')
  const [periodo, setPeriodo] = useState<Periodo>('semana')
  const d = useDashboard(periodo)

  const meta = [d.teamName, `semana ${semanaISO(new Date())}`].filter(Boolean).join(' · ')
  // Un colaborador ve solo lo suyo: el nombre del responsable en cada fila sobra.
  const mostrarResponsable = !d.isColaborador
  const texto = TEXTOS[periodo]
  const enEquipo = !(isGlobalAdmin && vista === 'ia')

  const exportar = () =>
    exportarDashboard({
      equipo: d.teamName ?? '',
      periodo: PERIODO[periodo].label,
      indicadores: [
        ['Pendientes', d.kpis.pendientes.valor],
        ['Vencidas', d.kpis.vencidas.valor],
        [`Completadas (${texto.en})`, d.kpis.completadas.valor],
        [
          `Compromisos cumplidos (${texto.en})`,
          d.kpis.compromisos.porcentaje === null ? '' : `${d.kpis.compromisos.porcentaje}%`,
        ],
        ['Errores abiertos', d.errores.length],
      ],
      rendimiento: d.rendimiento,
      compromisos: d.compromisosSemana,
      carga: d.carga,
    })

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Resumen del equipo"
        meta={meta}
        actions={
          <>
            {enEquipo && !d.loading && !d.error && (
              <>
                <SegmentedControl
                  label="Periodo"
                  value={periodo}
                  onChange={setPeriodo}
                  className="hidden sm:inline-flex"
                  options={(Object.keys(PERIODO) as Periodo[]).map((p) => ({
                    value: p,
                    label: PERIODO[p].label,
                  }))}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  icon="download"
                  onClick={exportar}
                  className="hidden sm:inline-flex"
                >
                  Exportar
                </Button>
              </>
            )}
            {/* Precision de la IA: solo el admin global, es una senal de operacion del producto. */}
            {isGlobalAdmin && (
              <SegmentedControl
                label="Sección del dashboard"
                value={vista}
                onChange={setVista}
                options={[
                  { value: 'equipo', label: 'Equipo' },
                  { value: 'ia', label: 'Precisión de la IA' },
                ]}
              />
            )}
          </>
        }
      >
        {/* En el celular el selector de periodo baja a su propia fila: arriba no cabe. */}
        {enEquipo && !d.loading && !d.error && (
          <div className="px-3 pb-2 sm:hidden">
            <SegmentedControl
              label="Periodo"
              value={periodo}
              onChange={setPeriodo}
              options={(Object.keys(PERIODO) as Periodo[]).map((p) => ({
                value: p,
                label: PERIODO[p].label,
              }))}
            />
          </div>
        )}
      </PageHeader>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl space-y-3.5 px-3 py-4 sm:px-5">
          {!enEquipo ? (
            <AiAccuracyPanel />
          ) : d.loading ? (
            <div className="space-y-3.5" aria-busy="true" aria-label="Cargando">
              <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-[118px]" />
                ))}
              </div>
              <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[2fr_1fr]">
                <Skeleton className="h-64" />
                <Skeleton className="h-64" />
              </div>
            </div>
          ) : d.error ? (
            <EmptyState
              icon="alert"
              title="No se pudo cargar el resumen"
              description="Revisa tu conexión e inténtalo de nuevo."
              action={
                <Button variant="secondary" size="sm" icon="refresh" onClick={d.reload}>
                  Reintentar
                </Button>
              }
            />
          ) : (
            <>
              <Kpis
                pendientes={d.kpis.pendientes}
                vencidas={d.kpis.vencidas}
                completadas={d.kpis.completadas}
                compromisos={d.kpis.compromisos}
                contra={texto.contra}
                enPeriodo={texto.en}
              />

              <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[2fr_1fr]">
                <Panel
                  title="Rendimiento"
                  nota={`completadas vs creadas, últimas ${d.rendimiento.length} semanas`}
                  accion={
                    <Leyenda
                      items={[
                        { label: 'Completadas', className: 'bg-tag-green' },
                        { label: 'Creadas', className: 'bg-border-strong' },
                      ]}
                    />
                  }
                >
                  <BarrasRendimiento datos={d.rendimiento} />
                </Panel>
                <Panel
                  title="Compromisos"
                  nota="% cumplido por semana"
                  accion={<VerTodo to="/compromisos">Abrir</VerTodo>}
                >
                  <LineaCompromisos datos={d.compromisosSemana} meta={d.kpis.compromisos.meta} />
                </Panel>
              </div>

              <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
                <Panel
                  title="Carga por persona"
                  nota={`horas abiertas vs capacidad (${CAPACIDAD_HORAS} h)`}
                  accion={<LeyendaCarga />}
                >
                  <CargaPanel carga={d.carga} />
                </Panel>
                <Panel
                  title="Proyectos"
                  nota="avance y alertas"
                  accion={
                    <VerTodo to="/proyectos">
                      Ver todos{d.proyectos.length > LISTA ? ` (${d.proyectos.length})` : ''}
                    </VerTodo>
                  }
                >
                  <ProyectosPanel proyectos={d.proyectos.slice(0, LISTA)} />
                </Panel>
              </div>

              <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
                <Panel
                  title="Atrasado"
                  nota={d.vencidas.length > LISTA ? `${LISTA} de ${d.vencidas.length}` : undefined}
                  accion={<VerTodo to="/activities">Ver en Actividades</VerTodo>}
                >
                  <ListaActividades
                    items={d.vencidas.slice(0, LISTA)}
                    memberNames={d.memberNames}
                    origenes={d.origenes}
                    mostrarResponsable={mostrarResponsable}
                    vacio="Nada atrasado."
                  />
                </Panel>
                <Panel title="Vence pronto" nota="próximos 7 días">
                  <ListaActividades
                    items={d.proximas.slice(0, LISTA)}
                    memberNames={d.memberNames}
                    origenes={d.origenes}
                    mostrarResponsable={mostrarResponsable}
                    vacio="Nada vence en los próximos 7 días."
                  />
                </Panel>
                <Panel
                  title="Errores abiertos"
                  nota="por antigüedad"
                  accion={can('modulos.errores') && <VerTodo to="/errors">Ver todos</VerTodo>}
                >
                  <ErroresPanel edad={d.edadErrores} total={d.errores.length} />
                </Panel>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
