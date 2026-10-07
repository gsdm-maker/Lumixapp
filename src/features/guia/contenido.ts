import type { Capability } from '@core/auth/capabilities'
import type { IconName } from '@shared/components/ui/Icon'
import type { TagColor } from '@shared/utils/colores'

// Contenido de la Guia de Lumix, separado de la pantalla para que actualizarlo sea editar
// texto y no JSX. Sale de revisar el codigo de cada modulo (octubre 2026): si una hoja cambia,
// actualizar aca su seccion en el mismo commit.

export interface Accion {
  /** Nombre corto, con la etiqueta que se ve en pantalla. */
  t: string
  /** Que hace y como se usa. */
  d: string
}

export interface SeccionGuia {
  id: string
  titulo: string
  icon: IconName
  color?: TagColor | 'accent'
  /** Ruta del modulo, para el boton "Abrir". */
  ruta?: string
  /** Si hace falta permiso para ver el modulo: la seccion se oculta a quien no lo tiene. */
  capability?: Capability
  /** Solo para el administrador global. */
  soloAdmin?: boolean
  /** Para que sirve, en una o dos frases. */
  resumen: string
  acciones: Accion[]
  reglas?: string[]
  /** Quien puede hacer que (segun rol o permiso). */
  permisos?: string[]
  consejos?: string[]
}

/** El recorrido del trabajo en Lumix, de punta a punta. */
export const FLUJO: {
  icon: IconName
  color: TagColor | 'accent'
  titulo: string
  texto: string
}[] = [
  {
    icon: 'chat',
    color: 'accent',
    titulo: '1. Lo escribes en el Chat',
    texto:
      'Cuentas lo que hay que hacer en lenguaje natural ("revisar el cierre de ventas para el viernes, urgente"). Lumix entiende quién, cuándo y con qué prioridad, y lo crea.',
  },
  {
    icon: 'list',
    color: 'blue',
    titulo: '2. Queda como Actividad',
    texto:
      'Todo trabajo concreto termina siendo una actividad con responsable, fecha y estado. Desde Actividades se sigue, se edita y se cierra.',
  },
  {
    icon: 'clipboard',
    color: 'amber',
    titulo: '3. La reunión se lleva en la Minuta',
    texto:
      'Los temas de la reunión semanal se conversan y, al asignarlos, se convierten en actividades. Los proyectos hacen lo mismo con iniciativas más largas.',
  },
  {
    icon: 'checkCircle',
    color: 'green',
    titulo: '4. Se rinde cuentas en Compromisos',
    texto:
      'Lo que nació de la Minuta o de un Proyecto es un compromiso con el equipo. Cada semana se revisa hecho / no hecho contra la meta de 90%.',
  },
  {
    icon: 'chart',
    color: 'violet',
    titulo: '5. Se mide en el Dashboard',
    texto:
      'Tendencias, carga por persona, proyectos y lo atrasado, para ver cómo va el equipo y dónde hace falta ayuda.',
  },
]

