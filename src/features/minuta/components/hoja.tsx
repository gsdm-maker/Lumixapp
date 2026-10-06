// Lo que todas las vistas de la hoja (tabla, lista movil, panel de detalle, modo reunion)
// necesitan saber y poder hacer sobre un tema. Se arma UNA vez en MinutaPage y se pasa entero:
// asi cada vista no recibe quince props sueltas, y un permiso nuevo se agrega en un solo lugar.

import { Button } from '@shared/components/ui/Button'
import type { DecoratedItem } from '@features/minuta/hooks/useMinuta'
import { esEscalado, puedeAsignarse, sinActividad } from '@features/minuta/utils/temas'
import type { MinuteItem, Profile } from '@shared/types'

export interface Hoja {
  esIngesta: boolean
  esMinuta: boolean
  canManage: boolean
  canDelete: boolean
  canAssign: boolean
  members: Profile[]
  allItems: DecoratedItem[]
  memberName: (id: string) => string
  guardar: (id: string, patch: Partial<MinuteItem>) => void
  guardarPlazo: (item: DecoratedItem, v: string | null) => void
  guardarTema: (id: string, tema: string) => void
  guardarComentarios: (id: string, comentarios: string) => void
  addItem: (tema: string, parentItemId: string) => void
  /** Abre "Crear actividad"; `soloEstos` acota a quienes aun no la tienen. */
  asignar: (it: DecoratedItem, soloEstos?: string[]) => void
  /** Pide confirmacion y elimina (tema o subtarea). */
  eliminar: (id: string) => void
  yaConversado: (it: DecoratedItem) => Promise<unknown>
  verCronograma: (it: DecoratedItem) => void
  abrirDetalle: (it: DecoratedItem) => void
}

/**
 * La siguiente accion logica de un tema, la UNICA que se muestra en la fila (el resto vive en
 * el panel de detalle). Orden de prioridad: crear la actividad que falta > cerrar la
 * conversacion de un tema escalado. Nada si no hay nada que hacer.
 */
export function AccionPrincipal({
  it,
  hoja,
  size = 'xs',
}: {
  it: DecoratedItem
  hoja: Hoja
  size?: 'xs' | 'sm'
}) {
  if (hoja.canAssign && puedeAsignarse(it)) {
    return (
      <Button size={size} onClick={() => hoja.asignar(it)}>
        Asignar actividad
      </Button>
    )
  }
  const faltan =
    hoja.canAssign && !it.para_todos && it.linkedActivities.length > 0 ? sinActividad(it) : []
  if (faltan.length > 0) {
    return (
      <Button
        size={size}
        variant="secondary"
        onClick={() => hoja.asignar(it, faltan)}
        title={`${faltan.map(hoja.memberName).join(', ')} figura como responsable pero no tiene actividad`}
      >
        Crear actividad faltante
      </Button>
    )
  }
  if (hoja.canManage && esEscalado(it)) {
    return (
      <Button
        size={size}
        variant="secondary"
        onClick={() => hoja.yaConversado(it)}
        title="Cierra la conversación: el tema sale de aquí y su actividad sigue su curso"
      >
        Ya lo conversamos
      </Button>
    )
  }
  return null
}
