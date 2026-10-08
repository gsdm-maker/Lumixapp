import { useState } from 'react'
import {
  adminService,
  type EquipoAdmin,
  type PersonaAdmin,
  type RolEquipo,
} from '@infrastructure/supabase/admin.service'
import { SidePanel } from '@shared/components/ui/SidePanel'
import { Button, IconButton } from '@shared/components/ui/Button'
import { Select } from '@shared/components/ui/Input'
import { Badge } from '@shared/components/ui/Badge'
import { SectionLabel } from '@shared/components/ui/Indicators'
import { Icon } from '@shared/components/ui/Icon'
import { useToast } from '@shared/components/ui/Toast'
import { useConfirm } from '@shared/components/ui/ConfirmDialog'
import { fechaHora, haceCuanto, OPCIONES_ROL } from '../utils/formato'
import { ClaveTemporal } from './ClaveTemporal'

/** Ficha de una persona: sus equipos y roles, y su acceso (clave temporal, desactivar). */
export function PersonaPanel({
  persona,
  equipos,
  onClose,
  onCambio,
}: {
  persona: PersonaAdmin | null
  equipos: EquipoAdmin[]
  onClose: () => void
  onCambio: () => void
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [clave, setClave] = useState<string | null>(null)
  const [nuevoEquipo, setNuevoEquipo] = useState('')
  const [nuevoRol, setNuevoRol] = useState<RolEquipo>('colaborador')

  if (!persona) return null
  const p = persona

  const hacer = async (id: string, accion: () => Promise<unknown>, ok: string) => {
    setOcupado(id)
    try {
      await accion()
      toast.success(ok)
      onCambio()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setOcupado(null)
    }
  }

  const generarClave = async () => {
    const seguro = await confirm({
      title: 'Generar clave temporal',
      message: `La clave actual de ${p.nombre} deja de funcionar. Al ingresar con la nueva, deberá cambiarla.`,
      confirmLabel: 'Generar clave',
    })
    if (!seguro) return
    setOcupado('clave')
    try {
      setClave(await adminService.claveTemporal(p.id))
      onCambio()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setOcupado(null)
    }
  }

  const desactivar = async () => {
    const seguro = await confirm({
      title: `Desactivar a ${p.nombre}`,
      message:
        'No podrá volver a ingresar. Su historial (actividades, minutas, mensajes) se conserva y puedes reactivarla cuando quieras. Si tiene la app abierta, la sesión se corta en menos de una hora.',
      confirmLabel: 'Desactivar',
      tone: 'danger',
    })
    if (seguro) void hacer('acceso', () => adminService.desactivar(p.id), `${p.nombre} desactivada`)
  }

  const quitar = async (equipoId: string, nombre: string) => {
    const seguro = await confirm({
      title: `Quitar de ${nombre}`,
      message: `${p.nombre} deja de ver ${nombre}. Sus actividades en ese equipo se conservan.`,
      confirmLabel: 'Quitar',
      tone: 'danger',
    })
    if (seguro)
      void hacer(
        `quitar-${equipoId}`,
        () => adminService.quitarDeEquipo(p.id, equipoId),
        `Quitada de ${nombre}`,
      )
  }

  const disponibles = equipos.filter((e) => !p.equipos.some((m) => m.id === e.id))

  return (
    <>
      <SidePanel
        open
        onClose={onClose}
        eyebrow="Persona"
        title={p.nombre}
        footer={
          !p.esAdmin && (
            <div className="flex w-full flex-wrap gap-2">
              <Button
                variant="secondary"
                icon="clave"
                loading={ocupado === 'clave'}
                disabled={!p.activa}
                onClick={generarClave}
              >
                Clave temporal
              </Button>
              {p.activa ? (
                <Button
                  variant="danger"
                  icon="desactivar"
                  className="ml-auto"
                  loading={ocupado === 'acceso'}
                  onClick={desactivar}
                >
                  Desactivar
                </Button>
              ) : (
                <Button
                  className="ml-auto"
                  icon="refresh"
                  loading={ocupado === 'acceso'}
                  onClick={() =>
                    void hacer(
                      'acceso',
                      () => adminService.reactivar(p.id),
                      `${p.nombre} reactivada`,
                    )
                  }
                >
                  Reactivar
                </Button>
              )}
            </div>
          )
        }
      >
        <div className="space-y-6">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-fg-faint">Email</dt>
            <dd className="text-fg break-all">{p.email}</dd>
            <dt className="text-fg-faint">Estado</dt>
            <dd>
              {p.activa ? (
                <Badge variant="success">Activa</Badge>
              ) : (
                <Badge variant="blocked">Desactivada</Badge>
              )}
              {p.activa && p.debeCambiarClave && (
                <Badge variant="warning" className="ml-1.5">
                  Debe cambiar su clave
                </Badge>
              )}
            </dd>
            <dt className="text-fg-faint">Último ingreso</dt>
            <dd className="text-fg">
              {haceCuanto(p.ultimoIngreso)}
              {p.ultimoIngreso && (
                <span className="text-fg-faint"> · {fechaHora(p.ultimoIngreso)}</span>
              )}
            </dd>
            {p.creada && (
              <>
                <dt className="text-fg-faint">Cuenta creada</dt>
                <dd className="text-fg">{fechaHora(p.creada)}</dd>
              </>
            )}
          </dl>

          {p.esAdmin ? (
            <p className="flex gap-2 rounded-xl bg-surface p-3 text-sm text-fg-muted">
              <Icon name="shield" size={16} className="shrink-0 mt-0.5" />
              Administrador global: ve todos los equipos. Esta cuenta no se modifica desde la
              consola.
            </p>
          ) : (
            <section className="space-y-2">
              <SectionLabel>Equipos y rol</SectionLabel>
              {p.equipos.length === 0 ? (
                <p className="text-sm text-fg-faint">
                  Sin equipo: al ingresar no verá nada. Súmala a uno.
                </p>
              ) : (
                <ul className="lamina divide-y divide-border">
                  {p.equipos.map((e) => (
                    <li key={e.id} className="flex items-center gap-2 px-3 py-2">
                      <span className="flex-1 min-w-0 text-sm text-fg truncate">
                        {e.nombre}
                        {p.equipoActivo === e.id && p.equipos.length > 1 && (
                          <span className="text-xs text-fg-faint"> · activo</span>
                        )}
                      </span>
                      <Select
                        size="sm"
                        aria-label={`Rol en ${e.nombre}`}
                        value={e.rol}
                        disabled={ocupado !== null}
                        onChange={(ev) =>
                          void hacer(
                            `rol-${e.id}`,
                            () => adminService.cambiarRol(p.id, e.id, ev.target.value as RolEquipo),
                            `Rol actualizado en ${e.nombre}`,
                          )
                        }
                        className="w-36 shrink-0"
                      >
                        {OPCIONES_ROL.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </Select>
                      <IconButton
                        icon="x"
                        size="sm"
                        label={`Quitar de ${e.nombre}`}
                        disabled={ocupado !== null}
                        onClick={() => void quitar(e.id, e.nombre)}
                      />
                    </li>
                  ))}
                </ul>
              )}

              {disponibles.length > 0 && (
                <form
                  className="flex flex-wrap items-end gap-2 pt-1"
                  onSubmit={(ev) => {
                    ev.preventDefault()
                    const eq = equipos.find((x) => x.id === nuevoEquipo)
                    if (!eq) return
                    void hacer(
                      'sumar',
                      () => adminService.sumarAEquipo(p.id, eq.id, nuevoRol),
                      `Sumada a ${eq.nombre}`,
                    ).then(() => setNuevoEquipo(''))
                  }}
                >
                  <Select
                    size="sm"
                    aria-label="Equipo al que sumar"
                    value={nuevoEquipo}
                    onChange={(ev) => setNuevoEquipo(ev.target.value)}
                    className="flex-1 min-w-40"
                  >
                    <option value="">Sumar a otro equipo…</option>
                    {disponibles.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nombre}
                      </option>
                    ))}
                  </Select>
                  <Select
                    size="sm"
                    aria-label="Rol en el equipo nuevo"
                    value={nuevoRol}
                    onChange={(ev) => setNuevoRol(ev.target.value as RolEquipo)}
                    className="w-32"
                  >
                    {OPCIONES_ROL.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </Select>
                  <Button
                    type="submit"
                    size="sm"
                    variant="secondary"
                    icon="plus"
                    disabled={!nuevoEquipo}
                    loading={ocupado === 'sumar'}
                  >
                    Sumar
                  </Button>
                </form>
              )}
            </section>
          )}
        </div>
      </SidePanel>

      <ClaveTemporal
        clave={clave}
        persona={p.nombre}
        email={p.email}
        onClose={() => setClave(null)}
      />
    </>
  )
}
