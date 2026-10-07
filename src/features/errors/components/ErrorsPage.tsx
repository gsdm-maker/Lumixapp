import { Badge } from '@shared/components/ui/Badge'
import { Button } from '@shared/components/ui/Button'
import { EditableText } from '@shared/components/ui/EditableText'
import { PageHeader } from '@shared/components/ui/PageHeader'
import { FilterBar, FilterSpacer, SearchInput } from '@shared/components/ui/FilterBar'
import { SegmentedControl } from '@shared/components/ui/SegmentedControl'
import { Select } from '@shared/components/ui/Input'
import { EmptyState } from '@shared/components/ui/EmptyState'
import { SkeletonRows } from '@shared/components/ui/Skeleton'
import { useErrors } from '@features/errors/hooks/useErrors'
import {
  ErrorSeveritySelect,
  ErrorStatusSelect,
} from '@features/errors/components/ErrorStatusSelect'
import { useCapabilities } from '@core/auth/hooks/useCapabilities'
import { exportToCSV } from '@shared/utils/export'
import { formatDateLocal, parseDateLocal } from '@shared/utils/date'
import { ERROR_SEVERITY, ERROR_STATUS } from '@shared/utils/estados'
import { cx } from '@shared/utils/cx'
import type { AppError, ErrorSeverity, ErrorStatus } from '@shared/types'

type Filtro = ErrorStatus | 'todas' | 'activos'

const statusFilters: { value: Filtro; label: string }[] = [
  { value: 'todas', label: 'Todos' },
  { value: 'activos', label: 'Activos' },
  { value: 'abierto', label: 'Abiertos' },
  { value: 'en_revision', label: 'En proceso' },
  { value: 'resuelto', label: 'Resueltos' },
  { value: 'cerrado', label: 'Cerrados' },
]

// Severidad como franja delgada a la izquierda de la fila (idea 22): se ve de un vistazo en
// la lista sin agregar otra columna de color. Baja no lleva franja: es el caso normal.
const SEVERITY_STRIPE: Record<ErrorSeverity, string> = {
  critica: 'bg-danger',
  alta: 'bg-danger',
  media: 'bg-warning',
  baja: '',
}

const DIA = 86400000

/**
 * Cuanto lleva abierto. Mientras siga activo cuenta hasta hoy ("hace 12 d"); ya resuelto o
 * cerrado, muestra cuanto duro abierto. Es la traza que mas se pregunta en la reunion.
 */
function antiguedad(e: AppError): { text: string; className: string } {
  const inicio = parseDateLocal(e.date).getTime()
  if (e.status === 'resuelto' || e.status === 'cerrado') {
    const fin = e.closed_at ?? e.resolved_at
    if (!fin) return { text: '—', className: 'text-fg-faint' }
    const d = Math.max(0, Math.round((parseDateLocal(fin).getTime() - inicio) / DIA))
    return { text: `${d} d abierto`, className: 'text-fg-faint' }
  }
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const d = Math.max(0, Math.round((hoy.getTime() - inicio) / DIA))
  return {
    text: d === 0 ? 'hoy' : `hace ${d} d`,
    className: d >= 14 ? 'text-warning font-medium' : 'text-fg-muted',
  }
}

