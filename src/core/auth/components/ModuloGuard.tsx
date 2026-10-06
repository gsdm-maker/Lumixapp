import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useCapabilities } from '@core/auth/hooks/useCapabilities'
import type { Capability } from '@core/auth/capabilities'

// Los permisos "modulos.*" solo escondian el enlace del menu: escribiendo la direccion se
// entraba igual. Este guard aplica el mismo permiso a la ruta. Mientras el rol/permisos del
// equipo cargan, can() cae al default del rol, y todos los roles traen los modulos visibles:
// no hay redireccion falsa al recargar la pagina.
export function ModuloGuard({ cap, children }: { cap: Capability; children: ReactNode }) {
  const { can } = useCapabilities()
  if (!can(cap)) return <Navigate to="/chat" replace />
  return <>{children}</>
}
