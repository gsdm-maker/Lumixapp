// Catalogo de acciones del agente del chat: lo que la IA puede pedir que Lumix haga.
//
// La IA NO toca la base: elige una (o varias) de estas acciones con sus datos, y Lumix la
// ejecuta con los permisos de quien escribe. Las referencias (ref) son ids del CONTEXTO que se
// le pasa en cada mensaje (actividades, temas, proyectos, compromisos, errores visibles).
//
// Este archivo es la propuesta que se mide en el banco de pruebas; el ganador pasa tal cual a
// la Edge Function.

const fecha = { type: 'string', description: 'Fecha YYYY-MM-DD, calculada desde HOY del contexto' }
const persona = { type: 'string', description: 'Nombre EXACTO de la lista de miembros del contexto' }
const ref = (que) => ({ type: 'string', description: `id de ${que} tomado del contexto` })
const prioridad = { type: 'integer', enum: [1, 2, 3], description: '1 alta/urgente, 2 media, 3 baja' }

function accion(name, description, properties, required = []) {
  return {
    type: 'function',
    function: {
      name,
      description,
      parameters: { type: 'object', properties, required, additionalProperties: false },
    },
  }
}

export const CATALOGO = [
  // --- Actividades ---------------------------------------------------------------------
  accion(
    'crear_actividad',
    'Crea una actividad nueva (tarea). Usala para trabajo concreto que alguien debe hacer.',
    {
      titulo: { type: 'string' },
      descripcion: { type: 'string' },
      responsable: persona,
      fecha_entrega: fecha,
      prioridad,
    },
    ['titulo'],
  ),
  accion(
    'crear_subtarea',
    'Crea una subtarea bajo una actividad existente.',
    {
      actividad: ref('la actividad padre'),
      titulo: { type: 'string' },
      responsable: persona,
      fecha_inicio: fecha,
      fecha_entrega: fecha,
    },
    ['actividad', 'titulo'],
  ),
  accion(
    'actualizar_actividad',
    'Cambia una actividad existente: estado, fecha, responsable, prioridad, texto, horas u observacion. Para completarla usa estado "completado".',
    {
      actividad: ref('la actividad'),
      estado: {
        type: 'string',
        enum: ['pendiente', 'en_proceso', 'bloqueado', 'falta_informacion', 'esperando_aprobacion', 'completado'],
      },
      fecha_entrega: fecha,
      responsable: persona,
      prioridad,
      titulo: { type: 'string' },
      descripcion: { type: 'string' },
      horas_estimadas: { type: 'number' },
      observacion: { type: 'string', description: 'Nota que se agrega (ej. motivo del bloqueo)' },
    },
    ['actividad'],
  ),
  accion('eliminar_actividad', 'Elimina una actividad. Solo si lo piden explicitamente.', {
    actividad: ref('la actividad'),
  }, ['actividad']),
  accion(
    'listar_actividades',
    'Muestra una lista de actividades para revisar o editar.',
    {
      responsable: { ...persona, description: 'Nombre exacto, o "yo" para quien escribe' },
      plazo: { type: 'string', enum: ['vencidas', 'hoy', 'semana', 'todas'] },
      estado: { type: 'string', enum: ['activas', 'pendiente', 'en_proceso', 'bloqueado', 'completado'] },
    },
  ),

  // --- Minuta --------------------------------------------------------------------------
  accion(
    'crear_tema_minuta',
    'Crea un tema para la minuta de la reunion semanal.',
    { tema: { type: 'string' }, responsable: persona, plazo: fecha, comentario: { type: 'string' } },
    ['tema'],
  ),
  accion(
    'actualizar_tema_minuta',
    'Cambia un tema de minuta: estado, plazo, responsable o comentario.',
    {
      tema: ref('el tema de minuta'),
      estado: { type: 'string', enum: ['pendiente', 'en_desarrollo', 'resuelto', 'definir'] },
      plazo: fecha,
      responsable: persona,
      comentario: { type: 'string' },
    },
    ['tema'],
  ),
  accion(
    'asignar_tema_minuta',
    'Convierte un tema de minuta en actividad para su responsable (o el indicado).',
    { tema: ref('el tema de minuta'), responsable: persona, fecha_entrega: fecha, prioridad },
    ['tema'],
  ),
  accion('marcar_conversado', 'Marca un tema de minuta como ya conversado en la reunion.', {
    tema: ref('el tema de minuta'),
  }, ['tema']),

  // --- Proyectos -----------------------------------------------------------------------
  accion(
    'crear_proyecto',
    'Crea un proyecto (iniciativa con varias partes). Puede traer sus primeras subtareas.',
    { nombre: { type: 'string' }, subtareas: { type: 'array', items: { type: 'string' } } },
    ['nombre'],
  ),
  accion(
    'agregar_subtarea_proyecto',
    'Agrega un item/subtarea a un proyecto, opcionalmente bajo otro item.',
    {
      proyecto: ref('el proyecto'),
      padre: ref('el item padre dentro del proyecto (opcional)'),
      titulo: { type: 'string' },
      responsables: { type: 'array', items: persona },
      fecha_inicio: fecha,
      fecha_termino: fecha,
    },
    ['proyecto', 'titulo'],
  ),
  accion(
    'asignar_item_proyecto',
    'Convierte un item de proyecto en actividad. Requiere inicio y termino; si faltan, pide aclaracion.',
    { item: ref('el item del proyecto'), responsable: persona, fecha_inicio: fecha, fecha_termino: fecha },
    ['item', 'fecha_inicio', 'fecha_termino'],
  ),
  accion(
    'actualizar_item_proyecto',
    'Cambia un item de proyecto: estado, fechas, responsables, prioridad o comentario.',
    {
      item: ref('el item del proyecto'),
      estado: { type: 'string', enum: ['pendiente', 'en_desarrollo', 'resuelto', 'definir'] },
      fecha_inicio: fecha,
      fecha_termino: fecha,
      responsables: { type: 'array', items: persona },
      prioridad,
      comentario: { type: 'string' },
    },
    ['item'],
  ),
  accion('consultar_proyecto', 'Muestra avance, alertas y estructura de un proyecto.', {
    proyecto: ref('el proyecto'),
  }, ['proyecto']),

  // --- Compromisos ---------------------------------------------------------------------
  accion(
    'consultar_compromisos',
    'Muestra los compromisos de la semana (y su %) o los vencidos sin cerrar.',
    {
      semana: { type: 'string', enum: ['actual', 'anterior', 'siguiente'] },
      solo_vencidos: { type: 'boolean' },
      responsable: persona,
    },
  ),
  accion('marcar_compromiso', 'Marca un compromiso como hecho o no hecho.', {
    compromiso: ref('el compromiso'),
    hecho: { type: 'boolean' },
  }, ['compromiso', 'hecho']),
  accion('mover_compromiso', 'Mueve un compromiso no cumplido una semana.', {
    compromiso: ref('el compromiso'),
  }, ['compromiso']),
  accion('llevar_a_minuta', 'Lleva un compromiso o item de proyecto a la minuta para conversarlo.', {
    ref: ref('el compromiso o item'),
  }, ['ref']),
  accion(
    'cerrar_semana',
    'Cierra la semana de compromisos y decide que hacer con lo no cumplido.',
    { pendientes: { type: 'string', enum: ['mover', 'minuta', 'dejar'] } },
    ['pendientes'],
  ),

  // --- Errores e ingestas --------------------------------------------------------------
  accion(
    'registrar_error',
    'Registra un error (algo que YA esta fallando) en la bitacora.',
    {
      titulo: { type: 'string' },
      descripcion: { type: 'string' },
      severidad: { type: 'string', enum: ['baja', 'media', 'alta', 'critica'] },
    },
    ['titulo'],
  ),
  accion(
    'actualizar_error',
    'Cambia un error: estado, severidad o comentario.',
    {
      error: ref('el error'),
      estado: { type: 'string', enum: ['en_revision', 'resuelto', 'cerrado'] },
      severidad: { type: 'string', enum: ['baja', 'media', 'alta', 'critica'] },
      comentario: { type: 'string' },
    },
    ['error'],
  ),
  accion(
    'crear_ingesta',
    'Registra una solicitud de ingesta de datos a otro equipo (carga a tabla, BI, SAP...).',
    { solicitud: { type: 'string' }, responsable_texto: { type: 'string' }, fecha_compromiso: fecha },
    ['solicitud'],
  ),
  accion(
    'actualizar_ingesta',
    'Cambia una ingesta: estado, fecha de compromiso o comentario.',
    {
      ingesta: ref('la ingesta'),
      estado: { type: 'string', enum: ['no_iniciado', 'en_proceso', 'completado', 'no_resuelto', 'cancelado'] },
      fecha_compromiso: fecha,
      comentario: { type: 'string' },
    },
    ['ingesta'],
  ),

  // --- Consultas generales -------------------------------------------------------------
  accion('consultar_carga', 'Horas y actividades por persona en un dia o semana (quien esta libre o saturado).', {
    fecha,
    responsable: persona,
  }),
  accion('consultar_resumen', 'Resumen del equipo como el Dashboard: pendientes, vencidas, completadas, compromisos.', {
    periodo: { type: 'string', enum: ['semana', 'mes', 'trimestre'] },
  }),
  accion('consultar_notificaciones', 'Muestra las notificaciones no leidas, o las marca leidas.', {
    marcar_leidas: { type: 'boolean' },
  }),

  // --- Conversacion --------------------------------------------------------------------
  accion(
    'pedir_aclaracion',
    'Usala cuando falta un dato imprescindible o la orden es ambigua (ej. varias coincidencias). No adivines.',
    { pregunta: { type: 'string' }, opciones: { type: 'array', items: { type: 'string' } } },
    ['pregunta'],
  ),
]

