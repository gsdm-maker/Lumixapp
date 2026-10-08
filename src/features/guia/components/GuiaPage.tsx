import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@shared/components/ui/PageHeader'
import { Icon, type IconName } from '@shared/components/ui/Icon'
import { EmptyState } from '@shared/components/ui/EmptyState'
import { useCapabilities } from '@core/auth/hooks/useCapabilities'
import { TAG, type TagColor } from '@shared/utils/colores'
import { cx } from '@shared/utils/cx'
import {
  ATAJOS,
  ESTADOS,
  FLUJO,
  ROLES,
  SECCIONES,
  type SeccionGuia,
} from '@features/guia/contenido'

const colorIcono = (c?: TagColor | 'accent') =>
  c === 'accent' ? 'text-accent' : c ? TAG[c].text : 'text-fg-muted'
const fondoIcono = (c?: TagColor | 'accent') =>
  c === 'accent' ? 'bg-accent-soft' : c ? TAG[c].soft : 'bg-surface'

/** Minusculas y sin tildes: "planificacion" encuentra "Planificación". */
const normalizar = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')

const textoDe = (s: SeccionGuia) =>
  normalizar(
    [
      s.titulo,
      s.resumen,
      ...s.acciones.flatMap((a) => [a.t, a.d]),
      ...(s.reglas ?? []),
      ...(s.permisos ?? []),
      ...(s.consejos ?? []),
    ].join(' '),
  )

/**
 * Guia de Lumix: como funciona de punta a punta y, hoja por hoja, para que sirve, que se puede
 * hacer, las reglas y quien puede. Muestra solo las hojas que la persona puede abrir, para que
 * la guia calce con su menu. El contenido vive en contenido.ts.
 */
export function GuiaPage() {
  const { can, isGlobalAdmin } = useCapabilities()
  const [busqueda, setBusqueda] = useState('')

  const visibles = useMemo(
    () =>
      SECCIONES.filter((s) => (s.soloAdmin ? isGlobalAdmin : !s.capability || can(s.capability))),
    [can, isGlobalAdmin],
  )
  const q = normalizar(busqueda.trim())
  const filtradas = q ? visibles.filter((s) => textoDe(s).includes(q)) : visibles

  const ir = (id: string) =>
    document.getElementById(`guia-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Guía de Lumix" meta="cómo funciona, hoja por hoja" />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-6xl gap-6 px-3 py-5 sm:px-5 lg:grid-cols-[13rem_minmax(0,1fr)]">
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
                <ItemIndice icon="sparkles" label="Cómo funciona" onClick={() => ir('inicio')} />
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
              {!q && (
                <>
                  <ItemIndice icon="shield" label="Roles" onClick={() => ir('roles')} />
                  <ItemIndice
                    icon="sliders"
                    label="Atajos y estados"
                    onClick={() => ir('atajos')}
                  />
                </>
              )}
            </ul>
          </nav>

          <div className="min-w-0 space-y-5">
            {!q && <ComoFunciona />}

            {filtradas.length === 0 ? (
              <EmptyState
                icon="search"
                title="No encontré nada con eso"
                description="Prueba con otra palabra, por ejemplo «fecha», «asignar» o «reunión»."
              />
            ) : (
              filtradas.map((s) => <Seccion key={s.id} s={s} />)
            )}

            {!q && (
              <>
                <Roles />
                <AtajosYEstados />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ItemIndice({
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
function Bloque({ id, children }: { id: string; children: ReactNode }) {
  return (
    <section id={`guia-${id}`} className="scroll-mt-5 lamina p-4 shadow-xs sm:p-5">
      {children}
    </section>
  )
}

function Titulo({
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

function ComoFunciona() {
  return (
    <Bloque id="inicio">
      <Titulo icon="sparkles" color="accent">
        Cómo funciona Lumix
      </Titulo>
      <p className="max-w-3xl text-sm text-fg-body">
        Lumix es el lugar donde el equipo registra, reparte y sigue su trabajo. La idea es simple:
        lo dices en el chat, queda como actividad, se compromete en la reunión y se mide.
      </p>
      <ol className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {FLUJO.map((f) => (
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
        Lo que ves depende de tu rol y permisos: esta guía muestra solo las hojas que puedes abrir.
      </p>
    </Bloque>
  )
}

function Lista({ titulo, items, icon }: { titulo: string; items?: string[]; icon: IconName }) {
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

function Seccion({ s }: { s: SeccionGuia }) {
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

function Roles() {
  return (
    <Bloque id="roles">
      <Titulo icon="shield">Roles y permisos</Titulo>
      <p className="mb-3 max-w-3xl text-sm text-fg-body">
        Cada persona tiene un rol en cada equipo (puede ser Jefatura en uno y Colaborador en otro).
        El rol trae permisos por defecto, y en Equipos → Permisos se pueden dar o quitar permisos
        puntuales a cada persona.
      </p>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ROLES.map((r) => (
          <div key={r.rol} className="rounded-lg border border-border bg-shell p-3">
            <dt className="text-sm font-semibold text-fg">{r.rol}</dt>
            <dd className="mt-0.5 text-sm text-fg-muted">{r.texto}</dd>
          </div>
        ))}
      </dl>
    </Bloque>
  )
}

const TONO_ESTADO: Record<TagColor | 'neutral', string> = {
  neutral: 'bg-surface text-fg-muted',
  ...(Object.fromEntries(
    (Object.keys(TAG) as TagColor[]).map((c) => [c, `${TAG[c].soft} ${TAG[c].text}`]),
  ) as Record<TagColor, string>),
}

function AtajosYEstados() {
  return (
    <Bloque id="atajos">
      <Titulo icon="sliders">Atajos de teclado y estados</Titulo>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-fg-muted uppercase">
            Atajos
          </h3>
          <ul className="divide-y divide-border">
            {ATAJOS.map((a) => (
              <li key={a.texto} className="flex items-center gap-3 py-2 text-sm">
                <span className="flex w-28 shrink-0 gap-1">
                  {a.teclas.map((k) => (
                    <kbd
                      key={k}
                      className="rounded border border-border bg-shell px-1.5 font-mono text-2xs text-fg-muted shadow-xs"
                    >
                      {k}
                    </kbd>
                  ))}
                </span>
                <span className="text-fg-body">{a.texto}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-fg-muted uppercase">
            Estados
          </h3>
          <ul className="divide-y divide-border">
            {ESTADOS.map((e) => (
              <li key={e.estado} className="flex items-center gap-3 py-2 text-sm">
                <span
                  className={cx(
                    'w-40 shrink-0 truncate rounded-full px-2 py-0.5 text-center text-xs font-medium',
                    TONO_ESTADO[e.tono],
                  )}
                >
                  {e.estado}
                </span>
                <span className="text-fg-body">{e.texto}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Bloque>
  )
}
