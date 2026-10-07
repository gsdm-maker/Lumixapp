import type { IconName } from '@shared/components/ui/Icon'
import type { TagColor } from '@shared/utils/colores'
import type { TipoMensaje } from './vistaPrevia'

/**
 * Color e icono de cada tipo de mensaje: los mismos del modulo al que va (Actividades azul,
 * Minuta ambar, Proyectos violeta, Errores rojo, Ingestas turquesa), para que elegir el tipo
 * ya diga a donde va a parar lo que se escribe.
 */
export const TIPO_ESTILO: Record<TipoMensaje, { color: TagColor | 'accent'; icon: IconName }> = {
  auto: { color: 'accent', icon: 'chat' },
  actividad: { color: 'blue', icon: 'list' },
  error: { color: 'red', icon: 'bug' },
  ingesta: { color: 'teal', icon: 'database' },
  masivo: { color: 'pink', icon: 'layers' },
  minuta: { color: 'amber', icon: 'clipboard' },
  proyecto: { color: 'violet', icon: 'folder' },
}
