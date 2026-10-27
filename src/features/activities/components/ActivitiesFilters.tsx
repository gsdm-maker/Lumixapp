import { useState } from 'react'
import { Button } from '@shared/components/ui/Button'
import { DatePicker } from '@shared/components/ui/DatePicker'
import { FilterBar, FilterChip, FilterSpacer, SearchInput } from '@shared/components/ui/FilterBar'
import { Select } from '@shared/components/ui/Input'
import { SegmentedControl } from '@shared/components/ui/SegmentedControl'
import { formatDateLocal } from '@shared/utils/date'
import type { Profile } from '@shared/types'
import type { GrupoTrabajo } from '@infrastructure/supabase/teams.service'
import type {
  FiltroEstado,
  FiltrosActividades,
  TipoFecha,
} from '@features/activities/hooks/useActivities'
import {
  ETIQUETA_PLAZO,
  type Agrupacion,
  type FiltroPlazo,
} from '@features/activities/utils/urgencia'
import { FECHA_FILTRO } from '@features/activities/utils/ui'

const ESTADOS: {
  value: Exclude<FiltroEstado, 'falta_informacion' | 'esperando_aprobacion'>
  label: string
}[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'activas', label: 'Activas' },
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'bloqueado', label: 'Bloqueadas' },
  { value: 'completado', label: 'Completadas' },
]

const AGRUPAR: { value: Agrupacion; label: string }[] = [
  { value: 'urgencia', label: 'Urgencia' },
  { value: 'persona', label: 'Persona' },
  { value: 'proyecto', label: 'Proyecto' },
  { value: 'ninguno', label: 'Ninguno' },
]

const TIPO_FECHA: Record<TipoFecha, string> = {
  entrega: 'Entrega',
  creadas: 'Creada',
  cerradas: 'Cerrada',
}

const corta = (ymd: string) => formatDateLocal(ymd, 'short').replace('.', '')

interface ActivitiesFiltersProps {
  filtros: FiltrosActividades
  counts: Record<FiltroEstado, number>
  setFilterStatus: (v: FiltroEstado) => void
  setFilterTeam: (v: string) => void
  setFilterMember: (v: string) => void
  setFilterGrupo: (v: string) => void
  setFilterPlazo: (v: FiltroPlazo) => void
  setDateType: (v: TipoFecha) => void
  setDateFrom: (v: string) => void
  setDateTo: (v: string) => void
  search: string
  setSearch: (v: string) => void
  teamNames: Record<string, string>
  members: Profile[]
  isManager: boolean
  gruposDisponibles: GrupoTrabajo[]
  agrupacion: Agrupacion
  setAgrupacion: (a: Agrupacion) => void
}

/**
 * Barra de filtros de Actividades (idea 7). Arriba lo que se usa siempre (estado, agrupar,
 * buscar); el resto se abre con "Filtros" y cada filtro aplicado queda como ficha que se quita
 * con la x. Todo envuelve en el celular: nada queda escondido tras un scroll horizontal.
 */
