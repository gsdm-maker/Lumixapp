import { useState } from 'react'
import { Navigate, useNavigate, useOutletContext } from 'react-router-dom'
import { useAuth } from '@core/auth/hooks/useAuth'
import {
  adminService,
  empresaFoco,
  type EmpresaAdmin,
  type PlanEmpresa,
} from '@infrastructure/supabase/admin.service'
import { cx } from '@shared/utils/cx'
import { PageHeader } from '@shared/components/ui/PageHeader'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import { Modal } from '@shared/components/ui/Modal'
import { EmptyState } from '@shared/components/ui/EmptyState'
import { SkeletonRows } from '@shared/components/ui/Skeleton'
import { useToast } from '@shared/components/ui/Toast'
import { useConfirm } from '@shared/components/ui/ConfirmDialog'
import { normalizeFullName } from '@shared/utils/name'
import { useCargaAdmin } from '../hooks/useAdmin'
import { ClaveTemporal } from './ClaveTemporal'
import { ContactoSuscripcion } from './ContactoSuscripcion'
import type { ContextoAdmin } from './AdminLayout'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Como se ve el plan de una empresa: texto y tono. */
function estadoPlan(e: EmpresaAdmin): { texto: string; tono: 'ok' | 'aviso' | 'vencido' } {
  if (e.plan === 'gratis') return { texto: 'Gratis', tono: 'ok' }
  if (e.plan === 'pago') return { texto: 'Pagada', tono: 'ok' }
  const dias = Math.ceil((Date.parse(e.pruebaHasta) - Date.now()) / 86_400_000)
  if (dias <= 0) return { texto: 'Prueba vencida', tono: 'vencido' }
  return {
    texto: `Prueba · ${dias} ${dias === 1 ? 'día' : 'días'}`,
    tono: dias <= 3 ? 'aviso' : 'ok',
  }
}

/**
 * Empresas de la plataforma (solo el Owner): crear una empresa, nombrar a su Admin (que despues
 * arma la estructura y suma a su gente) y elegir en cual trabajar.
 */
