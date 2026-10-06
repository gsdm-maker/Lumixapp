// Aviso de novedades: se muestra UNA vez por usuario (no por dispositivo, ver migracion 044)
// cuando `profile.changelog_visto` queda atras de este numero. Al agregar una tanda nueva de
// cambios: subir CHANGELOG_VERSION en 1, actualizar APP_VERSION_DATE a la fecha de esa tanda, y
// reemplazar CHANGELOG_ITEMS por los cambios de esa tanda (no se acumulan versiones viejas en la
// lista, cada version muestra solo lo suyo).
export const CHANGELOG_VERSION = 5

// Se muestra en Perfil (footer de "Sobre Lumix") para que cualquiera pueda confirmar, mirando
// la pantalla, que version tiene cargada -util para saber si ya le llego una actualizacion.
export const APP_VERSION = `1.${CHANGELOG_VERSION}`
export const APP_VERSION_DATE = '06-10-2026' // DD-MM-AAAA, se actualiza junto con la version

export interface ChangelogItem {
  icon: string
  title: string
  desc: string
}

export const CHANGELOG_ITEMS: ChangelogItem[] = [
  {
    icon: '🤝',
    title: 'Compromisos incluye Proyectos',
    desc: 'Lo asignado desde un proyecto ahora cuenta como compromiso, con su etiqueta. Y un boton muestra los vencidos sin cerrar de cualquier semana.',
  },
  {
    icon: '🌳',
    title: 'Subtareas agrupadas',
    desc: 'En Actividades las subtareas de un proyecto se ven debajo de su tarea padre, y las que crees desde una actividad tambien aparecen en el proyecto.',
  },
  {
    icon: '📅',
    title: 'Fechas al asignar en Proyectos',
    desc: 'Para asignar una actividad desde un proyecto hay que definir inicio y termino: quedan en el Cronograma.',
  },
  {
    icon: '🔐',
    title: 'Permisos mas completos',
    desc: 'Proyectos, Ingestas, Compromisos y la configuracion del equipo tienen permisos propios. Nadie perdio los que ya tenia.',
  },
]
