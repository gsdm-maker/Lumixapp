import { useCallback, useEffect, useState } from 'react'
import { fechaCorta } from '@core/auth/plan'
import { adminService, type EmpresaAdmin, type Pago } from '@infrastructure/supabase/admin.service'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import { Modal } from '@shared/components/ui/Modal'
import { EmptyState } from '@shared/components/ui/EmptyState'
import { SkeletonRows } from '@shared/components/ui/Skeleton'
import { useToast } from '@shared/components/ui/Toast'
import { cx } from '@shared/utils/cx'
import { METODO_PAGO_LABEL, fechaHora, pesos } from '../utils/formato'
import { exportarPagos } from '../utils/pagos'

/**
 * Lista de pagos de una empresa, del mas nuevo al mas viejo. Con `onAnular` (solo el Owner) cada
 * pago vigente se puede anular con un motivo; los anulados quedan a la vista, tachados.
 */
export function HistorialPagos({
  pagos,
  onAnular,
}: {
  pagos: Pago[]
  onAnular?: (pago: Pago, motivo: string) => Promise<void>
}) {
  const [anulando, setAnulando] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)

  if (pagos.length === 0)
    return (
      <EmptyState
        icon="historial"
        title="Sin pagos registrados"
        description="Cuando se registre un cobro, aparecerá aquí."
      />
    )

  return (
    <ul className="divide-y divide-border">
      {pagos.map((p) => {
        const anulado = p.anulado_at !== null
        return (
          <li key={p.id} className="py-2.5 space-y-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span
                className={cx(
                  'text-sm font-semibold tabular-nums',
                  anulado ? 'text-fg-faint line-through' : 'text-fg',
                )}
              >
                {pesos(p.monto)}
              </span>
              <span className="text-xs text-fg-muted">
                {p.meses} {p.meses === 1 ? 'mes' : 'meses'} · del {fechaCorta(p.periodo_desde)} al{' '}
                {fechaCorta(p.periodo_hasta)}
              </span>
              {anulado && (
                <span className="rounded-full bg-danger-soft px-2 py-0.5 text-2xs font-semibold text-danger">
                  Anulado
                </span>
              )}
              {onAnular && !anulado && anulando !== p.id && (
                <Button
                  variant="ghost"
                  size="xs"
                  className="ml-auto"
                  onClick={() => {
                    setAnulando(p.id)
                    setMotivo('')
                  }}
                >
                  Anular
                </Button>
              )}
            </div>
            <p className="text-xs text-fg-faint">
              {METODO_PAGO_LABEL[p.metodo] ?? p.metodo}
              {p.referencia && ` · ${p.referencia}`} · registrado {fechaHora(p.created_at)}
              {p.registrado && ` por ${p.registrado.full_name}`}
              {p.nota && ` · ${p.nota}`}
            </p>
            {anulado && (
              <p className="text-xs text-danger">
                Anulado {fechaHora(p.anulado_at as string)}
                {p.anulado && ` por ${p.anulado.full_name}`}: {p.motivo_anulacion}
              </p>
            )}
            {onAnular && anulando === p.id && (
              <form
                className="flex gap-2 items-end pt-1"
                onSubmit={async (ev) => {
                  ev.preventDefault()
                  if (motivo.trim().length < 3) return
                  setEnviando(true)
                  try {
                    await onAnular(p, motivo.trim())
                    setAnulando(null)
                  } finally {
                    setEnviando(false)
                  }
                }}
              >
                <div className="flex-1">
                  <Input
                    label="Motivo de la anulación"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Ej.: transferencia rechazada…"
                    autoComplete="off"
                    maxLength={300}
                    autoFocus
                  />
                </div>
                <Button variant="ghost" size="sm" onClick={() => setAnulando(null)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  variant="danger"
                  loading={enviando}
                  disabled={motivo.trim().length < 3}
                >
                  Anular pago
                </Button>
              </form>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** Historial de pagos de una empresa en un modal (consola del Owner). */
export function PagosEmpresa({
  empresa,
  onClose,
  onCambio,
}: {
  empresa: EmpresaAdmin | null
  onClose: () => void
  /** Se anulo un pago: el vencimiento de la empresa cambio. */
  onCambio: () => void
}) {
  const toast = useToast()
  const [pagos, setPagos] = useState<Pago[] | null>(null)
  const [error, setError] = useState('')

  const cargar = useCallback(async (id: string) => {
    setError('')
    try {
      setPagos(await adminService.pagosEmpresa(id))
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    if (!empresa) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- se recarga al abrir otra empresa
    setPagos(null)
    void cargar(empresa.id)
  }, [empresa, cargar])

  const anular = async (p: Pago, motivo: string) => {
    try {
      await adminService.anularPago(p.id, motivo)
      toast.success('Pago anulado')
      if (empresa) await cargar(empresa.id)
      onCambio()
    } catch (e) {
      toast.error((e as Error).message)
      throw e
    }
  }

  return (
    <Modal
      open={empresa !== null}
      onClose={onClose}
      size="lg"
      title={`Pagos · ${empresa?.nombre ?? ''}`}
      footer={
        <>
          <Button
            variant="ghost"
            icon="download"
            disabled={!pagos?.length}
            onClick={() => pagos && empresa && exportarPagos(pagos, empresa.nombre)}
          >
            Exportar
          </Button>
          <Button onClick={onClose}>Listo</Button>
        </>
      }
    >
      {error ? (
        <EmptyState icon="alert" title="No se pudo cargar" description={error} />
      ) : pagos === null ? (
        <SkeletonRows rows={3} />
      ) : (
        <HistorialPagos pagos={pagos} onAnular={anular} />
      )}
    </Modal>
  )
}