export function EmpresasPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { recargarEmpresas } = useOutletContext<ContextoAdmin>()
  const empresas = useCargaAdmin<EmpresaAdmin>(adminService.listarEmpresas)
  const toast = useToast()
  const confirm = useConfirm()

  const [nombre, setNombre] = useState('')
  const [creando, setCreando] = useState(false)
  const [paraAdmin, setParaAdmin] = useState<EmpresaAdmin | null>(null)
  const [adminNombre, setAdminNombre] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminError, setAdminError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [clave, setClave] = useState<{ clave: string; nombre: string; email: string } | null>(null)

  if (profile && !profile.es_owner) return <Navigate to="/admin" replace />

  const recargar = () => {
    void empresas.recargar()
    recargarEmpresas()
  }

  const crear = async () => {
    const n = nombre.trim()
    if (n.length < 2) return
    setCreando(true)
    try {
      await adminService.crearEmpresa(n)
      setNombre('')
      toast.success(`Empresa ${n} creada. Ahora nombra a su Admin.`)
      recargar()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setCreando(false)
    }
  }

  const cambiarPlan = async (e: EmpresaAdmin, plan: PlanEmpresa, dias?: number) => {
    try {
      await adminService.cambiarPlan(e.id, plan, dias)
      toast.success(
        plan === 'gratis'
          ? `${e.nombre} queda gratis`
          : plan === 'pago'
            ? `${e.nombre} queda como pagada`
            : `Prueba de ${e.nombre} extendida ${dias} días`,
      )
      recargar()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const trabajarEn = (e: EmpresaAdmin) => {
    empresaFoco.set(e.esMia ? null : e.id)
    navigate('/admin/estructura')
  }

  const abrirAdmin = (e: EmpresaAdmin) => {
    setParaAdmin(e)
    setAdminNombre('')
    setAdminEmail('')
    setAdminError('')
  }

  const nombrarAdmin = async () => {
    if (!paraAdmin) return
    const n = normalizeFullName(adminNombre)
    const correo = adminEmail.trim().toLowerCase()
    if (n.length < 3) return setAdminError('Escribe nombre y apellido.')
    if (!EMAIL.test(correo)) return setAdminError('El email no es válido.')
    setAdminError('')
    setGuardando(true)
    try {
      const r = await adminService.nombrarAdminNuevo(paraAdmin.id, n, correo)
      setParaAdmin(null)
      setClave({ clave: r.clave, nombre: n, email: correo })
      recargar()
    } catch (e) {
      setAdminError((e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  const quitarAdmin = async (e: EmpresaAdmin, a: { id: string; nombre: string }) => {
    const ok = await confirm({
      title: `Quitar Admin a ${a.nombre}`,
      message: `Deja de administrar ${e.nombre}; su cuenta sigue en la empresa como Integrante.`,
      confirmLabel: 'Quitar Admin',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await adminService.quitarAdmin(a.id)
      toast.success(`${a.nombre} ya no es Admin de ${e.nombre}`)
      recargar()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Empresas"
        meta={empresas.cargando ? undefined : `${empresas.datos.length} empresas`}
      />

      <div className="px-3 sm:px-5 py-3 max-w-3xl space-y-4">
        <p className="text-sm text-fg-muted">
          Tú eres el <strong className="text-fg">Owner</strong>: ves todas las empresas. Cada una
          tiene su <strong className="text-fg">Admin</strong>, que arma su estructura y suma a su
          gente, y no ve las demás.
        </p>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void crear()
          }}
        >
          <div className="flex-1">
            <Input
              aria-label="Nombre de la nueva empresa"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre de la nueva empresa"
              maxLength={80}
            />
          </div>
          <Button type="submit" icon="plus" loading={creando} disabled={nombre.trim().length < 2}>
            Crear empresa
          </Button>
        </form>

        <ContactoSuscripcion />

        {empresas.error ? (
          <EmptyState icon="alert" title="No se pudo cargar" description={empresas.error} />
        ) : empresas.cargando ? (
          <SkeletonRows rows={4} />
        ) : (
          <ul className="lamina divide-y divide-border">
            {empresas.datos.map((e) => (
              <li key={e.id} className="px-4 py-3 space-y-2">
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-[12rem]">
                    <p className="text-sm font-medium text-fg">
                      {e.nombre}
                      {e.esMia && <span className="text-xs text-fg-faint"> · tuya</span>}
                      {e.personal && <span className="text-xs text-fg-faint"> · personal</span>}
                    </p>
                    <p className="text-xs text-fg-faint">
                      {e.niveles.join(' › ')} · {e.unidades}{' '}
                      {e.unidades === 1 ? 'unidad' : 'unidades'} · {e.personas}{' '}
                      {e.personas === 1 ? 'persona' : 'personas'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => trabajarEn(e)}>
                      Trabajar aquí
                    </Button>
                    <Button variant="ghost" size="sm" icon="plus" onClick={() => abrirAdmin(e)}>
                      Nombrar Admin
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-fg-muted">Plan:</span>
                  <span
                    className={cx(
                      'rounded-full px-2 py-0.5 font-semibold',
                      estadoPlan(e).tono === 'vencido'
                        ? 'bg-danger-soft text-danger'
                        : estadoPlan(e).tono === 'aviso'
                          ? 'bg-warning-soft text-warning'
                          : 'bg-success-soft text-success',
                    )}
                  >
                    {estadoPlan(e).texto}
                  </span>
                  {e.plan !== 'gratis' && (
                    <Button variant="ghost" size="xs" onClick={() => void cambiarPlan(e, 'gratis')}>
                      Dar gratis
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => void cambiarPlan(e, 'prueba', 15)}
                  >
                    Prueba +15 días
                  </Button>
                  {e.plan !== 'pago' && (
                    <Button variant="ghost" size="xs" onClick={() => void cambiarPlan(e, 'pago')}>
                      Marcar pagada
                    </Button>
                  )}
                  <span className="text-fg-faint">· {e.modulos.length + 1} módulos</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-fg-muted">Admin:</span>
                  {e.admins.length === 0 ? (
                    <span className="text-warning">sin Admin todavía</span>
                  ) : (
                    e.admins.map((a) => (
                      <span
                        key={a.id}
                        className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-fg"
                      >
                        {a.nombre}
                        {a.id !== profile?.id && (
                          <button
                            type="button"
                            aria-label={`Quitar Admin a ${a.nombre}`}
                            className="text-fg-faint hover:text-danger"
                            onClick={() => void quitarAdmin(e, a)}
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={paraAdmin !== null}
        onClose={() => setParaAdmin(null)}
        title={`Admin de ${paraAdmin?.nombre ?? ''}`}
        description="Se crea su cuenta con una clave temporal que deberá cambiar al ingresar."
        footer={
          <>
            <Button variant="ghost" onClick={() => setParaAdmin(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="nombrar-admin" loading={guardando}>
              Crear Admin
            </Button>
          </>
        }
      >
        <form
          id="nombrar-admin"
          noValidate
          className="space-y-3"
          onSubmit={(ev) => {
            ev.preventDefault()
            void nombrarAdmin()
          }}
        >
          <Input
            label="Nombre completo"
            value={adminNombre}
            onChange={(e) => setAdminNombre(e.target.value)}
            placeholder="Nombre y apellido"
            autoComplete="off"
            maxLength={80}
          />
          <Input
            label="Email"
            type="email"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            placeholder="admin@empresa.com"
            autoComplete="off"
            maxLength={254}
          />
          {adminError && (
            <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
              {adminError}
            </p>
          )}
        </form>
      </Modal>

      <ClaveTemporal
        clave={clave?.clave ?? null}
        persona={clave?.nombre ?? ''}
        email={clave?.email ?? ''}
        onClose={() => setClave(null)}
      />
    </div>
  )
}
