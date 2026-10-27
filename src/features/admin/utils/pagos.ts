import type { Pago } from '@infrastructure/supabase/admin.service'
import { exportToCSV } from '@shared/utils/export'
import { METODO_PAGO_LABEL, fechaHora } from './formato'

/** Exporta los pagos a un CSV que abre en Excel. */
export function exportarPagos(pagos: Pago[], nombre: string) {
  exportToCSV(
    pagos.map((p) => ({
      Registrado: fechaHora(p.created_at),
      Monto: p.monto,
      Meses: p.meses,
      Desde: p.periodo_desde,
      Hasta: p.periodo_hasta,
      Método: METODO_PAGO_LABEL[p.metodo] ?? p.metodo,
      Referencia: p.referencia ?? '',
      Nota: p.nota ?? '',
      'Registrado por': p.registrado?.full_name ?? '',
      Estado: p.anulado_at ? `Anulado: ${p.motivo_anulacion ?? ''}` : 'Vigente',
    })),
    `pagos-${nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  )
}
