import { useState } from 'react'
import { fechaCorta, hoyChile, periodoDePago } from '@core/auth/plan'
import {
  adminService,
  type EmpresaAdmin,
  type MetodoPago,
} from '@infrastructure/supabase/admin.service'
import { Button } from '@shared/components/ui/Button'
import { Input, Select } from '@shared/components/ui/Input'
import { Modal } from '@shared/components/ui/Modal'
import { SegmentedControl } from '@shared/components/ui/SegmentedControl'
import { useToast } from '@shared/components/ui/Toast'
import { METODO_PAGO_LABEL, pesos } from '../utils/formato'

const MESES = ['1', '3', '6', '12'] as const
type Meses = (typeof MESES)[number]

/**
 * Registrar un cobro de una empresa (solo el Owner). Muestra antes de guardar hasta cuando queda
 * pagada: el periodo parte hoy, o al dia siguiente del vencimiento si aun no vence.
 */
export function RegistrarPago({
  empresa,
  onClose,
  onListo,
}: {
  empresa: EmpresaAdmin | null
  onClose: () => void
  onListo: () => void
}) {
  const toast = useToast()
  const [monto, setMonto] = useState('')
  const [meses, setMeses] = useState<Meses>('1')
  const [metodo, setMetodo] = useState<MetodoPago>('transferencia')
  const [referencia, setReferencia] = useState('')
  const [nota, setNota] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const valor = Number(monto.replace(/\D/g, ''))
  const periodo = empresa ? periodoDePago(empresa.pagadoHasta, Number(meses)) : null

  const cerrar = () => {
    setMonto('')
    setMeses('1')
    setMetodo('transferencia')
    setReferencia('')
    setNota('')
    setError('')
    onClose()
  }

  const guardar = async () => {
    if (!empresa) return
    if (!valor) return setError('Escribe el monto en pesos.')
    setError('')
    setGuardando(true)
    try {
      const pago = await adminService.registrarPago(empresa.id, {
        monto: valor,
        meses: Number(meses),
        metodo,
        referencia,
        nota,
      })
      toast.success(`${empresa.nombre} queda pagada hasta el ${fechaCorta(pago.periodo_hasta)}`)
      cerrar()
      onListo()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      open={empresa !== null}
      onClose={cerrar}
      title={`Registrar pago · ${empresa?.nombre ?? ''}`}
      description="Anota el cobro que recibiste. La empresa queda pagada hasta el fin del período."
      footer={
        <>
          <Button variant="ghost" onClick={cerrar}>
            Cancelar
          </Button>
          <Button type="submit" form="registrar-pago" loading={guardando} disabled={!valor}>
            Registrar {valor ? pesos(valor) : 'pago'}
          </Button>
        </>
      }
    >
      <form
        id="registrar-pago"
        noValidate
        className="space-y-3"
        onSubmit={(ev) => {
          ev.preventDefault()
          void guardar()
        }}
      >
        <Input
          label="Monto (CLP)"
          inputMode="numeric"
          autoComplete="off"
          value={valor ? valor.toLocaleString('es-CL') : monto}
          onChange={(e) => setMonto(e.target.value.replace(/\D/g, '').slice(0, 9))}
          placeholder="25.000"
        />
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-fg">Período</p>
          <SegmentedControl
            label="Meses pagados"
            value={meses}
            onChange={setMeses}
            options={MESES.map((m) => ({ value: m, label: m === '1' ? '1 mes' : `${m} meses` }))}
          />
        </div>
        <Select
          label="Método"
          value={metodo}
          onChange={(e) => setMetodo(e.target.value as MetodoPago)}
        >
          {Object.entries(METODO_PAGO_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <Input
          label="Referencia (opcional)"
          value={referencia}
          onChange={(e) => setReferencia(e.target.value)}
          placeholder="N.º de transferencia o boleta"
          autoComplete="off"
          maxLength={120}
        />
        <Input
          label="Nota (opcional)"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          autoComplete="off"
          maxLength={500}
        />
        {periodo && (
          <p className="rounded-xl bg-accent-soft px-3 py-2 text-sm text-fg">
            Cubre del <strong>{fechaCorta(periodo.desde)}</strong> al{' '}
            <strong>{fechaCorta(periodo.hasta)}</strong>.
            {empresa?.pagadoHasta && periodo.desde !== hoyChile() && (
              <span className="text-fg-muted">
                {' '}
                Sigue al vencimiento actual: no se pierden días.
              </span>
            )}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}
