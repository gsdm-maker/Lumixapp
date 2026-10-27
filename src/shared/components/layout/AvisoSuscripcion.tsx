import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@core/auth/hooks/useAuth'
import { estadoSuscripcion, fechaCorta, hoyChile } from '@core/auth/plan'
import { Icon } from '@shared/components/ui/Icon'
import { cx } from '@shared/utils/cx'

const CLAVE = 'lumix.aviso-suscripcion'

function cerradoHoy(): boolean {
  try {
    return localStorage.getItem(CLAVE) === hoyChile()
  } catch {
    return false
  }
}

/**
 * Aviso al Admin de la empresa cuando la suscripcion esta por vencer (7 dias antes), en gracia o
 * la prueba esta por terminar (3 dias). Solo al Admin: es quien gestiona el pago. Se puede cerrar
 * por el dia.
 */
export function AvisoSuscripcion() {
  const { profile, empresa } = useAuth()
  const [cerrado, setCerrado] = useState(cerradoHoy)
  if (cerrado || !empresa || profile?.role !== 'admin' || profile.es_owner) return null

  const est = estadoSuscripcion(empresa)
  const d = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`
  let texto: string
  let grave = false
  if (est.tipo === 'por_vencer')
    texto =
      est.dias === 0
        ? 'Tu suscripción vence hoy.'
        : `Tu suscripción vence el ${fechaCorta(est.hasta)} (en ${d(est.dias)}).`
  else if (est.tipo === 'en_gracia') {
    texto = `Tu suscripción venció el ${fechaCorta(est.hasta)}. Quedan ${d(est.quedan)} antes de que se bloquee.`
    grave = true
  } else if (est.tipo === 'prueba' && est.dias <= 3) texto = `Tu prueba termina en ${d(est.dias)}.`
  else return null

  const cerrar = () => {
    try {
      localStorage.setItem(CLAVE, hoyChile())
    } catch {
      // Sin almacenamiento: se cierra solo por esta vez.
    }
    setCerrado(true)
  }

  return (
    <div
      role="status"
      className={cx(
        'shrink-0 mx-3 md:mx-5 mt-2 flex items-center gap-2 rounded-2xl px-4 py-2 text-sm',
        grave ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning',
      )}
    >
      <Icon name="alert" size={16} />
      <span className="flex-1 min-w-0">
        {texto}{' '}
        <Link to="/admin/suscripcion" className="font-semibold underline underline-offset-2">
          Ver suscripción
        </Link>
      </span>
      <button
        type="button"
        onClick={cerrar}
        aria-label="Cerrar aviso por hoy"
        className="shrink-0 rounded-full p-1 hover:bg-black/5"
      >
        <Icon name="x" size={14} />
      </button>
    </div>
  )
}
