import { useMemo, useState } from 'react'
import {
  adminService,
  type EmpresaInfo,
  type EquipoAdmin,
  type PersonaAdmin,
  type RolEquipo,
} from '@infrastructure/supabase/admin.service'
import { PageHeader } from '@shared/components/ui/PageHeader'
import { Button } from '@shared/components/ui/Button'
import { Input, Select } from '@shared/components/ui/Input'
import { EditableText } from '@shared/components/ui/EditableText'
import { NivelesEmpresa } from './NivelesEmpresa'
import { SelectorModulos } from './SelectorModulos'
import { useAuth } from '@core/auth/hooks/useAuth'
import { EmptyState } from '@shared/components/ui/EmptyState'
import { SkeletonRows } from '@shared/components/ui/Skeleton'
import { useToast } from '@shared/components/ui/Toast'
import { useConfirm } from '@shared/components/ui/ConfirmDialog'
import { cx } from '@shared/utils/cx'
import { useCargaAdmin } from '../hooks/useAdmin'
import { OPCIONES_ROL } from '../utils/formato'
import { enArbol, etiquetaOpcion, rama, ruta } from '../utils/arbol'
import { CrearPersona } from './CrearPersona'

const GRUPOS: { rol: string; titulo: string; vacio: string }[] = [
  { rol: 'lider', titulo: 'Líder', vacio: 'Sin líder' },
  { rol: 'integrante', titulo: 'Integrantes', vacio: 'Sin integrantes' },
  { rol: 'invitado', titulo: 'Invitados', vacio: 'Sin invitados' },
]

/**
 * Estructura de la empresa en un solo lugar: el arbol de unidades a la izquierda y, a la
 * derecha, la unidad elegida con su gente. Desde aca se crean unidades (de primer nivel o
 * debajo de otra), se mueven, y se suma gente (existente o nueva) con su rol.
 *
 * El rol es POR UNIDAD: una jefatura es Lider de la suya e Integrante de la de su jefe
 * ("linking pin" de Likert). Hay un solo Lider por unidad: nombrar otro pasa al anterior a
 * Integrante. Al nombrar Lider se ofrece sumarlo tambien a la unidad de arriba (marcado por
 * defecto, se puede desmarcar).
 */
