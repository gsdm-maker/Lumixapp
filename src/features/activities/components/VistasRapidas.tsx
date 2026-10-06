import { useState } from 'react'
import { Button, IconButton } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import { Modal } from '@shared/components/ui/Modal'
import { useToast } from '@shared/components/ui/Toast'
import { cx } from '@shared/utils/cx'
import type { FiltrosActividades } from '@features/activities/hooks/useActivities'
import { useVistasGuardadas } from '@features/activities/hooks/useVistasGuardadas'

const BASE: FiltrosActividades = {
  status: 'activas',
  team: 'todas',
  member: 'todas',
  grupo: 'todas',
  plazo: 'todos',
  dateType: 'entrega',
  dateFrom: '',
  dateTo: '',
}

const iguales = (a: FiltrosActividades, b: FiltrosActividades) =>
  (Object.keys(BASE) as (keyof FiltrosActividades)[]).every((k) => a[k] === b[k])

interface VistasRapidasProps {
  userId: string | undefined
  profileId: string | undefined
  teamId: string | null | undefined
  filtros: FiltrosActividades
  aplicar: (f: FiltrosActividades) => void
}

/**
 * Vistas rapidas (idea 7): tres combinaciones frecuentes ya armadas, mas las que cada persona
 * guarda. Aplicar una vista reemplaza todos los filtros de una vez; la busqueda no se toca
 * porque es momentanea.
 */
export function VistasRapidas({ userId, profileId, teamId, filtros, aplicar }: VistasRapidasProps) {
  const { vistas, guardar, borrar } = useVistasGuardadas(userId)
  const toast = useToast()
  const [nombrando, setNombrando] = useState(false)
  const [nombre, setNombre] = useState('')

  // "Mis vencidas" cruza equipos a proposito: lo mio atrasado, este donde este.
  const predefinidas: { id: string; nombre: string; filtros: FiltrosActividades }[] = [
    ...(profileId
      ? [
          {
            id: 'mis-vencidas',
            nombre: 'Mis vencidas',
            filtros: { ...BASE, member: profileId, plazo: 'vencidas' as const },
          },
        ]
      : []),
    {
      id: 'equipo-semana',
      nombre: 'Equipo esta semana',
      filtros: { ...BASE, team: teamId ?? 'todas', plazo: 'semana' },
    },
    {
      id: 'bloqueadas',
      nombre: 'Bloqueadas',
      filtros: { ...BASE, status: 'bloqueado', team: teamId ?? 'todas' },
    },
  ]

  const cerrarModal = () => {
    setNombrando(false)
    setNombre('')
  }

  const confirmarGuardar = () => {
    const n = nombre.trim()
    if (!n) return
    guardar(n, filtros)
    cerrarModal()
    toast.success(`Vista "${n}" guardada`)
  }

  return (
    <div className="flex flex-wrap items-center gap-1" aria-label="Vistas">
      {[...predefinidas, ...vistas].map((v) => {
        const activa = iguales(v.filtros, filtros)
        const propia = vistas.some((x) => x.id === v.id)
        return (
          <span key={v.id} className="inline-flex items-center">
            <button
              type="button"
              aria-pressed={activa}
              onClick={() => aplicar(v.filtros)}
              className={cx(
                'h-7 px-2 rounded-md text-xs font-medium transition-colors',
                activa ? 'bg-surface-2 text-fg' : 'text-fg-muted hover:bg-surface hover:text-fg',
              )}
            >
              {v.nombre}
            </button>
            {propia && (
              <IconButton
                icon="x"
                size="xs"
                label={`Quitar vista ${v.nombre}`}
                className="-ml-1 !w-6"
                onClick={() => {
                  borrar(v.id)
                  toast.success('Vista quitada', {
                    action: { label: 'Deshacer', onClick: () => guardar(v.nombre, v.filtros) },
                  })
                }}
              />
            )}
          </span>
        )
      })}
      <Button size="xs" variant="ghost" icon="plus" onClick={() => setNombrando(true)}>
        Guardar vista
      </Button>

      <Modal
        open={nombrando}
        onClose={cerrarModal}
        title="Guardar vista"
        description="Guarda la combinación de filtros actual para volver a ella con un clic."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={cerrarModal}>
              Cancelar
            </Button>
            <Button disabled={!nombre.trim()} onClick={confirmarGuardar}>
              Guardar
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            confirmarGuardar()
          }}
        >
          <Input
            label="Nombre"
            value={nombre}
            maxLength={40}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Pendientes de mi grupo"
          />
        </form>
      </Modal>
    </div>
  )
}
