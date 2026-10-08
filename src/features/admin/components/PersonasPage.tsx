import { useMemo, useState } from 'react'
import { ROLE_LABEL } from '@core/auth/roles'
import {
  adminService,
  type EquipoAdmin,
  type PersonaAdmin,
} from '@infrastructure/supabase/admin.service'
import { PageHeader } from '@shared/components/ui/PageHeader'
import { Button } from '@shared/components/ui/Button'
import { Avatar } from '@shared/components/ui/Avatar'
import { Badge } from '@shared/components/ui/Badge'
import { EmptyState } from '@shared/components/ui/EmptyState'
import { SkeletonRows } from '@shared/components/ui/Skeleton'
import { SearchInput } from '@shared/components/ui/FilterBar'
import { SegmentedControl } from '@shared/components/ui/SegmentedControl'
import { cx } from '@shared/utils/cx'
import { useCargaAdmin } from '../hooks/useAdmin'
import { haceCuanto } from '../utils/formato'
import { PersonaPanel } from './PersonaPanel'
import { CrearPersona } from './CrearPersona'

type Filtro = 'todas' | 'activas' | 'desactivadas' | 'sin-equipo'

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function filtrar(personas: PersonaAdmin[], f: Filtro) {
  return personas.filter((p) =>
    f === 'activas'
      ? p.activa
      : f === 'desactivadas'
        ? !p.activa
        : f === 'sin-equipo'
          ? p.equipos.length === 0 && !p.esAdmin
          : true,
  )
}

export function PersonasPage() {
  const personas = useCargaAdmin<PersonaAdmin>(adminService.listarPersonas)
  const equipos = useCargaAdmin<EquipoAdmin>(adminService.listarEquipos)
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('activas')
  const [elegidaId, setElegidaId] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)

  const cuenta = (f: Filtro) => filtrar(personas.datos, f)

  const visibles = useMemo(() => {
    const q = normalizar(busqueda.trim())
    return filtrar(personas.datos, filtro)
      .filter((p) => !q || normalizar(`${p.nombre} ${p.email}`).includes(q))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [personas.datos, busqueda, filtro])

  const elegida = personas.datos.find((p) => p.id === elegidaId) ?? null
  const recargar = () => {
    void personas.recargar()
    void equipos.recargar()
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Personas"
        meta={personas.cargando ? undefined : `${personas.datos.length} cuentas`}
        actions={
          <Button icon="plus" onClick={() => setCreando(true)}>
            Nueva persona
          </Button>
        }
      />

      <div className="px-3 sm:px-5 py-3 flex flex-wrap items-center gap-2">
        <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar nombre o email" />
        <SegmentedControl
          label="Mostrar"
          value={filtro}
          onChange={setFiltro}
          options={[
            { value: 'activas', label: 'Activas', count: cuenta('activas').length },
            { value: 'desactivadas', label: 'Desactivadas', count: cuenta('desactivadas').length },
            { value: 'sin-equipo', label: 'Sin equipo', count: cuenta('sin-equipo').length },
            { value: 'todas', label: 'Todas' },
          ]}
        />
      </div>

      <div className="px-3 sm:px-5 pb-8">
        {personas.error ? (
          <EmptyState
            icon="alert"
            title="No se pudo cargar la lista"
            description={personas.error}
            action={
              <Button variant="secondary" icon="refresh" onClick={() => void personas.recargar()}>
                Reintentar
              </Button>
            }
          />
        ) : personas.cargando ? (
          <SkeletonRows rows={8} />
        ) : visibles.length === 0 ? (
          <EmptyState icon="users" title="Nadie con ese filtro" />
        ) : (
          <ul className="lamina divide-y divide-border overflow-hidden">
            {visibles.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setElegidaId(p.id)}
                  aria-current={elegidaId === p.id || undefined}
                  className={cx(
                    'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface',
                    elegidaId === p.id && 'bg-surface',
                    !p.activa && 'opacity-70',
                  )}
                >
                  <Avatar name={p.nombre} size="sm" />
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-medium text-fg truncate">{p.nombre}</span>
                      {p.esAdmin && <Badge variant="info">Admin</Badge>}
                      {!p.activa && <Badge variant="blocked">Desactivada</Badge>}
                      {p.activa && p.debeCambiarClave && (
                        <Badge variant="warning">Clave temporal</Badge>
                      )}
                    </span>
                    <span className="block text-xs text-fg-faint truncate">{p.email}</span>
                  </span>
                  <span className="hidden md:block w-56 text-xs text-fg-muted truncate">
                    {p.esAdmin
                      ? 'Todos los equipos'
                      : p.equipos.length === 0
                        ? 'Sin equipo'
                        : p.equipos
                            .map((e) => `${e.nombre} (${ROLE_LABEL[e.rol] ?? e.rol})`)
                            .join(', ')}
                  </span>
                  <span className="hidden sm:block w-32 text-right text-xs text-fg-faint">
                    {haceCuanto(p.ultimoIngreso)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <PersonaPanel
        key={elegida?.id}
        persona={elegida}
        equipos={equipos.datos}
        onClose={() => setElegidaId(null)}
        onCambio={recargar}
      />
      <CrearPersona
        open={creando}
        equipos={equipos.datos}
        onClose={() => setCreando(false)}
        onCreada={recargar}
      />
    </div>
  )
}
