import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@infrastructure/supabase/client'
import { Button } from '@shared/components/ui/Button'
import { useAuth } from '@core/auth/hooks/useAuth'
import { CONTACTO_SUSCRIPCION, estadoSuscripcion, fechaCorta } from '@core/auth/plan'
import { AuthShell } from './AuthShell'

/**
 * La empresa ya no puede usar la app: termino la prueba de 15 dias (056) o vencio el pago y paso
 * la gracia (063). Mientras no exista el portal de pago, se pide contactar; el Owner registra el
 * pago, la deja gratis o le extiende la prueba desde la consola. Los datos no se borran.
 */
export function PruebaTerminada() {
  const { empresa, signOut } = useAuth()
  const navigate = useNavigate()
  const estado = empresa ? estadoSuscripcion(empresa) : null
  const pagoVencido = estado?.tipo === 'vencida'
  const asunto = encodeURIComponent(
    `${pagoVencido ? 'Renovación' : 'Suscripción'} Lumix: ${empresa?.nombre ?? ''}`,
  )
  // Correos de contacto que define el Owner (migracion 057); si no se pueden leer, el de
  // respaldo.
  const [contactos, setContactos] = useState<string[]>([CONTACTO_SUSCRIPCION])
  useEffect(() => {
    supabase
      .from('plataforma')
      .select('contacto_suscripcion')
      .maybeSingle()
      .then(({ data }) => {
        const lista = (data as { contacto_suscripcion: string[] } | null)?.contacto_suscripcion
        if (lista?.length) setContactos(lista)
      })
  }, [])

  return (
    <AuthShell
      title={pagoVencido ? 'Tu suscripción venció' : 'Tu prueba terminó'}
      subtitle={empresa?.nombre ?? 'Lumix'}
    >
      <div className="space-y-4 text-sm text-fg-body">
        <p>
          {pagoVencido
            ? `Tu suscripción a Lumix venció${
                estado.hasta ? ` el ${fechaCorta(estado.hasta)}` : ''
              }. Tu información sigue guardada: escríbenos y la renovamos.`
            : 'Los 15 días de prueba de Lumix terminaron. Tu información sigue guardada: escríbenos y activamos tu suscripción.'}
        </p>
        <a
          href={`mailto:${contactos.join(',')}?subject=${asunto}`}
          className="flex h-11 w-full items-center justify-center rounded-md bg-accent-fill text-sm font-semibold text-on-accent hover:opacity-90"
        >
          {pagoVencido ? 'Escribir para renovar' : 'Escribir para activar'}
        </a>
        <Button
          variant="ghost"
          className="w-full"
          onClick={async () => {
            await signOut()
            navigate('/login')
          }}
        >
          Cerrar sesión
        </Button>
      </div>
    </AuthShell>
  )
}