// Columnas exactas pedidas por Sebastian (Transaccion o query / Comentario / Quien lo levanto
// / Fecha de creacion / Estado / Fecha de cierre), todo en pantalla y sin modal, mismo
// espiritu que Ingesta. Se suman solo la severidad como franja y "Abierto hace" (idea 22).
// "Responsable" por area sigue en la base, sin usarse aca.
export function ErrorsPage() {
  const {
    errors,
    members,
    loading,
    filterStatus,
    setFilterStatus,
    dateType,
    setDateType,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    search,
    setSearch,
    changeStatus,
    changeSeverity,
    createError,
    updateField,
    counts,
    isInvitado,
  } = useErrors()
  const { canManageErrors } = useCapabilities()

  const memberName = (id: string) => members.find((m) => m.id === id)?.full_name || 'Desconocido'
  // La bitacora esta vacia de verdad (y no solo por los filtros): cambia el mensaje del vacio.
  // El rango de fechas solo filtra cuando estan las dos puntas (ver useErrors).
  const bitacoraVacia = counts.todas === 0 && !search.trim() && !(dateFrom && dateTo)

  const exportar = () =>
    exportToCSV(
      errors.map((e) => ({
        'Transacción o query': e.title,
        Comentario: e.description,
        Severidad: ERROR_SEVERITY[e.severity]?.label ?? e.severity,
        'Quién lo levantó': memberName(e.created_by),
        'Fecha de creación': e.date,
        Estado: ERROR_STATUS[e.status].label,
        'Fecha de cierre': e.closed_at ? formatDateLocal(e.closed_at) : '-',
      })),
      'errores',
    )

  return (
    <div className="flex flex-col h-full bg-shell">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            Bitácora de errores
            {isInvitado && <Badge variant="info">Invitado</Badge>}
          </span>
        }
        meta={`${counts.todas} en total`}
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              icon="download"
              onClick={exportar}
              disabled={errors.length === 0}
              title="Exportar (archivo CSV que abre en Excel)"
            >
              <span className="hidden sm:inline">Exportar</span>
            </Button>
            {canManageErrors && (
              <Button size="sm" icon="plus" onClick={() => createError('')}>
                Nuevo error
              </Button>
            )}
          </>
        }
      />

      <FilterBar>
        <div className="max-w-full overflow-x-auto">
          <SegmentedControl
            label="Filtrar por estado"
            value={filterStatus}
            onChange={setFilterStatus}
            options={statusFilters.map((f) => ({ ...f, count: counts[f.value] }))}
          />
        </div>
        <FilterSpacer />
        <div className="flex flex-wrap items-center gap-1.5">
          <Select
            size="sm"
            aria-label="Tipo de fecha"
            value={dateType}
            onChange={(e) => setDateType(e.target.value as typeof dateType)}
            className="w-32"
          >
            <option value="reportadas">Reportadas</option>
            <option value="cerradas">Cerradas</option>
          </Select>
          <DateInput label="Desde" value={dateFrom} onChange={setDateFrom} />
          <DateInput label="Hasta" value={dateTo} onChange={setDateTo} />
          {(dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                setDateFrom('')
                setDateTo('')
              }}
            >
              Limpiar
            </Button>
          )}
        </div>
        <FilterSpacer grow />
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar error…" />
      </FilterBar>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-4">
            <SkeletonRows />
          </div>
        ) : errors.length === 0 ? (
          <EmptyState
            icon="bug"
            title={bitacoraVacia ? 'No hay errores registrados' : 'Ningún error coincide'}
            description={
              bitacoraVacia
                ? canManageErrors
                  ? 'Registra el primero con “Nuevo error” o escribiéndolo en el chat.'
                  : undefined
                : 'Prueba con otro estado, otras fechas u otra búsqueda.'
            }
          />
        ) : (
          <>
            {/* Escritorio: tabla */}
            <table className="hidden sm:table w-full text-sm">
              <thead className="sticky top-0 z-10 bg-panel">
                <tr className="border-b border-border text-xs text-fg-faint text-left">
                  <th className="py-2 pl-5 pr-3 font-medium min-w-[180px]">Transacción o query</th>
                  <th className="py-2 px-3 font-medium min-w-[200px]">Comentario</th>
                  <th className="py-2 px-3 font-medium hidden lg:table-cell">Severidad</th>
                  <th className="py-2 px-3 font-medium hidden md:table-cell">Quién lo levantó</th>
                  <th className="py-2 px-3 font-medium whitespace-nowrap">Creado</th>
                  <th className="py-2 px-3 font-medium whitespace-nowrap">Abierto hace</th>
                  <th className="py-2 px-3 font-medium">Estado</th>
                  <th className="py-2 pl-3 pr-5 font-medium whitespace-nowrap">Cierre</th>
                </tr>
              </thead>
              <tbody className="bg-panel">
                {errors.map((error) => {
                  const edad = antiguedad(error)
                  return (
                    <tr
                      key={error.id}
                      className="border-b border-border hover:bg-surface transition-colors align-top"
                    >
                      <td className="relative py-2.5 pl-5 pr-3">
                        <SeverityStripe severity={error.severity} />
                        <EditableText
                          value={error.title}
                          canEdit={canManageErrors}
                          onSave={(next) => updateField(error.id, { title: next })}
                          textClassName="text-sm font-medium text-fg"
                          preventEmpty
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <EditableText
                          value={error.description}
                          canEdit={canManageErrors}
                          onSave={(next) => updateField(error.id, { description: next })}
                          placeholder="Descripción del error…"
                          emptyLabel="Sin comentario"
                          textClassName="text-sm text-fg-muted"
                        />
                      </td>
                      <td className="py-2 px-3 hidden lg:table-cell text-xs">
                        <ErrorSeveritySelect
                          value={error.severity}
                          canEdit={canManageErrors}
                          errorTitle={error.title}
                          onChange={(v) => changeSeverity(error.id, v)}
                        />
                      </td>
                      <td className="py-2.5 px-3 hidden md:table-cell text-fg-muted whitespace-nowrap">
                        {memberName(error.created_by)}
                      </td>
                      <td className="py-2.5 px-3 text-fg-muted whitespace-nowrap tabular-nums">
                        {formatDateLocal(error.date, 'short')}
                      </td>
                      <td
                        className={cx('py-2.5 px-3 whitespace-nowrap tabular-nums', edad.className)}
                      >
                        {edad.text}
                      </td>
                      <td className="py-2 px-3">
                        <ErrorStatusSelect
                          value={error.status}
                          canEdit={canManageErrors}
                          errorTitle={error.title}
                          onChange={(s) => changeStatus(error.id, s)}
                        />
                      </td>
                      <td className="py-2.5 pl-3 pr-5 text-fg-muted whitespace-nowrap tabular-nums">
                        {error.closed_at ? formatDateLocal(error.closed_at, 'short') : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Celular: lista de dos lineas (titulo y, debajo, estado + antiguedad + quien) */}
            <ul className="sm:hidden bg-panel divide-y divide-border border-b border-border">
              {errors.map((error) => {
                const edad = antiguedad(error)
                return (
                  <li key={error.id} className="relative pl-4 pr-3 py-2.5 space-y-1">
                    <SeverityStripe severity={error.severity} />
                    <EditableText
                      value={error.title}
                      canEdit={canManageErrors}
                      onSave={(next) => updateField(error.id, { title: next })}
                      textClassName="text-sm font-medium text-fg"
                      preventEmpty
                    />
                    {(error.description || canManageErrors) && (
                      <EditableText
                        value={error.description}
                        canEdit={canManageErrors}
                        onSave={(next) => updateField(error.id, { description: next })}
                        placeholder="Descripción del error…"
                        emptyLabel="Sin comentario"
                        textClassName="text-sm text-fg-muted"
                      />
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <ErrorStatusSelect
                        value={error.status}
                        canEdit={canManageErrors}
                        errorTitle={error.title}
                        onChange={(s) => changeStatus(error.id, s)}
                      />
                      <ErrorSeveritySelect
                        value={error.severity}
                        canEdit={canManageErrors}
                        errorTitle={error.title}
                        onChange={(v) => changeSeverity(error.id, v)}
                      />
                      <span className={edad.className}>{edad.text}</span>
                      <span className="text-fg-faint truncate">{memberName(error.created_by)}</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}

function SeverityStripe({ severity }: { severity: ErrorSeverity }) {
  const color = SEVERITY_STRIPE[severity]
  const label = ERROR_SEVERITY[severity]?.label ?? severity
  return (
    <>
      {color && (
        <span
          aria-hidden="true"
          title={`Severidad ${label}`}
          className={cx('absolute left-0 top-0 bottom-0 w-[3px]', color)}
        />
      )}
      <span className="sr-only">Severidad {label}.</span>
    </>
  )
}

/** Fecha de filtro: input nativo compacto, a la altura de la barra de filtros. */
function DateInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <input
      type="date"
      aria-label={label}
      title={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 w-[132px] rounded-md border border-border-strong bg-field px-2 text-base sm:text-sm text-fg-body focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
    />
  )
}