export const SECCIONES: SeccionGuia[] = [
  {
    id: 'chat',
    titulo: 'Chat',
    icon: 'chat',
    color: 'accent',
    ruta: '/chat',
    resumen:
      'El registro del equipo y la forma más rápida de trabajar: escribes en palabras normales y Lumix crea actividades, temas de minuta, proyectos, errores o ingestas, aplica cambios y responde preguntas con los datos del equipo.',
    acciones: [
      {
        t: 'Elegir el tipo de mensaje',
        d: 'Botones sobre el campo: Auto (Lumix decide), Actividad, Error, Ingesta, Masivo, Minuta y Proyecto. También puedes escribir /error, /minuta, etc. al inicio del mensaje.',
      },
      {
        t: 'Crear una actividad',
        d: 'Escribe qué hay que hacer. Si nombras a alguien, se le asigna (si tienes permiso); si no, queda a tu nombre. Sin fecha, vence en 6 días hábiles; sin prioridad, queda en Media.',
      },
      {
        t: 'Ver lo que Lumix entenderá',
        d: 'Mientras escribes aparece "Lumix entenderá:" con la persona, la fecha y la prioridad detectadas. Si algo sale con borde punteado, es que no está seguro: revísalo antes de enviar.',
      },
      {
        t: 'Preguntar',
        d: 'Empieza con "?" o con qué, cómo, cuántas, quién, muéstrame… Ej.: "¿qué tengo pendiente esta semana?", "¿cómo vamos con los compromisos?". Con el campo vacío hay preguntas rápidas para tocar.',
      },
      {
        t: 'Cambiar algo respondiendo',
        d: 'Usa "Responder" sobre un mensaje y escribe el cambio: "cámbiale la fecha al viernes", "reasígnala a Pedro", "márcala completa", "bórrala". Un mensaje corto sin cita se aplica a la última actividad de la conversación.',
      },
      {
        t: 'Deshacer',
        d: 'Escribe "deshacer" para borrar lo último que creaste, si es tuyo, tiene menos de 30 minutos y nadie lo empezó.',
      },
      {
        t: 'Carga masiva',
        d: 'Con el tipo Masivo pega una lista (una actividad por línea). Lumix muestra cuántas detectó y las crea todas de una vez.',
      },
      {
        t: 'Actuar desde la tarjeta',
        d: 'Cada actividad creada aparece como tarjeta con Completar, Mover (Hoy, Mañana, +1 semana o una fecha), Reasignar y Responder. Siempre muestra el estado actual.',
      },
      {
        t: 'Lista editable',
        d: 'Al preguntar "qué tengo" o "las de Juan", Lumix responde con una lista que puedes editar: completar, mover fecha o reasignar varias a la vez.',
      },
      {
        t: 'Panel "Mi trabajo"',
        d: 'A la derecha (en computador): arriba "Esta conversación hoy" (lo creado, fechas movidas y lo que falta decidir) y abajo tus actividades, proyectos y minuta, vencidas / hoy / por vencer, para cerrarlas con un clic.',
      },
      {
        t: 'Filtrar la conversación',
        d: 'Todo, Solo trabajo (mensajes que crearon algo) o Por decidir (preguntas de Lumix sin responder).',
      },
    ],
    reglas: [
      'Si Lumix duda del tipo o de la persona, pregunta antes de crear ("¿a quién asigno?", "¿es una actividad o un error?").',
      'Si la persona ya tiene muchas actividades ese día (según el aviso de sobrecarga del equipo), la actividad se crea igual y Lumix ofrece moverla.',
      'Para borrar o convertir una actividad (en proyecto, error o ingesta) tiene que seguir Pendiente.',
      'Escribe "ayuda" en el chat para ver ejemplos.',
    ],
    permisos: [
      'Asignar a otra persona requiere el permiso "Asignar a terceros".',
      'Los tipos Minuta, Proyecto e Ingesta requieren el permiso de gestionar ese módulo.',
      'Sin "Editar actividades ajenas" solo puedes cambiar las tuyas.',
    ],
    consejos: [
      'Una frase completa basta: "Camila revisa la matriz de riesgos para el jueves, prioridad alta".',
      'Pega el acta de una reunión con viñetas en tipo Minuta y se crea un tema por viñeta.',
    ],
  },
  {
    id: 'actividades',
    titulo: 'Actividades',
    icon: 'list',
    color: 'blue',
    ruta: '/activities',
    capability: 'modulos.actividades',
    resumen:
      'La lista de trabajo: tus actividades y las de los equipos que lideras, ordenadas por urgencia. Aquí se filtra, se edita, se cambia de estado y se arman subtareas.',
    acciones: [
      {
        t: 'Avanzar con un clic',
        d: 'Cada fila tiene su acción: Iniciar (pendiente), Completar (en proceso) o Reanudar (bloqueada).',
      },
      {
        t: 'Abrir el detalle',
        d: 'Toca una fila para ver y editar estado, entrega, prioridad, horas estimadas, descripción y observaciones, con el historial de cuántas veces se movió la fecha.',
      },
      {
        t: 'Bloquear y desbloquear',
        d: 'Bloquear pide el motivo, lo guarda en observaciones y avisa a jefatura y al responsable.',
      },
      {
        t: 'Subtareas',
        d: '"Agregar subtarea" crea una actividad hija. Se ven agrupadas bajo su padre, con el nombre del nivel superior. Si la actividad viene de un proyecto, la subtarea se crea también en el proyecto.',
      },
      {
        t: 'Filtrar y buscar',
        d: 'Estado (Activas, Pendientes, En proceso, Bloqueadas, Completadas), Filtros (equipo, responsable, grupo, plazo, rango de fechas) y búsqueda por texto.',
      },
      {
        t: 'Agrupar',
        d: 'Por Urgencia (Vencidas, Hoy, Esta semana, Después, Sin fecha), por Persona, por Proyecto o sin agrupar.',
      },
      {
        t: 'Vistas guardadas',
        d: 'Atajos listos (Mis vencidas, Equipo esta semana, Bloqueadas) y "Guardar vista" para guardar tus filtros con un nombre.',
      },
      {
        t: 'Asignar',
        d: 'Crea una actividad para otra persona, con opción "También llevar a la minuta del equipo".',
      },
      {
        t: 'Delegar a mi equipo',
        d: 'Si lideras otro equipo, crea la misma tarea allá para que tu equipo la tome.',
      },
      { t: 'Exportar', d: 'Descarga la lista filtrada para abrirla en Excel.' },
    ],
    reglas: [
      'Al completar aparece "Deshacer" por unos segundos (no en subtareas: al cerrar la última hija se cierra también la actividad padre).',
      'Las subtareas de una actividad de proyecto exigen fecha de inicio y de término.',
      'Una actividad completada ya no se edita; usa "Reabrir" si hace falta.',
      'Eliminar no borra las actividades delegadas y desvincula el tema de minuta.',
    ],
    permisos: [
      'Puedes editar una actividad si eres el responsable, si lideras su equipo o si tienes "Editar actividades ajenas".',
      'Eliminar requiere el permiso "Eliminar actividades".',
      'Sin "Ver todas las del equipo" solo ves las tuyas.',
    ],
    consejos: [
      'Teclado: ↑ ↓ para recorrer, Enter para abrir, Esc para cerrar el panel.',
      'Si la fecha tiene un ícono al lado, es que se movió: pasa el mouse para ver cuántas veces.',
    ],
  },
  {
    id: 'minuta',
    titulo: 'Minuta',
    icon: 'clipboard',
    color: 'amber',
    ruta: '/minuta',
    capability: 'modulos.minuta',
    resumen:
      'Los temas de la reunión semanal. Se conversan, se les pone responsable y plazo, y al asignarlos se convierten en actividades que el equipo sigue como compromisos.',
    acciones: [
      {
        t: 'Nuevo tema',
        d: 'Crea el tema y abre su detalle para escribirlo. También se crean desde el chat con el tipo Minuta.',
      },
      {
        t: 'Editar en la tabla',
        d: 'Tema, responsable, estado y plazo se cambian directo en la fila. El comentario se edita haciendo clic sobre el texto.',
      },
      {
        t: 'Asignar actividad',
        d: 'Con responsable elegido, crea su actividad (entrega por defecto: 6 días hábiles), la vincula al tema y le avisa a la persona.',
      },
      {
        t: 'Subtareas',
        d: '"+ Subtarea" agrega pasos al tema, cada uno con su responsable, plazo y botón Asignar.',
      },
      {
        t: 'Vistas',
        d: 'Por asignar (lo que falta decidir), Asignados, Resueltos y Todos. Además, "Por semana" muestra lo que tuvo movimiento en una semana.',
      },
      {
        t: 'Empezar reunión',
        d: 'Modo reunión a pantalla completa: recorre los temas por asignar uno por uno con teclas — A asignar, C ya lo conversamos, P dejar para la próxima, ← → navegar. Al final muestra el resumen.',
      },
      {
        t: 'Cronograma',
        d: 'En el detalle de un tema con subtareas, "Ver cronograma" muestra sus plazos en el tiempo (día, semana o mes).',
      },
      {
        t: 'Carga masiva y exportar',
        d: 'Descarga la plantilla CSV, complétala y súbela: Lumix muestra una revisión antes de importar y marca los repetidos.',
      },
    ],
    reglas: [
      'Si el tema tiene actividades, su estado lo deciden ellas: todas completadas = Resuelto; alguna en curso = En desarrollo.',
      'Cambiar el plazo del tema mueve la entrega de sus actividades abiertas, y queda registrado cuántas veces se movió.',
      '"Definir en reunión" marca un tema que hay que conversar: vuelve a Por asignar aunque ya tenga actividad.',
      'Elegir responsable no saca el tema de Por asignar: sale al pulsar "Asignar actividad".',
    ],
    permisos: [
      'Crear y editar temas: "Gestionar minuta". Asignar: "Asignar actividades desde minuta". Eliminar: "Eliminar temas".',
    ],
    consejos: [
      'Proyecta el Modo reunión: avanza con el teclado y nadie pierde el hilo.',
      'Usa el filtro por grupo de trabajo para revisar la minuta por área.',
    ],
  },
  {
    id: 'proyectos',
    titulo: 'Proyectos',
    icon: 'folder',
    color: 'violet',
    ruta: '/proyectos',
    capability: 'modulos.proyectos',
    resumen:
      'Iniciativas más largas que un tema de reunión: un proyecto agrupa actividades y subtareas en los niveles que haga falta, con avance, alertas y cronograma.',
    acciones: [
      {
        t: 'Ver todos los proyectos',
        d: 'Estado (En curso, Atrasado, Completado, Sin actividades), avance, cantidad de actividades, alertas y una mini línea de tiempo comparable entre proyectos.',
      },
      {
        t: 'Nuevo proyecto',
        d: 'Solo pide el nombre y abre el detalle. También desde el chat: "crea un proyecto…".',
      },
      {
        t: 'Tres vistas del detalle',
        d: 'Lista (árbol por niveles), Tablero (columnas por estado, se arrastra lo que no tiene actividad) y Cronograma (barras de inicio a término).',
      },
      {
        t: 'Editar un ítem',
        d: 'Panel con estado, prioridad, responsables (varios), inicio, término, comentarios y subtareas sin límite de niveles.',
      },
      {
        t: 'Asignar actividad',
        d: 'Convierte el ítem en una actividad para su responsable. Exige fecha de inicio y de término.',
      },
      {
        t: 'Discutir en reunión',
        d: 'Lleva el ítem a la Minuta como tema "Definir en reunión", sin sacarlo del proyecto.',
      },
    ],
    reglas: [
      'Avance = subtareas resueltas / subtareas totales.',
      'Alertas: vencidas, vencen hoy, por vencer (3 días) y bloqueadas.',
      'Las actividades que salen de un proyecto cuentan como compromisos.',
      'Eliminar un ítem borra también todas sus subtareas.',
    ],
    permisos: [
      'Crear y editar: "Gestionar proyectos". Asignar: "Asignar actividades desde proyectos". Eliminar: "Eliminar proyectos y subtareas".',
    ],
  },
  {
    id: 'compromisos',
    titulo: 'Compromisos',
    icon: 'checkCircle',
    color: 'green',
    ruta: '/compromisos',
    capability: 'modulos.compromisos',
    resumen:
      'La revisión semanal: lo que cada persona se comprometió a entregar esta semana, marcado hecho / no hecho, contra la meta de 90% (modelo EOS).',
    acciones: [
      {
        t: 'Marcar hecho',
        d: 'Un clic en la casilla del compromiso. El % de la semana se actualiza al momento.',
      },
      { t: 'Cambiar de semana', d: 'Con ‹ › o "Esta semana".' },
      {
        t: '+1 semana',
        d: 'Corre la entrega 7 días y actualiza el plazo del tema de origen.',
      },
      {
        t: 'A la minuta',
        d: 'Lleva el compromiso a la Minuta para conversarlo. Se destaca cuando lleva 3 semanas o más abierto.',
      },
      { t: 'Comentario', d: 'Ver y editar el comentario del tema que originó el compromiso.' },
      {
        t: 'Cerrar semana',
        d: 'Muestra el % final y qué hacer con lo abierto: mover todo una semana, llevar todo a la minuta o dejarlo.',
      },
      {
        t: 'Vencidos sin cerrar',
        d: 'Lo vencido y abierto de cualquier semana anterior, para que nada se pierda al cambiar de semana.',
      },
      {
        t: 'Por persona o por grupo',
        d: 'Si el equipo tiene grupos de trabajo, se puede ver agrupado por grupo.',
      },
    ],
    reglas: [
      'Un compromiso es una actividad que nació de la Minuta o de un Proyecto y vence en la semana. Lo creado como actividad propia en el chat no cuenta.',
      'Verde desde 90%, ámbar desde 60%, rojo bajo eso.',
      'Nada debería quedar más de dos semanas dando vueltas: se cumple, se mueve o se conversa.',
    ],
    permisos: [
      'Mover, llevar a la minuta, comentar y cerrar semana: "Conducir la revisión".',
      'Sin "Ver todas las del equipo" solo ves tus compromisos.',
    ],
  },
  {
    id: 'errores',
    titulo: 'Errores',
    icon: 'bug',
    color: 'red',
    ruta: '/errors',
    capability: 'modulos.errores',
    resumen:
      'La bitácora de errores: transacciones o queries con problemas, su severidad y su estado hasta el cierre.',
    acciones: [
      {
        t: 'Nuevo error',
        d: 'Lo registra en la bitácora. También desde el chat con el tipo Error.',
      },
      { t: 'Cambiar estado', d: 'En proceso, Resuelto o Cerrado, directo en la fila.' },
      { t: 'Editar en la fila', d: 'Título y comentario se editan sin abrir nada.' },
      {
        t: 'Filtrar',
        d: 'Por estado (Activos, En proceso, Resueltos, Cerrados…), por fecha de reporte o de cierre, y por texto.',
      },
      { t: 'Exportar', d: 'Descarga la bitácora para Excel.' },
    ],
    reglas: [
      'La franja de color a la izquierda indica severidad: roja = alta o crítica, ámbar = media.',
      '"Abierto hace" se pinta ámbar desde 14 días.',
      'La fecha de cierre se pone sola al cerrar y se borra si el error se reabre.',
      'Reabrir un error avisa a todo el equipo.',
    ],
    permisos: ['Crear, editar y cambiar estado: "Gestionar errores".'],
  },
  {
    id: 'ingestas',
    titulo: 'Ingestas',
    icon: 'database',
    color: 'pink',
    ruta: '/ingestas',
    capability: 'modulos.ingestas',
    resumen:
      'Registro de solicitudes hechas a otros equipos (por ejemplo, cargas de datos) y su seguimiento hasta que se resuelven.',
    acciones: [
      {
        t: 'Nueva solicitud',
        d: 'Con responsable en texto libre ("Nombre y equipo"), porque suele ser alguien de fuera.',
      },
      {
        t: 'Seguir el estado',
        d: 'No iniciado, En proceso, Completado, No resuelto o Cancelado. Las tres últimas pasan a Resueltas pero no se borran.',
      },
      {
        t: 'Vistas y filtros',
        d: 'Activas, Resueltas, Todas; por responsable, grupo, fecha y texto.',
      },
      { t: 'Carga masiva y exportar', d: 'Igual que en la Minuta, con plantilla CSV.' },
    ],
    permisos: [
      'Crear, editar y eliminar: "Gestionar ingestas". Asignar actividades: "Asignar actividades desde ingestas".',
    ],
  },
  {
    id: 'planificacion',
    titulo: 'Planificación',
    icon: 'calendar',
    color: 'orange',
    ruta: '/gantt',
    capability: 'modulos.planificacion',
    resumen:
      'Mapa de calor de horas por persona y día de la semana, para ver quién está saturado y repartir mejor las entregas.',
    acciones: [
      {
        t: 'Leer la carga',
        d: 'Cada celda suma las horas de lo que vence ese día; la columna Semana muestra el total y el % de la capacidad (42 h).',
      },
      {
        t: 'Ver las actividades',
        d: 'Toca una celda para ver las actividades de esa persona en la semana.',
      },
      { t: 'Mover una entrega', d: 'Arrastra una actividad a otro día para cambiarle la fecha.' },
      {
        t: 'Editar',
        d: 'Al hacer clic en una actividad: prioridad, entrega, horas estimadas y descripción.',
      },
      { t: 'Cambiar de semana', d: 'Semana anterior, siguiente u Hoy.' },
    ],
    reglas: [
      'Si una actividad no tiene horas estimadas, cuenta como 3 h.',
      'Carga semanal: Normal bajo 70%, Advertencia desde 70%, Saturado desde 90%, Crítico sobre 100%.',
    ],
    consejos: ['Estima las horas de tus actividades: el mapa se vuelve mucho más real.'],
  },
  {
    id: 'dashboard',
    titulo: 'Dashboard',
    icon: 'chart',
    ruta: '/dashboard',
    capability: 'modulos.dashboard',
    resumen:
      'El resumen del equipo: cuatro indicadores con su tendencia, rendimiento y compromisos semana a semana, carga por persona, proyectos y listas de lo urgente.',
    acciones: [
      {
        t: 'Indicadores',
        d: 'Pendientes, Vencidas, Completadas y Compromisos (% contra la meta de 90%). Cada uno compara con el periodo anterior: verde si mejoró, rojo si empeoró.',
      },
      {
        t: 'Periodo',
        d: 'Semana, 4 semanas o Trimestre: cambia los indicadores y cuántas semanas muestran los gráficos.',
      },
      {
        t: 'Gráficos',
        d: 'Completadas vs creadas y % de compromisos por semana. Pasa el mouse para ver el detalle.',
      },
      {
        t: 'Carga por persona',
        d: 'Horas abiertas en proceso, pendientes y detenidas contra las 42 h.',
      },
      {
        t: 'Listas que llevan a la acción',
        d: 'Proyectos, Atrasado, Vence pronto y Errores: cada fila abre lo que muestra.',
      },
      { t: 'Exportar', d: 'Descarga los números a un CSV para Excel.' },
    ],
    permisos: ['Un colaborador ve solo sus propios números.'],
  },
  {
    id: 'notificaciones',
    titulo: 'Notificaciones',
    icon: 'bell',
    ruta: '/notifications',
    resumen:
      'Avisos de lo que te involucra. El número rojo en el menú indica cuántas no has leído.',
    acciones: [
      {
        t: 'Qué llega',
        d: 'Te asignaron, delegaron o reasignaron una actividad; nueva actividad desde la Minuta o un Proyecto; una actividad se bloqueó; un error se reabrió.',
      },
      {
        t: 'Ir al detalle',
        d: 'Abrir actividad, Ver errores o Ver minuta. Al abrirla queda leída.',
      },
      { t: 'Marcar leídas', d: 'Una por una o "Marcar todas leídas".' },
    ],
    reglas: [
      'Se actualizan al cambiar de página.',
      'No recibes aviso de lo que tú mismo te asignas.',
    ],
  },
  {
    id: 'equipos',
    titulo: 'Equipos',
    icon: 'users',
    ruta: '/teams',
    resumen: 'Tus equipos, sus miembros, roles, grupos de trabajo y permisos.',
    acciones: [
      {
        t: 'Cambiar de equipo',
        d: 'Desde el selector arriba del menú lateral. Todo Lumix pasa a mostrar ese equipo.',
      },
      {
        t: 'Invitar',
        d: 'Por email. La persona debe estar registrada en Lumix; entra como Colaborador.',
      },
      {
        t: 'Roles y grupos',
        d: 'Cambiar el rol (Jefatura, Colaborador, Invitado) o el grupo de trabajo de cada persona.',
      },
      {
        t: 'Permisos',
        d: 'Matriz de personas por permisos: dar o quitar permisos puntuales además de los del rol.',
      },
      {
        t: 'Grupos de trabajo',
        d: 'Crear grupos (ej.: Excelencia) para filtrar Minuta, Ingestas y Compromisos por área.',
      },
      {
        t: 'Aviso de sobrecarga',
        d: 'Desde cuántas actividades el mismo día Lumix avisa al asignar (por defecto, 2).',
      },
    ],
    permisos: [
      'Roles, grupos y permisos: Admin o Jefatura del equipo.',
      'Invitar y quitar miembros: también quien tenga "Agregar/quitar miembros".',
      'Nadie puede cambiar su propio rol.',
    ],
  },
  {
    id: 'perfil',
    titulo: 'Perfil y apariencia',
    icon: 'user',
    ruta: '/profile',
    resumen: 'Tus datos, tu contraseña y cómo se ve Lumix en este dispositivo.',
    acciones: [
      { t: 'Avatar', d: 'Tus iniciales con un color propio o un emoji.' },
      {
        t: 'Nombre y contraseña',
        d: 'Cambiar el nombre completo o la contraseña (mínimo 6 caracteres).',
      },
      {
        t: 'Tema',
        d: 'Claro, Oscuro o Sistema (sigue al de tu computador o celular). También con Ctrl K → Apariencia.',
      },
      { t: 'Color de acento', d: 'Petróleo, Índigo o Azul.' },
      { t: 'Novedades', d: '"Ver novedades" muestra los cambios de la última versión.' },
    ],
  },
  {
    id: 'admin',
    titulo: 'Administración',
    icon: 'shield',
    ruta: '/admin',
    soloAdmin: true,
    resumen: 'Solo para administradores: crear usuarios y equipos.',
    acciones: [
      {
        t: 'Crear usuario',
        d: 'Nombre, email, rol y equipo. Lumix entrega una clave temporal que la persona debe cambiar al entrar.',
      },
      { t: 'Equipos', d: 'Crear equipos y gestionar sus miembros y roles.' },
      {
        t: 'Precisión de la IA',
        d: 'En el Dashboard, cuántas clasificaciones de Lumix tuvieron que corregirse.',
      },
    ],
  },
]

