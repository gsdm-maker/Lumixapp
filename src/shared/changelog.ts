// Aviso de novedades: se muestra UNA vez por usuario (no por dispositivo, ver migracion 044)
// cuando `profile.changelog_visto` queda atras de este numero. Al agregar una tanda nueva de
// cambios: subir CHANGELOG_VERSION en 1, actualizar APP_VERSION_DATE a la fecha de esa tanda, y
// reemplazar CHANGELOG_ITEMS por los cambios de esa tanda (no se acumulan versiones viejas en la
// lista, cada version muestra solo lo suyo).
export const CHANGELOG_VERSION = 6

// Se muestra en Perfil (footer de "Sobre Lumix") para que cualquiera pueda confirmar, mirando
// la pantalla, que version tiene cargada -util para saber si ya le llego una actualizacion.
export const APP_VERSION = `1.${CHANGELOG_VERSION}`
export const APP_VERSION_DATE = '06-10-2026' // DD-MM-AAAA, se actualiza junto con la version

export interface ChangelogItem {
  title: string
  desc: string
}

export const CHANGELOG_ITEMS: ChangelogItem[] = [
  {
    title: 'Lumix con nueva cara',
    desc: 'Tema claro por defecto, letra más legible y colores solo donde importan. En Perfil puedes volver al oscuro y elegir el color de acento.',
  },
  {
    title: 'El chat como registro de trabajo',
    desc: 'Lo que Lumix crea queda bajo el mensaje que lo pidió, las preguntas se responden ahí mismo y ves lo que Lumix entendió antes de enviar.',
  },
  {
    title: 'Actividades por urgencia',
    desc: 'Agrupadas en Vencidas, Hoy y Esta semana, con vistas guardadas y el detalle en un panel lateral que no tapa la lista.',
  },
  {
    title: 'Modo reunión',
    desc: 'En la Minuta, "Empezar reunión" muestra un tema a la vez con decisiones de una tecla. Compromisos ahora permite cerrar la semana.',
  },
  {
    title: 'Proyectos, Planificación y permisos',
    desc: 'Línea de tiempo por proyecto, mapa de carga por persona y día, y una matriz de permisos en Equipos.',
  },
]
