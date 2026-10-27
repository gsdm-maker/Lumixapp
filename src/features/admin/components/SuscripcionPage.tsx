import { useEffect, useState } from 'react'
import { useAuth } from '@core/auth/hooks/useAuth'
import { CONTACTO_SUSCRIPCION, estadoSuscripcion, fechaCorta } from '@core/auth/plan'
import { adminService, type Pago } from '@infrastructure/supabase/admin.service'
import { supabase } from '@infrastructure/supabase/client'
import { PageHeader } from '@shared/components/ui/PageHeader'
import { EmptyState } from '@shared/components/ui/EmptyState'
import { SkeletonRows } from '@shared/components/ui/Skeleton'
import { cx } from '@shared/utils/cx'
import { HistorialPagos } from './HistorialPagos'

/**
 * Suscripcion de la empresa, para su Admin (solo lectura): estado, hasta cuando esta pagada y el
 * historial de pagos. Los cobros los registra el Owner; para renovar se le escribe.
 */
export function SuscripcionPage() {
  const { empresa } = useAuth()
  const [pagos, setPagos] = useState<Pago[] | null>(null)
  const [error, setError] = useState('')
  const [contactos, setContactos] = useState<string[]>([CONTACTO_SUSCRIPCION])

  useEffect(() => {
    adminService
      .misPagos()
      .then(setPagos)
      .catch((e: Error) => setError(e.message))
    supabase
      .from('plataforma')
      .select('contacto_suscripcion')
      .maybeSingle()
      .then(({ data }) => {
        const lista = (data as { contacto_suscripcion: string[] } | null)?.contacto_suscripcion
        if (lista?.length) setContactos(lista)
      })
  }, [])

  if (!empresa) return null
  const est = estadoSuscripcion(empresa)
  const { titulo, detalle, tono } = describir(est)
  const asunto = encodeURIComponent(`Suscripción Lumix: ${empresa.nombre}`)

  return (
    <div className="flex flex-col">
      <PageHeader title="Suscripción" meta={empresa.nombre} />
      <div className="px-3 sm:px-5 py-3 max-w-3xl space-y-4">
        <section
          aria-label="Estado"
          className={cx(
            'rounded-2xl px-4 py-3 space-y-1',
            tono === 'vencido' ? 'bg-danger-soft' : tono === 'aviso' ? 'bg-warning-soft' : 'lamina',
          )}
        >
          <p className="text-base font-semibold text-fg">{titulo}</p>
          {detalle && <p className="text-sm text-fg-muted">{detalle}</p>}
          {est.tipo !== 'gratis' && (
            <a
              href={`mailto:${contactos.join(',')}?subject=${asunto}`}
              className="inline-block pt-1 text-sm font-semibold text-accent hover:underline"
            >
              Escribir para renovar o activar
            </a>
          )}
        </section>

        <section aria-label="Historial de pagos" className="lamina px-4 py-3">
          <h2 className="text-sm font-semibold text-fg pb-1">Historial de pagos</h2>
          {error ? (
            <EmptyState icon="alert" title="No se pudo cargar" description={error} />
          ) : pagos === null ? (
            <SkeletonRows rows={3} />
          ) : (
            <HistorialPagos pagos={pagos} />
          )}
        </section>
      </div>
    </div>
  )
}

function describir(est: ReturnType<typeof estadoSuscripcion>): {
  titulo: string
  detalle?: string
  tono: 'ok' | 'aviso' | 'vencido'
} {
  const d = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`
  switch (est.tipo) {
    case 'gratis':
      return { titulo: 'Plan gratis', detalle: 'Sin vencimiento.', tono: 'ok' }
    case 'prueba':
      return { titulo: `Prueba: quedan ${d(est.dias)}`, tono: est.dias <= 3 ? 'aviso' : 'ok' }
    case 'prueba_vencida':
      return { titulo: 'La prueba terminó', tono: 'vencido' }
    case 'al_dia':
      return { titulo: `Al día hasta el ${fechaCorta(est.hasta)}`, tono: 'ok' }
    case 'por_vencer':
      return {
        titulo: est.dias === 0 ? 'Vence hoy' : `Vence en ${d(est.dias)}`,
        detalle: `Pagada hasta el ${fechaCorta(est.hasta)}.`,
        tono: 'aviso',
      }
    case 'en_gracia':
      return {
        titulo: `Venció el ${fechaCorta(est.hasta)}`,
        detalle: `Tienes ${d(est.quedan)} más de uso antes de que se bloquee.`,
        tono: 'vencido',
      }
    case 'vencida':
      return { titulo: 'La suscripción venció', tono: 'vencido' }
  }
}
