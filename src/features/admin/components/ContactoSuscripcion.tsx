import { useEffect, useState } from 'react'
import { adminService } from '@infrastructure/supabase/admin.service'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import { useToast } from '@shared/components/ui/Toast'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Correos a los que escribe quien termina su prueba ("Escribir para activar"). Solo el Owner:
 * de 1 a 5 correos, por ejemplo el suyo y el de otra persona del equipo. Se guarda al tiro.
 */
export function ContactoSuscripcion() {
  const toast = useToast()
  const [contactos, setContactos] = useState<string[] | null>(null)
  const [nuevo, setNuevo] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    let vigente = true
    adminService
      .verContactos()
      .then((c) => vigente && setContactos(c))
      .catch((e: Error) => vigente && toast.error(e.message))
    return () => {
      vigente = false
    }
  }, [toast])

  const guardar = async (lista: string[]) => {
    setGuardando(true)
    try {
      setContactos(await adminService.editarContactos(lista))
      toast.success('Contacto actualizado')
      setNuevo('')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  const agregar = () => {
    const c = nuevo.trim().toLowerCase()
    if (!EMAIL.test(c)) return toast.error('El email no es válido')
    if (contactos?.includes(c)) return toast.error('Ese correo ya está')
    void guardar([...(contactos ?? []), c])
  }

  return (
    <section className="lamina px-4 py-3 space-y-2" aria-label="Contacto para suscripciones">
      <div>
        <p className="text-sm font-medium text-fg">Contacto para suscripciones</p>
        <p className="text-xs text-fg-faint">
          Cuando una prueba termina, el botón "Escribir para activar" abre un correo a estas
          direcciones (de 1 a 5).
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {contactos === null ? (
          <span className="text-xs text-fg-faint">Cargando…</span>
        ) : (
          contactos.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs text-fg"
            >
              {c}
              {contactos.length > 1 && (
                <button
                  type="button"
                  aria-label={`Quitar ${c}`}
                  disabled={guardando}
                  className="text-fg-faint hover:text-danger"
                  onClick={() => void guardar(contactos.filter((x) => x !== c))}
                >
                  ×
                </button>
              )}
            </span>
          ))
        )}
      </div>
      {contactos && contactos.length < 5 && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            agregar()
          }}
        >
          <div className="flex-1">
            <Input
              aria-label="Agregar correo de contacto"
              type="email"
              value={nuevo}
              onChange={(e) => setNuevo(e.target.value)}
              placeholder="otra.persona@empresa.com"
              maxLength={254}
            />
          </div>
          <Button type="submit" variant="secondary" icon="plus" loading={guardando}>
            Agregar
          </Button>
        </form>
      )}
    </section>
  )
}
