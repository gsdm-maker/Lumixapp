import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon, type IconName } from '@shared/components/ui/Icon'
import type { TagColor } from '@shared/utils/colores'
import { cx } from '@shared/utils/cx'
import type { SeccionGuia } from '@features/guia/contenido'
import { colorIcono, fondoIcono } from '@features/guia/utilidades'

// Piezas de las guias (la de Lumix en /guia y la de la consola en /admin/guia): mismo indice,
// mismo buscador y mismas fichas por tema, cada una con su contenido.

export function ItemIndice({
  icon,
  color,
  label,
  onClick,
}: {
  icon: IconName
  color?: TagColor | 'accent'
  label: string
  onClick: () => void
}) {
  return (
    <li className="shrink-0">
      <button
        type="button"
        onClick={onClick}
        className="flex h-8 w-full items-center gap-2 rounded-md border border-border bg-panel px-2.5 text-sm whitespace-nowrap text-fg-muted transition-colors hover:bg-surface hover:text-fg lg:border-0 lg:bg-transparent"
      >
        <Icon name={icon} size={15} className={colorIcono(color)} />
        {label}
      </button>
    </li>
  )
}

/** Bloque con ancla para el indice. */
export function Bloque({ id, children }: { id: string; children: ReactNode }) {
  return (
    <section id={`guia-${id}`} className="scroll-mt-5 lamina p-4 shadow-xs sm:p-5">
      {children}
    </section>
  )
}

export function Titulo({
  icon,
  color,
  children,
  accion,
}: {
  icon: IconName
  color?: TagColor | 'accent'
  children: ReactNode
  accion?: ReactNode
}) {
  return (
    <header className="mb-3 flex items-center gap-3">
      <span
        className={cx(
          'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          fondoIcono(color),
        )}
      >
        <Icon name={icon} size={18} className={colorIcono(color)} />
      </span>
      <h2 className="flex-1 text-xl font-semibold tracking-tight text-fg">{children}</h2>
      {accion}
    </header>
  )
}

export function Lista({
  titulo,
  items,
  icon,
}: {
  titulo: string
  items?: string[]
  icon: IconName
}) {
  if (!items?.length) return null
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-fg-muted uppercase">
        {titulo}
      </h3>
      <ul className="space-y-1.5">
        {items.map((r) => (
          <li key={r} className="flex gap-2 text-sm text-fg-body">
            <Icon name={icon} size={14} className="mt-[3px] text-fg-faint" />
            <span>{r}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Seccion({ s }: { s: SeccionGuia }) {
  return (
    <Bloque id={s.id}>
      <Titulo
        icon={s.icon}
        color={s.color}
        accion={
          s.ruta && (
            <Link
              to={s.ruta}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-fg-muted shadow-xs transition-colors hover:bg-surface hover:text-fg"
            >
              Abrir
              <Icon name="arrowRight" size={14} />
            </Link>
          )
        }
      >
        {s.titulo}
      </Titulo>
      <p className="max-w-3xl text-sm text-fg-body">{s.resumen}</p>

      <h3 className="mt-4 mb-2 text-xs font-semibold tracking-wide text-fg-muted uppercase">
        Qué puedes hacer
      </h3>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
        {s.acciones.map((a) => (
          <div key={a.t} className="min-w-0">
            <dt className="text-sm font-medium text-fg">{a.t}</dt>
            <dd className="text-sm text-fg-muted">{a.d}</dd>
          </div>
        ))}
      </dl>

      {(s.reglas || s.permisos) && (
        <div className="mt-5 grid grid-cols-1 gap-5 border-t border-border pt-4 md:grid-cols-2">
          <Lista titulo="Reglas importantes" items={s.reglas} icon="info" />
          <Lista titulo="Quién puede" items={s.permisos} icon="lock" />
        </div>
      )}

      {s.consejos && (
        <div className="mt-4 rounded-lg bg-accent-soft px-3.5 py-3">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-accent">
            <Icon name="sparkles" size={14} />
            Consejos
          </p>
          <ul className="space-y-1 text-sm text-fg-body">
            {s.consejos.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </Bloque>
  )
}
