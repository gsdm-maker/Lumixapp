import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@infrastructure/supabase/client'
import { Button } from '@shared/components/ui/Button'
import { useAuth } from '@core/auth/hooks/useAuth'
import { CONTACTO_SUSCRIPCION } from '@core/auth/plan'
import { AuthShell } from './AuthShell'

/**
 * La prueba de 15 dias de la empresa termino (migracion 056). Mientras no exista el portal de
 * pago, se pide contactar para activar la suscripcion; el Owner puede dejar la empresa gratis o
 * extenderle la prueba desde la consola. Los datos no se borran.
 */
export function PruebaTerminada() {
  const { empresa, signOut } = useAuth()
  const navigate = useNavigate()
  const asunto = encodeURIComponent(`Suscripción Lumix: ${empresa?.nombre ?? ''}`)
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
    <AuthShell title="Tu prueba terminó" subtitle={empresa?.nombre ?? 'Lumix'}>
      <div className="space-y-4 text-sm text-fg-body">
        <p>
          Los 15 días de prueba de Lumix terminaron. Tu información sigue guardada: escríbenos y
          activamos tu suscripción.
        </p>
        <a
          href={`mailto:${contactos.join(',')}?subject=${asunto}`}
          className="flex h-11 w-full items-center justify-center rounded-md bg-accent-fill text-sm font-semibold text-on-accent hover:opacity-90"
        >
          Escribir para activar
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