export const SISTEMA = `Eres Lumix, el asistente de trabajo de un equipo. Conviertes lo que la persona escribe
en acciones del catalogo (herramientas). Reglas:
- Responde SOLO llamando herramientas. Si la orden pide varias cosas, llama varias.
- Las referencias (actividad, tema, proyecto, item, compromiso, error, ingesta) son ids del CONTEXTO. Nunca inventes ids.
- "esa", "la ultima", "lo anterior" se refieren al ultimo item mencionado del contexto (ultimo_mencionado).
- Fechas: calculalas desde HOY. "el viernes" = el proximo viernes (o hoy si hoy es viernes). "mañana", "en 3 dias", "la proxima semana" (= lunes siguiente).
- Personas: usa el nombre EXACTO de la lista de miembros. "yo"/"me"/"mio" = quien escribe. Si un nombre calza con varias personas, pide aclaracion.
- Crear vs cambiar: si la orden habla de algo que ya existe en el contexto, actualizalo; no crees uno nuevo.
- Error = algo que YA falla. Pedir revisar/arreglar algo es una actividad.
- Proyecto: iniciativa con varias partes. Tema de minuta: algo para conversar en la reunion semanal.
- Asignar un item de proyecto exige fecha de inicio y de termino: si faltan, pide aclaracion.
- Preguntas sobre el estado del trabajo se responden con las herramientas consultar_* o listar_actividades.
- Si falta algo imprescindible o hay ambiguedad real, usa pedir_aclaracion en vez de adivinar.`
