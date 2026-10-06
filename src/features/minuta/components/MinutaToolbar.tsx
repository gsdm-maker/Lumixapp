import { Button, IconButton } from '@shared/components/ui/Button'
import { DatePicker } from '@shared/components/ui/DatePicker'
import { FilterBar, FilterChip, FilterSpacer, SearchInput } from '@shared/components/ui/FilterBar'
import { Select } from '@shared/components/ui/Input'
import { SegmentedControl, type SegmentOption } from '@shared/components/ui/SegmentedControl'
import { formatDateLocal } from '@shared/utils/date'
import type { useMinuta } from '@features/minuta/hooks/useMinuta'

type Estado = ReturnType<typeof useMinuta>
type Vista = Estado['view']

// Clase del boton-disparador del DatePicker para que mida y se vea como el resto de los
// controles de la barra (el DatePicker compartido trae un estilo propio mas chico).
const FECHA =
  'h-8 px-2.5 rounded-md border border-border-strong bg-field text-sm text-fg-body hover:border-fg-faint whitespace-nowrap'

/**
 * Barra de filtros de la hoja. Ingesta tiene su propio vocabulario de vistas (Activas /
 * Resueltas / Todas) y un rango de fechas elegido a mano; Minuta tiene "Por asignar /
 * Asignados / Resueltos / Todos" y el navegador de semana -"actividad esta semana" es un
 * concepto de Minuta (se conversa/avanza en la reunion), no de un registro de solicitudes-.
 */