export function ActivitiesFilters(p: ActivitiesFiltersProps) {
  const { filtros: f } = p
  const [abierto, setAbierto] = useState(false)

  const variosEquipos = Object.keys(p.teamNames).length > 1
  const puedeGrupo = p.isManager && f.team !== 'todas' && p.gruposDisponibles.length > 0
  const hayRango = !!(f.dateFrom || f.dateTo)

  const fichas: { key: string; label: string; value: string; quitar: () => void }[] = []
  if (variosEquipos && f.team !== 'todas') {
    fichas.push({
      key: 'team',
      label: 'Equipo',
      value: p.teamNames[f.team] ?? 'Equipo',
      quitar: () => p.setFilterTeam('todas'),
    })
  }
  if (f.member !== 'todas') {
    fichas.push({
      key: 'member',
      label: 'Responsable',
      value: p.members.find((m) => m.id === f.member)?.full_name ?? 'Persona',
      quitar: () => p.setFilterMember('todas'),
    })
  }
  if (f.grupo !== 'todas') {
    fichas.push({
      key: 'grupo',
      label: 'Grupo',
      value: p.gruposDisponibles.find((g) => g.id === f.grupo)?.nombre ?? 'Grupo',
      quitar: () => p.setFilterGrupo('todas'),
    })
  }
  if (f.plazo !== 'todos') {
    fichas.push({
      key: 'plazo',
      label: 'Plazo',
      value: ETIQUETA_PLAZO[f.plazo],
      quitar: () => p.setFilterPlazo('todos'),
    })
  }
  if (hayRango) {
    // El rango solo filtra con las dos fechas puestas (useActivities); la ficha lo avisa.
    const valor =
      f.dateFrom && f.dateTo
        ? `${corta(f.dateFrom)} – ${corta(f.dateTo)}`
        : `${f.dateFrom ? `desde ${corta(f.dateFrom)}` : `hasta ${corta(f.dateTo)}`} (falta la otra fecha)`
    fichas.push({
      key: 'rango',
      label: TIPO_FECHA[f.dateType],
      value: valor,
      quitar: () => {
        p.setDateFrom('')
        p.setDateTo('')
      },
    })
  }

  return (
    <>
      <FilterBar>
        {/* Estado: segmentado desde sm; en el celular no cabe y pasa a un select. */}
        <div className="hidden sm:block">
          <SegmentedControl
            label="Estado"
            value={f.status}
            onChange={p.setFilterStatus}
            options={ESTADOS.map((e) => ({ ...e, count: p.counts[e.value] }))}
          />
        </div>
        <Select
          size="sm"
          aria-label="Estado"
          value={f.status}
          onChange={(e) => p.setFilterStatus(e.target.value as FiltroEstado)}
          // min-w: en una barra que se reparte en lineas, flex-1 solo lo encogia a un ovalo vacio.
          className="sm:hidden flex-1 min-w-[10rem]"
        >
          {ESTADOS.map((e) => (
            <option key={e.value} value={e.value}>
              {e.label} ({p.counts[e.value]})
            </option>
          ))}
        </Select>

        <Button
          size="sm"
          variant={abierto ? 'secondary' : 'ghost'}
          icon="filter"
          aria-expanded={abierto}
          aria-controls="filtros-actividades"
          onClick={() => setAbierto((v) => !v)}
        >
          Filtros
          {fichas.length > 0 && <span className="text-fg-faint tabular-nums">{fichas.length}</span>}
        </Button>

        {fichas.map((c) => (
          <FilterChip key={c.key} label={c.label} value={c.value} onRemove={c.quitar} />
        ))}

        <FilterSpacer grow />

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-fg-faint">Agrupar</span>
          <SegmentedControl
            label="Agrupar por"
            value={p.agrupacion}
            onChange={p.setAgrupacion}
            options={AGRUPAR}
          />
        </div>
        <SearchInput value={p.search} onChange={p.setSearch} placeholder="Buscar actividad…" />
      </FilterBar>

      {abierto && (
        <div
          id="filtros-actividades"
          className="shrink-0 flex flex-wrap items-end gap-2 px-3 sm:px-5 py-2.5 border-b border-border bg-surface-soft"
        >
          {variosEquipos && (
            <Select
              size="sm"
              aria-label="Equipo"
              value={f.team}
              onChange={(e) => p.setFilterTeam(e.target.value)}
              className="w-full sm:w-auto"
            >
              <option value="todas">Todos los equipos</option>
              {Object.entries(p.teamNames).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </Select>
          )}
          {p.isManager && (
            <Select
              size="sm"
              aria-label="Responsable"
              value={f.member}
              onChange={(e) => p.setFilterMember(e.target.value)}
              className="w-full sm:w-auto"
            >
              <option value="todas">Cualquier responsable</option>
              {p.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                </option>
              ))}
            </Select>
          )}
          {/* Grupo de trabajo (alias "foco"): solo tiene sentido con UN equipo elegido, ya
              que el grupo es un catalogo por equipo (migracion 043). */}
          {puedeGrupo && (
            <Select
              size="sm"
              aria-label="Grupo de trabajo"
              value={f.grupo}
              onChange={(e) => p.setFilterGrupo(e.target.value)}
              className="w-full sm:w-auto"
            >
              <option value="todas">Cualquier grupo</option>
              {p.gruposDisponibles.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nombre}
                </option>
              ))}
            </Select>
          )}
          <Select
            size="sm"
            aria-label="Plazo"
            value={f.plazo}
            onChange={(e) => p.setFilterPlazo(e.target.value as FiltroPlazo)}
            className="w-full sm:w-auto"
          >
            {(Object.keys(ETIQUETA_PLAZO) as FiltroPlazo[]).map((k) => (
              <option key={k} value={k}>
                {ETIQUETA_PLAZO[k]}
              </option>
            ))}
          </Select>

          <FilterSpacer />

          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            <Select
              size="sm"
              aria-label="Tipo de fecha del rango"
              value={f.dateType}
              onChange={(e) => p.setDateType(e.target.value as TipoFecha)}
              className="w-full sm:w-auto"
            >
              <option value="entrega">Fecha de entrega</option>
              <option value="creadas">Fecha de creación</option>
              <option value="cerradas">Fecha de cierre</option>
            </Select>
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <DatePicker
                value={f.dateFrom || null}
                onChange={(v) => p.setDateFrom(v ?? '')}
                placeholder="Desde"
                className={FECHA_FILTRO}
              />
              <span className="text-xs text-fg-faint">a</span>
              <DatePicker
                value={f.dateTo || null}
                onChange={(v) => p.setDateTo(v ?? '')}
                placeholder="Hasta"
                className={FECHA_FILTRO}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
