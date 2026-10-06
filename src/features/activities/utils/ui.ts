import type { Activity, ActivityStatus } from '@shared/types'

// Piezas chicas que comparten la tabla, el panel y los formularios de Actividades. Viven aca
// (y no en los .tsx) para que cada archivo de componentes exporte solo componentes.

/** Siguiente accion logica de una fila (docs/design-system.md, "Acciones de fila"). */
export function siguienteAccion(
  a: Activity,
): { label: string; status: ActivityStatus; completar?: boolean } | null {
  if (a.status === 'pendiente') return { label: 'Iniciar', status: 'en_proceso' }
  if (a.status === 'en_proceso')
    return { label: 'Completar', status: 'completado', completar: true }
  if (a.status === 'bloqueado') return { label: 'Reanudar', status: 'en_proceso' }
  return null
}

/** id del DOM de una fila, para llevarla a la vista al moverse con las flechas. */
export const filaDomId = (id: string) => `actividad-${id}`

// El DatePicker compartido recibe la clase de su boton: se le dan la altura y los tokens de
// los demas campos para que no desentone (por defecto trae el estilo anterior al rediseno).
const FECHA_BASE =
  'rounded-md border border-border-strong bg-field text-left text-fg hover:border-fg-faint focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20'

/** Fecha dentro de un formulario (alto de Input). */
export const FECHA_CAMPO = `${FECHA_BASE} h-10 sm:h-9 w-full px-3 text-base sm:text-sm`

/** Fecha en una barra de filtros (alto de Select sm). */
export const FECHA_FILTRO = `${FECHA_BASE} h-8 w-full sm:w-32 px-2.5 text-sm`

/** Fecha editable dentro de la grilla del panel de detalle. */
export const FECHA_INLINE = `${FECHA_BASE} h-7 px-2 text-sm`
