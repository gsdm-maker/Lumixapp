import { adminService, type RegistroAdmin } from '@infrastructure/supabase/admin.service'
import { PageHeader } from '@shared/components/ui/PageHeader'
import { EmptyState } from '@shared/components/ui/EmptyState'
import { SkeletonRows } from '@shared/components/ui/Skeleton'
import { Button } from '@shared/components/ui/Button'
import { useCargaAdmin } from '../hooks/useAdmin'
import { describirRegistro, fechaHora } from '../utils/formato'

/**
 * Registro de lo hecho en la consola (ultimas 200 acciones). Solo se lee: la tabla no se puede
 * modificar desde la app (ver migracion 050).
 */
export function ActividadPage() {
  const registro = useCargaAdmin<RegistroAdmin>(adminService.listarAuditoria)

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Actividad"
        meta="Últimas 200 acciones de administración"
        actions={
          <Button variant="ghost" icon="refresh" onClick={() => void registro.recargar()}>
            Actualizar
          </Button>
        }
      />
      <div className="px-3 sm:px-5 py-3 max-w-3xl">
        {registro.error ? (
          <EmptyState icon="alert" title="No se pudo cargar" description={registro.error} />
        ) : registro.cargando ? (
          <SkeletonRows rows={6} />
        ) : registro.datos.length === 0 ? (
          <EmptyState
            icon="historial"
            title="Sin acciones todavía"
            description="Lo que hagas en Personas y Equipos queda registrado aquí."
          />
        ) : (
          <ol className="lamina divide-y divide-border">
            {registro.datos.map((r) => (
              <li key={r.id} className="flex items-baseline gap-3 px-4 py-2.5">
                <time dateTime={r.fecha} className="shrink-0 w-28 text-xs text-fg-faint">
                  {fechaHora(r.fecha)}
                </time>
                <span className="flex-1 min-w-0 text-sm text-fg">{describirRegistro(r)}</span>
                <span className="hidden sm:block shrink-0 text-xs text-fg-faint">{r.actor}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