export function MinutaToolbar({ esIngesta, h }: { esIngesta: boolean; h: Estado }) {
  const { counts, members } = h
  // El filtro de grupo de trabajo (alias "foco") se rige por el mismo permiso que gestionar la
  // hoja (canManage), no por un chequeo de rol aparte -si no, alguien con el permiso concedido
  // puntualmente no veia el filtro aunque si puede gestionar todo lo demas (bug real).
  const verGrupos = h.canManage && h.gruposDisponibles.length > 0

  const vistas: SegmentOption<Vista>[] = esIngesta
    ? [
        { value: 'pendientes', label: 'Activas', count: counts.pendientes },
        { value: 'resueltos', label: 'Resueltas', count: counts.resueltos },
        { value: 'todos', label: 'Todas', count: counts.todos },
      ]
    : [
        { value: 'pendientes', label: 'Por asignar', count: counts.pendientes },
        { value: 'asignados', label: 'Asignados', count: counts.asignados },
        { value: 'resueltos', label: 'Resueltos', count: counts.resueltos },
        { value: 'todos', label: 'Todos', count: counts.todos },
      ]

  const nombreMiembro = members.find((m) => m.id === h.filterMember)?.full_name ?? '—'
  const nombreGrupo = h.gruposDisponibles.find((g) => g.id === h.filterGrupo)?.nombre ?? '—'
  const hayRango = !!(h.dateFrom || h.dateTo)
  const hayFiltros =
    h.filterMember !== 'todas' ||
    h.filterGrupo !== 'todas' ||
    !!h.search ||
    (!esIngesta && h.weekMode) ||
    (esIngesta && hayRango)

  const limpiarTodo = () => {
    h.setFilterMember('todas')
    h.setFilterGrupo('todas')
    h.setSearch('')
    h.setWeekMode(false)
    h.setWeekOffset(0)
    h.setDateFrom('')
    h.setDateTo('')
  }

  return (
    <FilterBar>
      <div className="max-w-full overflow-x-auto">
        <SegmentedControl<Vista>
          label={esIngesta ? 'Estado de las solicitudes' : 'Estado de los temas'}
          options={vistas}
          value={h.view}
          onChange={h.setView}
        />
      </div>

      <Select
        size="sm"
        aria-label="Responsable"
        value={h.filterMember}
        onChange={(e) => h.setFilterMember(e.target.value)}
        className="w-auto max-w-[11rem]"
      >
        <option value="todas">Todo el equipo</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.full_name}
          </option>
        ))}
      </Select>

      {verGrupos && (
        <Select
          size="sm"
          aria-label="Grupo de trabajo"
          value={h.filterGrupo}
          onChange={(e) => h.setFilterGrupo(e.target.value)}
          className="w-auto max-w-[11rem]"
        >
          <option value="todas">Cualquier grupo</option>
          {h.gruposDisponibles.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nombre}
            </option>
          ))}
        </Select>
      )}

      {esIngesta ? (
        <div className="inline-flex items-center gap-1.5">
          <Select
            size="sm"
            aria-label="Qué fecha filtrar"
            value={h.dateType}
            onChange={(e) => h.setDateType(e.target.value as typeof h.dateType)}
            className="w-auto"
          >
            <option value="compromiso">Fecha de compromiso</option>
            <option value="solicitud">Fecha de solicitud</option>
          </Select>
          <DatePicker
            value={h.dateFrom || null}
            onChange={(v) => h.setDateFrom(v ?? '')}
            placeholder="Desde"
            className={FECHA}
          />
          <span className="text-xs text-fg-faint">a</span>
          <DatePicker
            value={h.dateTo || null}
            onChange={(v) => h.setDateTo(v ?? '')}
            placeholder="Hasta"
            className={FECHA}
          />
        </div>
      ) : h.weekMode ? (
        <div className="inline-flex items-center h-8 rounded-md border border-border-strong bg-panel">
          <IconButton
            icon="chevronLeft"
            size="xs"
            label="Semana anterior"
            onClick={() => h.setWeekOffset(h.weekOffset - 1)}
          />
          <span className="px-1 text-xs text-fg-body whitespace-nowrap tabular-nums">
            {h.weekOffset === 0 ? `Esta semana · ${h.weekLabel}` : h.weekLabel}
          </span>
          <IconButton
            icon="chevronRight"
            size="xs"
            label="Semana siguiente"
            onClick={() => h.setWeekOffset(h.weekOffset + 1)}
          />
        </div>
      ) : (
        <Button size="sm" variant="secondary" icon="calendar" onClick={() => h.setWeekMode(true)}>
          Por semana
        </Button>
      )}

      <FilterSpacer grow />
      <SearchInput
        value={h.search}
        onChange={h.setSearch}
        placeholder={esIngesta ? 'Buscar solicitud…' : 'Buscar tema…'}
      />

      {/* Filtros activos como fichas que se quitan con x: se ve de un vistazo por que la
          lista muestra menos de lo esperado. */}
      {hayFiltros && (
        <div className="w-full flex flex-wrap items-center gap-1.5">
          {h.filterMember !== 'todas' && (
            <FilterChip
              label="Responsable"
              value={nombreMiembro}
              onRemove={() => h.setFilterMember('todas')}
            />
          )}
          {h.filterGrupo !== 'todas' && (
            <FilterChip
              label="Grupo"
              value={nombreGrupo}
              onRemove={() => h.setFilterGrupo('todas')}
            />
          )}
          {!esIngesta && h.weekMode && (
            <FilterChip
              label="Semana"
              value={h.weekLabel}
              onRemove={() => {
                h.setWeekMode(false)
                h.setWeekOffset(0)
              }}
            />
          )}
          {esIngesta && hayRango && (
            <FilterChip
              label={h.dateType === 'solicitud' ? 'Solicitud' : 'Compromiso'}
              value={`${h.dateFrom ? formatDateLocal(h.dateFrom, 'short') : '…'} – ${
                h.dateTo ? formatDateLocal(h.dateTo, 'short') : '…'
              }${h.dateFrom && h.dateTo ? '' : ' (falta una fecha)'}`}
              onRemove={() => {
                h.setDateFrom('')
                h.setDateTo('')
              }}
            />
          )}
          {h.search && (
            <FilterChip label="Texto" value={h.search} onRemove={() => h.setSearch('')} />
          )}
          <Button size="xs" variant="ghost" onClick={limpiarTodo}>
            Limpiar filtros
          </Button>
        </div>
      )}
    </FilterBar>
  )
}