/** Lo que trae cada rol por defecto. Los permisos se pueden ajustar por persona en Equipos. */
export const ROLES: { rol: string; texto: string }[] = [
  { rol: 'Admin', texto: 'Todo, en todos los equipos. Crea usuarios y equipos.' },
  {
    rol: 'Jefatura',
    texto:
      'Todos los permisos de su equipo: gestiona módulos, asigna, edita y configura el equipo.',
  },
  {
    rol: 'Colaborador',
    texto: 'Ve los módulos y trabaja lo suyo: crea sus actividades, las avanza y las cierra.',
  },
  {
    rol: 'Invitado',
    texto: 'Ve todas las actividades del equipo y gestiona errores e ingestas.',
  },
]

export const ATAJOS: { teclas: string[]; texto: string }[] = [
  { teclas: ['Ctrl', 'K'], texto: 'Buscar, crear o ir a cualquier hoja (en Mac, ⌘ K)' },
  { teclas: ['Enter'], texto: 'Enviar en el chat' },
  { teclas: ['Shift', 'Enter'], texto: 'Nueva línea en el chat' },
  { teclas: ['/'], texto: 'Comandos de tipo en el chat (/error, /minuta…)' },
  { teclas: ['↑', '↓'], texto: 'Recorrer la lista de Actividades' },
  { teclas: ['Esc'], texto: 'Cerrar el panel o la ventana de arriba' },
  {
    teclas: ['A', 'C', 'P'],
    texto: 'Modo reunión: asignar, ya lo conversamos, dejar para la próxima',
  },
  { teclas: ['←', '→'], texto: 'Modo reunión: tema anterior / siguiente' },
]

export const ESTADOS: { estado: string; texto: string; tono: TagColor | 'neutral' }[] = [
  { estado: 'Pendiente', texto: 'Aún no empieza.', tono: 'neutral' },
  { estado: 'En proceso', texto: 'Alguien la está trabajando.', tono: 'blue' },
  {
    estado: 'Bloqueado',
    texto: 'No puede avanzar; el motivo queda en observaciones.',
    tono: 'violet',
  },
  { estado: 'Falta información', texto: 'Espera datos de alguien.', tono: 'amber' },
  { estado: 'Esperando aprobación', texto: 'Lista, falta el visto bueno.', tono: 'amber' },
  { estado: 'Completado', texto: 'Terminada. Se registra la fecha de cierre.', tono: 'green' },
  { estado: 'Vencida', texto: 'Pasó su fecha de entrega sin completarse.', tono: 'red' },
  { estado: 'Definir en reunión', texto: 'Tema de minuta que hay que conversar.', tono: 'orange' },
]
