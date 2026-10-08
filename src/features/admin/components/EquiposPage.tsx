import { useState } from 'react'
import { adminService, type EquipoAdmin } from '@infrastructure/supabase/admin.service'
import { PageHeader } from '@shared/components/ui/PageHeader'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import { EditableText } from '@shared/components/ui/EditableText'
import { EmptyState } from '@shared/components/ui/EmptyState'
import { SkeletonRows } from '@shared/components/ui/Skeleton'
import { useToast } from '@shared/components/ui/Toast'
import { useCargaAdmin } from '../hooks/useAdmin'

/**
 * Equipos de todo el sistema: crear y renombrar. Lo del dia a dia de cada equipo (grupos,
 * permisos finos, umbral) sigue en Equipos dentro de la app, donde lo maneja su jefatura.
 */
export function EquiposPage() {
  const equipos = useCargaAdmin<EquipoAdmin>(adminService.listarEquipos)
  const toast = useToast()
  const [nombre, setNombre] = useState('')
  const [creando, setCreando] = useState(false)

  const crear = async () => {
    const n = nombre.trim()
    if (n.length < 2) return
    setCreando(true)
    try {
      await adminService.crearEquipo(n)
      setNombre('')
      toast.success(`Equipo ${n} creado`)
      void equipos.recargar()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setCreando(false)
    }
  }

  const renombrar = async (e: EquipoAdmin, nuevo: string) => {
    const n = nuevo.trim()
    if (n === e.nombre || n.length < 2) return
    try {
      await adminService.renombrarEquipo(e.id, n)
      toast.success('Equipo renombrado')
      void equipos.recargar()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Equipos"
        meta={equipos.cargando ? undefined : `${equipos.datos.length} equipos`}
      />

      <div className="px-3 sm:px-5 py-3 max-w-3xl space-y-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void crear()
          }}
        >
          <div className="flex-1">
            <Input
              aria-label="Nombre del nuevo equipo"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del nuevo equipo"
              maxLength={60}
            />
          </div>
          <Button type="submit" icon="plus" loading={creando} disabled={nombre.trim().length < 2}>
            Crear equipo
          </Button>
        </form>

        {equipos.error ? (
          <EmptyState icon="alert" title="No se pudo cargar" description={equipos.error} />
        ) : equipos.cargando ? (
          <SkeletonRows rows={6} />
        ) : (
          <ul className="lamina divide-y divide-border">
            {equipos.datos.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <EditableText
                    value={e.nombre}
                    onSave={(v) => void renombrar(e, v)}
                    canEdit
                    preventEmpty
                    textClassName="text-sm font-medium text-fg"
                  />
                  <p className="text-xs text-fg-faint truncate">
                    {e.jefaturas.length
                      ? `Jefatura: ${e.jefaturas.join(', ')}`
                      : 'Sin jefatura asignada'}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-fg-muted tabular-nums">
                  {e.miembros} {e.miembros === 1 ? 'persona' : 'personas'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
