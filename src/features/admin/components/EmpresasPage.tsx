import { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate, useOutletContext } from 'react-router-dom'
import { useAuth } from '@core/auth/hooks/useAuth'
import { estadoSuscripcion, fechaCorta, type EstadoSuscripcion } from '@core/auth/plan'
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
import { RegistrarPago } from './RegistrarPago'
import { PagosEmpresa } from './HistorialPagos'
import { SegmentedControl } from '@shared/components/ui/SegmentedControl'
import { pesos } from '../utils/formato'
import type { ContextoAdmin } from './AdminLayout'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const estadoDe = (e: EmpresaAdmin): EstadoSuscripcion =>
  estadoSuscripcion({ plan: e.plan, prueba_hasta: e.pruebaHasta, pagado_hasta: e.pagadoHasta })

type Tono = 'ok' | 'aviso' | 'vencido'

/** Como se ve el plan de una empresa: texto y tono. */
function estadoPlan(e: EmpresaAdmin): { texto: string; tono: Tono } {
  const est = estadoDe(e)
  const d = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`
  switch (est.tipo) {
    case 'gratis':
      return { texto: 'Gratis', tono: 'ok' }
    case 'prueba':
      return { texto: `Prueba · ${d(est.dias)}`, tono: est.dias <= 3 ? 'aviso' : 'ok' }
    case 'prueba_vencida':
      return { texto: 'Prueba vencida', tono: 'vencido' }
    case 'al_dia':
      return { texto: `Pagada hasta ${fechaCorta(est.hasta)}`, tono: 'ok' }
    case 'por_vencer':
      return {
        texto: est.dias === 0 ? 'Pagada · vence hoy' : `Pagada · vence en ${d(est.dias)}`,
        tono: 'aviso',
      }
    case 'en_gracia':
      return { texto: `Vencida · gracia ${d(est.quedan)}`, tono: 'vencido' }
    case 'vencida':
      return {
        texto: est.hasta ? `Vencida el ${fechaCorta(est.hasta)}` : 'Pagada sin fecha',
        tono: 'vencido',
      }
  }
}

type Filtro = 'todas' | 'por_vencer' | 'vencidas'

/** Por vencer: necesita atencion pronto. Vencidas: ya bloqueadas. */
function filtroDe(e: EmpresaAdmin): Filtro | null {
  const est = estadoDe(e)
  if (est.tipo === 'vencida' || est.tipo === 'prueba_vencida') return 'vencidas'
  if (est.tipo === 'por_vencer' || est.tipo === 'en_gracia') return 'por_vencer'
  if (est.tipo === 'prueba' && est.dias <= 3) return 'por_vencer'
  return null
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
  const [paraPago, setParaPago] = useState<EmpresaAdmin | null>(null)
  const [verPagos, setVerPagos] = useState<EmpresaAdmin | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [resumen, setResumen] = useState<{ cobradoMes: number; pagosMes: number } | null>(null)

  const cargarResumen = useCallback(() => {
    adminService
      .resumenPagos()
      .then(setResumen)
      .catch(() => setResumen(null))
  }, [])
  useEffect(() => {
    if (profile?.es_owner) cargarResumen()
  }, [profile?.es_owner, cargarResumen])

  if (profile && !profile.es_owner) return <Navigate to="/admin" replace />

  const recargar = () => {
    void empresas.recargar()
    recargarEmpresas()
    cargarResumen()
  }

  const cuenta = (f: Filtro) => empresas.datos.filter((e) => filtroDe(e) === f).length
  const visibles =
    filtro === 'todas' ? empresas.datos : empresas.datos.filter((e) => filtroDe(e) === filtro)

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

        <section
          aria-label="Cobros"
          className="lamina px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-1"
        >
          <div>
            <p className="text-xs text-fg-faint">Cobrado este mes</p>
            <p className="text-lg font-semibold text-fg tabular-nums">
              {resumen ? pesos(resumen.cobradoMes) : '…'}
              {resumen && (
                <span className="ml-1.5 text-xs font-normal text-fg-faint">
                  {resumen.pagosMes} {resumen.pagosMes === 1 ? 'pago' : 'pagos'}
                </span>
              )}
            </p>
          </div>
          {!empresas.cargando && (
            <SegmentedControl
              label="Filtrar empresas"
              size="sm"
              className="ml-auto"
              value={filtro}
              onChange={setFiltro}
              options={[
                { value: 'todas', label: 'Todas', count: empresas.datos.length },
                { value: 'por_vencer', label: 'Por vencer', count: cuenta('por_vencer') },
                { value: 'vencidas', label: 'Vencidas', count: cuenta('vencidas') },
              ]}
            />
          )}
        </section>

        {empresas.error ? (
          <EmptyState icon="alert" title="No se pudo cargar" description={empresas.error} />
        ) : empresas.cargando ? (
          <SkeletonRows rows={4} />
        ) : (
          <ul className="lamina divide-y divide-border">
            {visibles.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-fg-faint">
                Ninguna empresa en este grupo.
              </li>
            )}
            {visibles.map((e) => (
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
                  <Button variant="ghost" size="xs" icon="plus" onClick={() => setParaPago(e)}>
                    Registrar pago
                  </Button>
                  <Button variant="ghost" size="xs" onClick={() => setVerPagos(e)}>
                    Pagos
                  </Button>
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

      <RegistrarPago empresa={paraPago} onClose={() => setParaPago(null)} onListo={recargar} />
      <PagosEmpresa empresa={verPagos} onClose={() => setVerPagos(null)} onCambio={recargar} />

      <ClaveTemporal
        clave={clave?.clave ?? null}
        persona={clave?.nombre ?? ''}
        email={clave?.email ?? ''}
        onClose={() => setClave(null)}
      />
    </div>
  )
}
