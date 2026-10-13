import { useMemo, useState } from 'react'
import {
  adminService,
  type EquipoAdmin,
  type RolEquipo,
} from '@infrastructure/supabase/admin.service'
import { Modal } from '@shared/components/ui/Modal'
import { Button } from '@shared/components/ui/Button'
import { Input, Select } from '@shared/components/ui/Input'
import { normalizeFullName } from '@shared/utils/name'
import { OPCIONES_ROL } from '../utils/formato'
import { enArbol, etiquetaOpcion } from '../utils/arbol'
import { ClaveTemporal } from './ClaveTemporal'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Crear una cuenta: nombre, email, unidad y rol. Al terminar muestra la clave temporal.
 * Desde Estructura se abre con la unidad (y el rol) ya elegidos.
 */
export function CrearPersona({
  open,
  equipos,
  equipoInicial,
  rolInicial,
  onClose,
  onCreada,
}: {
  open: boolean
  equipos: EquipoAdmin[]
  equipoInicial?: string
  rolInicial?: RolEquipo
  onClose: () => void
  onCreada: (arriba: string | null) => void
}) {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  // Valores de partida: quien lo abre con otra unidad lo vuelve a montar (key), asi no hace
  // falta sincronizarlos con un efecto.
  const [rol, setRol] = useState<RolEquipo>(rolInicial ?? 'integrante')
  const [equipoId, setEquipoId] = useState(equipoInicial ?? '')
  const [error, setError] = useState('')
  const [creando, setCreando] = useState(false)
  const [creada, setCreada] = useState<{ clave: string; nombre: string; email: string } | null>(
    null,
  )
  // Al nombrar Lider, sumarlo tambien como Integrante de la unidad de arriba (marcado por
  // defecto: lo normal es que una jefatura este en el equipo de su jefe).
  const [sumarArriba, setSumarArriba] = useState(true)

  const filas = useMemo(() => enArbol(equipos), [equipos])
  const superior = equipos.find((e) => e.id === equipos.find((x) => x.id === equipoId)?.superior)

  const limpiar = () => {
    setNombre('')
    setEmail('')
    setRol(rolInicial ?? 'integrante')
    setEquipoId(equipoInicial ?? '')
    setSumarArriba(true)
    setError('')
  }
  const cerrar = () => {
    limpiar()
    onClose()
  }

  const crear = async () => {
    const n = normalizeFullName(nombre)
    const e = email.trim().toLowerCase()
    if (n.length < 3) return setError('Escribe nombre y apellido.')
    if (!EMAIL.test(e)) return setError('El email no es válido.')
    if (!equipoId) return setError('Elige una unidad (sin unidad, al ingresar no verá nada).')
    setError('')
    setCreando(true)
    try {
      const r = await adminService.crearPersona(
        e,
        n,
        rol,
        equipoId,
        rol === 'lider' && !!superior && sumarArriba,
      )
      setCreada({ clave: r.clave, nombre: n, email: e })
      limpiar()
      onClose()
      onCreada(r.arriba)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setCreando(false)
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={cerrar}
        title="Nueva persona"
        description="Se crea con una clave temporal que deberá cambiar al ingresar."
        footer={
          <>
            <Button variant="ghost" onClick={cerrar}>
              Cancelar
            </Button>
            <Button type="submit" form="crear-persona" loading={creando}>
              Crear cuenta
            </Button>
          </>
        }
      >
        <form
          id="crear-persona"
          noValidate
          className="space-y-3"
          onSubmit={(ev) => {
            ev.preventDefault()
            void crear()
          }}
        >
          <Input
            label="Nombre completo"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre y apellido"
            autoComplete="off"
            maxLength={80}
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="persona@empresa.com"
            autoComplete="off"
            maxLength={254}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select label="Unidad" value={equipoId} onChange={(e) => setEquipoId(e.target.value)}>
              <option value="">Elegir…</option>
              {filas.map((f) => (
                <option key={f.id} value={f.id}>
                  {etiquetaOpcion(f)}
                </option>
              ))}
            </Select>
            <Select label="Rol" value={rol} onChange={(e) => setRol(e.target.value as RolEquipo)}>
              {OPCIONES_ROL.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </div>
          {rol === 'lider' && superior && (
            <label className="flex items-center gap-2 text-xs text-fg-muted cursor-pointer">
              <input
                type="checkbox"
                checked={sumarArriba}
                onChange={(e) => setSumarArriba(e.target.checked)}
                className="accent-accent w-3.5 h-3.5"
              />
              Agregar también como Integrante de {superior.nombre}
            </label>
          )}
          {error && (
            <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
        </form>
      </Modal>

      <ClaveTemporal
        clave={creada?.clave ?? null}
        persona={creada?.nombre ?? ''}
        email={creada?.email ?? ''}
        onClose={() => setCreada(null)}
      />
    </>
  )
}
