import type { Capability } from './capabilities'
import type { IconName } from '@shared/components/ui/Icon'

// Modulos de Lumix que una empresa enciende o apaga (migracion 056). El Chat siempre esta. Cada
// unidad puede tener los suyos (teams.modulos; null = los de la empresa) y encima sigue el
// permiso por persona 'modulos.*' (capabilities.ts).

export type Modulo =
  | 'actividades'
  | 'proyectos'
  | 'minuta'
  | 'compromisos'
  | 'errores'
  | 'ingestas'
  | 'planificacion'
  | 'dashboard'

export const MODULOS: { key: Modulo; label: string; descripcion: string; icon: IconName }[] = [
  {
    key: 'actividades',
    label: 'Actividades',
    descripcion: 'Lo que cada persona tiene que hacer, con responsable, prioridad y fecha.',
    icon: 'checkCircle',
  },
  {
    key: 'planificacion',
    label: 'Planificación',
    descripcion: 'La carga de la semana por persona, para repartir sin sobrecargar a nadie.',
    icon: 'calendar',
  },
  {
    key: 'dashboard',
    label: 'Dashboard',
    descripcion: 'Indicadores del equipo: avance, atrasos y cumplimiento.',
    icon: 'chart',
  },
  {
    key: 'proyectos',
    label: 'Proyectos',
    descripcion: 'Proyectos con cronograma, prioridad y actividades asociadas.',
    icon: 'folder',
  },
  {
    key: 'minuta',
    label: 'Minuta de equipo',
    descripcion: 'Los temas de la reunión semanal, con responsables y plazos.',
    icon: 'clipboard',
  },
  {
    key: 'compromisos',
    label: 'Compromisos',
    descripcion: 'Seguimiento de lo comprometido en la semana contra una meta.',
    icon: 'handshake',
  },
  {
    key: 'errores',
    label: 'Errores',
    descripcion: 'Bitácora de incidentes, con severidad, área responsable y cierre.',
    icon: 'bug',
  },
  {
    key: 'ingestas',
    label: 'Ingestas',
    descripcion: 'Trabajo técnico de datos: cargas, tablas, pipelines y su estado.',
    icon: 'database',
  },
]

/** Los que vienen marcados al crear un espacio. */
export const MODULOS_POR_DEFECTO: Modulo[] = ['actividades', 'planificacion', 'dashboard']

/** El modulo que corresponde a un permiso 'modulos.*' (o null si el permiso no es de modulo). */
export function moduloDe(cap: Capability): Modulo | null {
  return cap.startsWith('modulos.') ? (cap.slice('modulos.'.length) as Modulo) : null
}