export function EstructuraPage() {
  const equipos = useCargaAdmin<EquipoAdmin>(adminService.listarEquipos)
  const personas = useCargaAdmin<PersonaAdmin>(adminService.listarPersonas)
  const empresas = useCargaAdmin<EmpresaInfo>(adminService.verEmpresa)
  const empresa = empresas.datos[0] ?? null
  const niveles = empresa?.niveles ?? []
  const toast = useToast()
  const confirm = useConfirm()

  const [elegida, setElegida] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [nuevaRaiz, setNuevaRaiz] = useState('')
  const [nuevaHija, setNuevaHija] = useState('')
  // null = usar el nivel sugerido (el siguiente al de la unidad de arriba).
  const [nivelHija, setNivelHija] = useState<string | null>(null)
  const [agregarId, setAgregarId] = useState('')
  const [agregarRol, setAgregarRol] = useState<RolEquipo>('integrante')
  const [sumarArriba, setSumarArriba] = useState(true)
  const [crearAbierto, setCrearAbierto] = useState(false)

  const filas = useMemo(() => enArbol(equipos.datos), [equipos.datos])
  const unidad = equipos.datos.find((e) => e.id === elegida) ?? filas[0] ?? null
  const superior = unidad ? equipos.datos.find((e) => e.id === unidad.superior) : undefined
  const fuera = useMemo(
    () => (unidad ? rama(unidad.id, equipos.datos) : new Set<string>()),
    [unidad, equipos.datos],
  )
  // Gente de la empresa que aun no esta en la unidad (los Admin no se suman desde aca).
  const disponibles = useMemo(
    () =>
      personas.datos
        .filter((p) => !p.esAdmin && !unidad?.personas.some((x) => x.id === p.id))
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [personas.datos, unidad],
  )

  // Nivel que se propone al crear una unidad debajo de esta: el siguiente de la lista. Si
  // esta no tiene nivel o ya es el ultimo, ninguno (se elige a mano).
  const sugerido = (() => {
    if (!unidad) return niveles[0] ?? ''
    const i = unidad.nivel ? niveles.indexOf(unidad.nivel) : -1
    return i >= 0 && i + 1 < niveles.length ? niveles[i + 1] : ''
  })()
  const nivelNueva = nivelHija ?? sugerido
  // Opciones de nivel para una unidad: los de la empresa, y el actual si ya no esta en la lista.
  const opcionesNivel = (actual: string | null) =>
    actual && !niveles.includes(actual) ? [...niveles, actual] : niveles

  const auth = useAuth()

  /** Guarda modulos (de la empresa o de una unidad) y refresca la app: el menu cambia al tiro. */
  const guardarModulos = async (accion: () => Promise<unknown>, ok: string) => {
    setOcupado('modulos')
    try {
      await accion()
      toast.success(ok)
      void empresas.recargar()
      void equipos.recargar()
      void auth.recargar()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setOcupado(null)
    }
  }

  const recargar = () => {
    void equipos.recargar()
    void personas.recargar()
  }

  const elegir = (id: string) => {
    setElegida(id)
    setNivelHija(null)
  }

  /** Corre una accion de la consola con su aviso y recarga todo al terminar. */
  const hacer = async (clave: string, accion: () => Promise<unknown>, ok: string) => {
    setOcupado(clave)
    try {
      await accion()
      toast.success(ok)
      recargar()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setOcupado(null)
    }
  }

  /** Mensaje cuando alguien quedo como Lider (y quiza tambien Integrante arriba). */
  const avisoLider = (nombre: string, u: EquipoAdmin, arriba: string | null) =>
    arriba
      ? `${nombre} es Líder de ${u.nombre} e Integrante de ${arriba}`
      : `${nombre} es Líder de ${u.nombre}`

  const crearUnidad = async (nombre: string, superiorId: string | null, nivel: string) => {
    const n = nombre.trim()
    if (n.length < 2) return
    setOcupado('crear-unidad')
    try {
      const r = await adminService.crearEquipo(n, superiorId, nivel.trim() || null)
      toast.success(`Unidad ${n} creada`)
      setNuevaRaiz('')
      setNuevaHija('')
      setNivelHija(null)
      setElegida(r.id)
      recargar()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setOcupado(null)
    }
  }

  const cambiarRol = async (u: EquipoAdmin, p: { id: string; nombre: string }, rol: RolEquipo) => {
    setOcupado(`rol-${p.id}`)
    try {
      const r = await adminService.cambiarRol(p.id, u.id, rol, rol === 'lider' && sumarArriba)
      toast.success(
        rol === 'lider' ? avisoLider(p.nombre, u, r.arriba) : `Rol de ${p.nombre} actualizado`,
      )
      recargar()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setOcupado(null)
    }
  }

  const agregar = async (u: EquipoAdmin) => {
    const p = disponibles.find((x) => x.id === agregarId)
    if (!p) return
    setOcupado('agregar')
    try {
      const r = await adminService.sumarAEquipo(
        p.id,
        u.id,
        agregarRol,
        agregarRol === 'lider' && sumarArriba,
      )
      toast.success(
        agregarRol === 'lider'
          ? avisoLider(p.nombre, u, r.arriba)
          : `${p.nombre} agregado a ${u.nombre}`,
      )
      setAgregarId('')
      recargar()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setOcupado(null)
    }
  }

  const borrar = async (u: EquipoAdmin) => {
    const hijas = equipos.datos.filter((e) => e.superior === u.id).length
    const ok = await confirm({
      title: `Borrar ${u.nombre}`,
      message: [
        u.miembros
          ? `Sus ${u.miembros} personas salen de la unidad (no se borran sus cuentas).`
          : '',
        hijas
          ? `Sus ${hijas} subunidades pasan a depender de ${superior?.nombre ?? 'nadie (primer nivel)'}.`
          : '',
        'Solo se puede borrar si no tiene actividades, errores, minutas, reuniones ni chat.',
      ]
        .filter(Boolean)
        .join(' '),
      confirmLabel: 'Borrar unidad',
      tone: 'danger',
    })
    if (!ok) return
    setOcupado('borrar')
    try {
      await adminService.borrarEquipo(u.id)
      toast.success(`Unidad ${u.nombre} borrada`)
      setElegida(u.superior)
      recargar()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setOcupado(null)
    }
  }

  const cargando = equipos.cargando || personas.cargando || empresas.cargando
  const error = equipos.error || personas.error || empresas.error

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Estructura"
        meta={
          cargando
            ? undefined
            : `${equipos.datos.length} unidades · ${personas.datos.length} personas`
        }
      />

      {error ? (
        <div className="px-3 sm:px-5 py-3">
          <EmptyState icon="alert" title="No se pudo cargar" description={error} />
        </div>
      ) : cargando ? (
        <div className="px-3 sm:px-5 py-3 max-w-5xl">
          <SkeletonRows rows={6} />
        </div>
      ) : (
        <div className="px-3 sm:px-5 py-3 max-w-5xl grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] items-start">
          {empresa && (
            <div className="lg:col-span-2">
              <NivelesEmpresa
                key={empresa.niveles.join('|')}
                empresa={empresa}
                onGuardado={() => void empresas.recargar()}
              />
              <div className="lamina mt-3 flex flex-col gap-2 px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
                    Módulos de {empresa.nombre}
                  </span>
                  <span className="text-xs text-fg-faint">
                    Cada unidad puede tener los suyos (en la unidad, abajo).
                  </span>
                </div>
                <SelectorModulos
                  value={empresa.modulos}
                  disabled={ocupado !== null}
                  onChange={(m) =>
                    void guardarModulos(
                      () => adminService.editarEmpresa(empresa.id, { modulos: m }),
                      'Módulos de la empresa actualizados',
                    )
                  }
                />
              </div>
            </div>
          )}
          {/* Arbol */}
          <div className="space-y-2">
            <ul className="lamina py-1" aria-label="Unidades">
              {filas.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => elegir(f.id)}
                    aria-current={unidad?.id === f.id ? 'true' : undefined}
                    className={cx(
                      'w-full flex items-baseline gap-2 py-1.5 pr-3 text-left text-sm rounded-lg',
                      unidad?.id === f.id
                        ? 'bg-accent-soft text-accent font-medium'
                        : 'text-fg hover:bg-surface',
                    )}
                    style={{ paddingLeft: `${0.75 + f.nivelArbol * 1}rem` }}
                  >
                    <span className="flex-1 min-w-0 truncate">{f.nombre}</span>
                    {f.nivel && <span className="shrink-0 text-xs text-fg-faint">{f.nivel}</span>}
                    <span className="shrink-0 text-xs text-fg-muted tabular-nums">
                      {f.miembros}
                    </span>
                  </button>
                </li>
              ))}
              {filas.length === 0 && (
                <li className="px-3 py-2 text-sm text-fg-faint">Aún no hay unidades.</li>
              )}
            </ul>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                void crearUnidad(nuevaRaiz, null, niveles[0] ?? '')
              }}
            >
              <div className="flex-1">
                <Input
                  aria-label="Nueva unidad de primer nivel"
                  value={nuevaRaiz}
                  onChange={(e) => setNuevaRaiz(e.target.value)}
                  placeholder={
                    niveles[0]
                      ? `Nueva ${niveles[0]} (primer nivel)`
                      : 'Nueva unidad de primer nivel'
                  }
                  maxLength={60}
                />
              </div>
              <Button
                type="submit"
                icon="plus"
                aria-label="Crear unidad de primer nivel"
                loading={ocupado === 'crear-unidad' && nuevaRaiz.trim().length >= 2}
                disabled={nuevaRaiz.trim().length < 2}
              />
            </form>
          </div>

          {/* Unidad elegida */}
          {!unidad ? (
            <EmptyState
              icon="layers"
              title="Crea la primera unidad"
              description="Por ejemplo la gerencia o el equipo principal. Después puedes colgar otras debajo."
            />
          ) : (
            <section className="lamina p-4 space-y-5" aria-label={`Unidad ${unidad.nombre}`}>
              <header className="space-y-2">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <EditableText
                    value={unidad.nombre}
                    onSave={(v) => {
                      const n = v.trim()
                      if (n !== unidad.nombre && n.length >= 2)
                        void hacer(
                          'nombre',
                          () => adminService.renombrarEquipo(unidad.id, n),
                          'Unidad renombrada',
                        )
                    }}
                    canEdit
                    preventEmpty
                    textClassName="text-base font-semibold text-fg"
                  />
                  <Select
                    size="sm"
                    aria-label={`Nivel de ${unidad.nombre}`}
                    value={unidad.nivel ?? ''}
                    disabled={ocupado !== null}
                    onChange={(ev) =>
                      void hacer(
                        'nivel',
                        () => adminService.cambiarNivel(unidad.id, ev.target.value || null),
                        'Nivel actualizado',
                      )
                    }
                    className="w-40"
                  >
                    <option value="">Sin nivel</option>
                    {opcionesNivel(unidad.nivel).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </Select>
                </div>
                <p className="text-xs text-fg-faint">{ruta(unidad.id, equipos.datos)}</p>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-fg-muted">Depende de</span>
                  <Select
                    size="sm"
                    aria-label={`Unidad de la que depende ${unidad.nombre}`}
                    value={unidad.superior ?? ''}
                    disabled={ocupado !== null}
                    onChange={(ev) => {
                      const destino = ev.target.value
                      const nombre = equipos.datos.find((x) => x.id === destino)?.nombre
                      void hacer(
                        'mover',
                        () => adminService.moverEquipo(unidad.id, destino || null),
                        nombre
                          ? `${unidad.nombre} ahora depende de ${nombre}`
                          : `${unidad.nombre} es de primer nivel`,
                      )
                    }}
                    className="w-56"
                  >
                    <option value="">Nadie (primer nivel)</option>
                    {filas
                      .filter((o) => !fuera.has(o.id))
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {etiquetaOpcion(o)}
                        </option>
                      ))}
                  </Select>
                </div>
              </header>

              {/* Modulos de la unidad: los de la empresa, o propios */}
              {empresa && (
                <div className="space-y-2 rounded-xl border border-border px-3 py-2.5">
                  <label className="flex items-center gap-2 text-sm text-fg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={unidad.modulos === null}
                      disabled={ocupado !== null}
                      onChange={(e) =>
                        void guardarModulos(
                          () =>
                            adminService.modulosEquipo(
                              unidad.id,
                              e.target.checked ? null : empresa.modulos,
                            ),
                          e.target.checked
                            ? `${unidad.nombre} usa los módulos de la empresa`
                            : `${unidad.nombre} ahora tiene módulos propios`,
                        )
                      }
                      className="accent-accent w-3.5 h-3.5"
                    />
                    Módulos: los mismos de la empresa
                  </label>
                  {unidad.modulos !== null && (
                    <SelectorModulos
                      value={unidad.modulos}
                      disabled={ocupado !== null}
                      onChange={(m) =>
                        void guardarModulos(
                          () => adminService.modulosEquipo(unidad.id, m),
                          `Módulos de ${unidad.nombre} actualizados`,
                        )
                      }
                    />
                  )}
                </div>
              )}

              {/* Gente por rol */}
              {GRUPOS.map((g) => {
                const lista = unidad.personas.filter((p) => p.rol === g.rol)
                return (
                  <div key={g.rol} className="space-y-1.5">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
                      {g.titulo}
                    </h3>
                    {lista.length === 0 ? (
                      <p className="text-sm text-fg-faint">{g.vacio}</p>
                    ) : (
                      <ul className="divide-y divide-border rounded-xl border border-border">
                        {lista.map((p) => (
                          <li key={p.id} className="flex items-center gap-2 px-3 py-2">
                            <span className="flex-1 min-w-0 truncate text-sm text-fg">
                              {p.nombre}
                            </span>
                            <Select
                              size="sm"
                              aria-label={`Rol de ${p.nombre} en ${unidad.nombre}`}
                              value={p.rol}
                              disabled={ocupado !== null}
                              onChange={(ev) =>
                                void cambiarRol(unidad, p, ev.target.value as RolEquipo)
                              }
                              className="w-36"
                            >
                              {OPCIONES_ROL.map((r) => (
                                <option key={r.value} value={r.value}>
                                  {r.label}
                                </option>
                              ))}
                            </Select>
                            <Button
                              variant="ghost"
                              size="sm"
                              icon="x"
                              aria-label={`Quitar a ${p.nombre} de ${unidad.nombre}`}
                              disabled={ocupado !== null}
                              onClick={() =>
                                void hacer(
                                  `quitar-${p.id}`,
                                  () => adminService.quitarDeEquipo(p.id, unidad.id),
                                  `${p.nombre} salió de ${unidad.nombre}`,
                                )
                              }
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}

              {/* Agregar gente */}
              <div className="space-y-2 border-t border-border pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
                  Agregar persona
                </h3>
                <form
                  className="flex flex-wrap gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void agregar(unidad)
                  }}
                >
                  <div className="flex-1 min-w-[12rem]">
                    <Select
                      aria-label="Persona de la empresa"
                      value={agregarId}
                      onChange={(e) => setAgregarId(e.target.value)}
                    >
                      <option value="">
                        {disponibles.length ? 'Elegir persona…' : 'No hay más personas'}
                      </option>
                      {disponibles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="w-36">
                    <Select
                      aria-label="Rol en la unidad"
                      value={agregarRol}
                      onChange={(e) => setAgregarRol(e.target.value as RolEquipo)}
                    >
                      {OPCIONES_ROL.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button type="submit" loading={ocupado === 'agregar'} disabled={!agregarId}>
                    Agregar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    icon="plus"
                    onClick={() => setCrearAbierto(true)}
                  >
                    Nueva persona
                  </Button>
                </form>
                {superior && (
                  <label className="flex items-center gap-2 text-xs text-fg-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sumarArriba}
                      onChange={(e) => setSumarArriba(e.target.checked)}
                      className="accent-accent w-3.5 h-3.5"
                    />
                    Al nombrar un Líder, agregarlo también como Integrante de {superior.nombre}
                  </label>
                )}
              </div>

              {/* Unidad debajo */}
              <div className="space-y-2 border-t border-border pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
                  Crear unidad debajo de {unidad.nombre}
                </h3>
                <form
                  className="flex flex-wrap gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void crearUnidad(nuevaHija, unidad.id, nivelNueva)
                  }}
                >
                  <div className="flex-1 min-w-[12rem]">
                    <Input
                      aria-label="Nombre de la unidad nueva"
                      value={nuevaHija}
                      onChange={(e) => setNuevaHija(e.target.value)}
                      placeholder="Nombre"
                      maxLength={60}
                    />
                  </div>
                  <div className="w-40">
                    <Select
                      aria-label="Nivel de la unidad nueva"
                      value={nivelNueva}
                      onChange={(e) => setNivelHija(e.target.value)}
                    >
                      <option value="">Sin nivel</option>
                      {niveles.map((n) => (
                        <option key={n} value={n}>
                          {n}
                          {n === sugerido ? ' (sugerido)' : ''}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button
                    type="submit"
                    icon="plus"
                    loading={ocupado === 'crear-unidad' && nuevaHija.trim().length >= 2}
                    disabled={nuevaHija.trim().length < 2}
                  >
                    Crear
                  </Button>
                </form>
              </div>

              {/* Borrar (solo unidades sin trabajo; lo valida el servidor) */}
              <div className="border-t border-border pt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  icon="trash"
                  className="text-danger"
                  loading={ocupado === 'borrar'}
                  disabled={ocupado !== null}
                  onClick={() => void borrar(unidad)}
                >
                  Borrar unidad
                </Button>
              </div>
            </section>
          )}
        </div>
      )}

      <CrearPersona
        key={`${unidad?.id ?? ''}-${agregarRol}`}
        open={crearAbierto}
        equipos={equipos.datos}
        equipoInicial={unidad?.id}
        rolInicial={agregarRol}
        onClose={() => setCrearAbierto(false)}
        onCreada={(arriba) => {
          if (arriba) toast.success(`También quedó como Integrante de ${arriba}`)
          recargar()
        }}
      />
    </div>
  )
}
