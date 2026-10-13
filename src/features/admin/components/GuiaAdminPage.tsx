import { useMemo, useState } from 'react'
import { useAuth } from '@core/auth/hooks/useAuth'
import { PageHeader } from '@shared/components/ui/PageHeader'
import { Icon } from '@shared/components/ui/Icon'
import { EmptyState } from '@shared/components/ui/EmptyState'
import { cx } from '@shared/utils/cx'
import { Bloque, ItemIndice, Seccion, Titulo } from '@features/guia/components/piezas'
import { colorIcono, fondoIcono, normalizar, textoDe } from '@features/guia/utilidades'
import { FLUJO_ADMIN, ROLES_ADMIN, SECCIONES_ADMIN } from '../guia/contenido'

/**
 * Guia de administracion: misma logica que la Guia de Lumix (/guia) -indice, buscador y una
 * ficha por pagina de la consola-, con lo que hace falta para dejar una empresa funcionando.
 * Las secciones del Owner (Empresas) se ven solo con esa cuenta. El contenido vive en
 * ../guia/contenido.ts.
 */
export function GuiaAdminPage() {
  const { profile } = useAuth()
  const esOwner = profile?.es_owner === true
  const [busqueda, setBusqueda] = useState('')

  const visibles = useMemo(() => SECCIONES_ADMIN.filter((s) => !s.soloOwner || esOwner), [esOwner])
  const q = normalizar(busqueda.trim())
  const filtradas = q ? visibles.filter((s) => textoDe(s).includes(q)) : visibles

  const ir = (id: string) =>
    document.getElementById(`guia-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="flex flex-col">
      <PageHeader title="Guía de administración" meta="cómo armar y mantener tu empresa" />

      <div className="mx-auto grid w-full max-w-6xl gap-6 px-3 py-5 sm:px-5 lg:grid-cols-[13rem_minmax(0,1fr)]">
        {/* Indice: fijo al costado en computador; en el celular, fichas que se deslizan. */}
        <nav aria-label="Índice de la guía" className="lg:sticky lg:top-5 lg:self-start">
          <div className="relative mb-3">
            <Icon
              name="search"
              size={15}
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-faint"
            />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar en la guía…"
              aria-label="Buscar en la guía"
              className="h-9 w-full rounded-md border border-border-strong bg-field pr-2.5 pl-8 text-base text-fg placeholder:text-fg-faint focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none sm:text-sm"
            />
          </div>
          <ul className="-mx-3 flex gap-1 overflow-x-auto px-3 pb-1 lg:mx-0 lg:flex-col lg:gap-px lg:overflow-visible lg:px-0">
            {!q && (
              <>
                <ItemIndice icon="sparkles" label="Cómo funciona" onClick={() => ir('inicio')} />
                <ItemIndice icon="shield" label="Quién es quién" onClick={() => ir('roles')} />
              </>
            )}
            {filtradas.map((s) => (
              <ItemIndice
                key={s.id}
                icon={s.icon}
                color={s.color}
                label={s.titulo}
                onClick={() => ir(s.id)}
              />
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-5">
          {!q && (
            <>
              <ComoFunciona esOwner={esOwner} />
              <QuienEsQuien />
            </>
          )}

          {filtradas.length === 0 ? (
            <EmptyState
              icon="search"
              title="No encontré nada con eso"
              description="Prueba con otra palabra, por ejemplo «líder», «nivel» o «clave»."
            />
          ) : (
            filtradas.map((s) => <Seccion key={s.id} s={s} />)
          )}
        </div>
      </div>
    </div>
  )
}

function ComoFunciona({ esOwner }: { esOwner: boolean }) {
  return (
    <Bloque id="inicio">
      <Titulo icon="sparkles" color="accent">
        Cómo funciona la administración
      </Titulo>
      <p className="max-w-3xl text-sm text-fg-body">
        La consola sirve para dejar cada empresa armada: su jerarquía de unidades y su gente en el
        lugar correcto. Lo del día a día de cada equipo (grupos, permisos finos, aviso de
        sobrecarga) sigue en Equipos, dentro de Lumix.
      </p>
      <ol className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {FLUJO_ADMIN.map((f) => (
          <li key={f.titulo} className="rounded-lg border border-border bg-shell p-3">
            <span
              className={cx(
                'mb-2 inline-flex h-7 w-7 items-center justify-center rounded-md',
                fondoIcono(f.color),
              )}
            >
              <Icon name={f.icon} size={15} className={colorIcono(f.color)} />
            </span>
            <p className="text-sm font-semibold text-fg">{f.titulo}</p>
            <p className="mt-1 text-xs text-fg-muted">{f.texto}</p>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs text-fg-muted">
        {esOwner
          ? 'Eres Owner: ves también la sección Empresas y eliges arriba en qué empresa trabajar.'
          : 'Eres Admin de tu empresa: todo lo que hagas aquí aplica solo a ella.'}
      </p>
    </Bloque>
  )
}

function QuienEsQuien() {
  return (
    <Bloque id="roles">
      <Titulo icon="shield">Quién es quién</Titulo>
      <p className="mb-3 max-w-3xl text-sm text-fg-body">
        Hay dos roles de administración y tres dentro de cada unidad. El rol de unidad es{' '}
        <strong className="text-fg">por unidad</strong>: una jefatura es Líder de su equipo e
        Integrante del equipo de su jefe (el modelo «linking pin» de Likert).
      </p>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ROLES_ADMIN.map((r) => (
          <div key={r.rol} className="rounded-lg border border-border bg-shell p-3">
            <dt className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-fg">{r.rol}</span>
              <span className="text-xs text-fg-faint">{r.donde}</span>
            </dt>
            <dd className="mt-1 text-sm text-fg-muted">{r.texto}</dd>
          </div>
        ))}
      </dl>
    </Bloque>
  )
}
