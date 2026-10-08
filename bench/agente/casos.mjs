// Casos de prueba del agente del chat: lo que la gente escribe de verdad, con lo que deberia
// pasar. Datos inventados (equipo de ejemplo), nada de la base real.
//
// HOY = miercoles 2026-10-07 -> manana 08, viernes 09, lunes proximo 12, jueves 08.

export const CONTEXTO = {
  hoy: '2026-10-07 (miercoles)',
  quien_escribe: { nombre: 'Sebastián Díaz', rol: 'jefatura' },
  miembros: ['Sebastián Díaz', 'Camila Rojas', 'Tomás Valdés', 'Juan Soto', 'Juan Pérez', 'Diego Paredes'],
  actividades: [
    { id: 'a1', titulo: 'Revisar cierre de ventas', responsable: 'Tomás Valdés', entrega: '2026-10-09', estado: 'en_proceso' },
    { id: 'a2', titulo: 'Migrar dashboard de calidad', responsable: 'Tomás Valdés', entrega: '2026-09-22', estado: 'pendiente' },
    { id: 'a3', titulo: 'Actualizar matriz de riesgos', responsable: 'Juan Soto', entrega: '2026-10-07', estado: 'pendiente' },
    { id: 'a4', titulo: 'Capacitación Power BI', responsable: 'Camila Rojas', entrega: '2026-10-09', estado: 'pendiente' },
    { id: 'a5', titulo: 'Conciliar ventas SAP', responsable: 'Diego Paredes', entrega: '2026-10-04', estado: 'bloqueado' },
  ],
  temas_minuta: [
    { id: 'm1', tema: 'Revisar capacidad de congelado', responsable: null, estado: 'pendiente' },
    { id: 'm2', tema: 'Definir proveedor de transporte', responsable: 'Camila Rojas', estado: 'definir' },
  ],
  proyectos: [
    {
      id: 'p1',
      nombre: 'Gobernar in full',
      items: [
        { id: 'i1', titulo: 'Levantar procesos', padre: null },
        { id: 'i2', titulo: 'Revisar quién cargará el pedido', padre: 'i1' },
      ],
    },
    { id: 'p2', nombre: 'Migración a Fabric', items: [{ id: 'i3', titulo: 'Inventario de reportes', padre: null }] },
  ],
  compromisos_semana: [
    { id: 'a3', titulo: 'Actualizar matriz de riesgos', responsable: 'Juan Soto', hecho: false },
    { id: 'a4', titulo: 'Capacitación Power BI', responsable: 'Camila Rojas', hecho: false },
    { id: 'a1', titulo: 'Revisar cierre de ventas', responsable: 'Tomás Valdés', hecho: false },
  ],
  errores: [{ id: 'e1', titulo: 'Tablero de producción no carga', estado: 'en_revision', severidad: 'alta' }],
  ingestas: [{ id: 'g1', solicitud: 'Carga maestro de clientes al DW', estado: 'en_proceso' }],
  ultimo_mencionado: 'a1',
}

// Comprobadores de argumentos.
const igual = (v) => (x) => x === v
const contiene = (...partes) => (x) =>
  typeof x === 'string' && partes.every((p) => x.toLowerCase().includes(p.toLowerCase()))
const existe = (x) => x !== undefined && x !== null && x !== ''
const lista = (...v) => (x) => Array.isArray(x) && v.every((e) => x.includes(e))
const largo = (n) => (x) => Array.isArray(x) && x.length >= n

/**
 * espera: llamadas que deben aparecer (nombre + argumentos a comprobar). El caso pasa si estan
 * todas y no hay acciones de escritura de mas. `o`: alternativas validas (cualquiera sirve).
 */
export const CASOS = [
  // --- Actividades: crear ---
  { id: 'act-crear-simple', grupo: 'Actividades', msg: 'Camila revisa la matriz de riesgos para el jueves, prioridad alta',
    espera: [{ tool: 'crear_actividad', args: { responsable: igual('Camila Rojas'), fecha_entrega: igual('2026-10-08'), prioridad: igual(1) } }],
    // Ya existe "Actualizar matriz de riesgos" (Juan Soto): reasignarla o preguntar tambien vale.
    o: [
      [{ tool: 'actualizar_actividad', args: { actividad: igual('a3'), responsable: igual('Camila Rojas') } }],
      [{ tool: 'pedir_aclaracion', args: { pregunta: existe } }],
    ] },
  { id: 'act-crear-propia', grupo: 'Actividades', msg: 'tengo que preparar la presentación del comité para mañana',
    espera: [{ tool: 'crear_actividad', args: { fecha_entrega: igual('2026-10-08'), titulo: contiene('presentación') } }] },
  { id: 'act-crear-coloquial', grupo: 'Actividades', msg: 'pasale a tomás lo de coordinar el camión de congelado pal lunes',
    espera: [{ tool: 'crear_actividad', args: { responsable: igual('Tomás Valdés'), fecha_entrega: igual('2026-10-12') } }] },
  { id: 'act-crear-varias', grupo: 'Actividades', msg: 'crea dos tareas: Diego revisa el reporte de mermas y Juan Soto actualiza el forecast, ambas para el viernes',
    espera: [
      { tool: 'crear_actividad', args: { responsable: igual('Diego Paredes'), fecha_entrega: igual('2026-10-09') } },
      { tool: 'crear_actividad', args: { responsable: igual('Juan Soto'), fecha_entrega: igual('2026-10-09') } },
    ] },
  { id: 'act-ambiguo-juan', grupo: 'Actividades', msg: 'Juan revisa los costos de flete para el viernes',
    espera: [{ tool: 'pedir_aclaracion', args: { pregunta: existe } }] },

  // --- Actividades: cambiar ---
  { id: 'act-mover', grupo: 'Actividades', msg: 'mueve lo del cierre de ventas al lunes',
    espera: [{ tool: 'actualizar_actividad', args: { actividad: igual('a1'), fecha_entrega: igual('2026-10-12') } }] },
  { id: 'act-completar-esa', grupo: 'Actividades', msg: 'listo, esa ya está',
    espera: [{ tool: 'actualizar_actividad', args: { actividad: igual('a1'), estado: igual('completado') } }] },
  { id: 'act-reasignar', grupo: 'Actividades', msg: 'la capacitación de power bi que la haga Diego',
    espera: [{ tool: 'actualizar_actividad', args: { actividad: igual('a4'), responsable: igual('Diego Paredes') } }] },
  { id: 'act-bloquear', grupo: 'Actividades', msg: 'la matriz de riesgos está bloqueada, falta que finanzas mande los datos',
    espera: [{ tool: 'actualizar_actividad', args: { actividad: igual('a3'), estado: (x) => x === 'bloqueado' || x === 'falta_informacion' } }] },
  { id: 'act-horas', grupo: 'Actividades', msg: 'a la migración del dashboard de calidad ponle 8 horas',
    espera: [{ tool: 'actualizar_actividad', args: { actividad: igual('a2'), horas_estimadas: igual(8) } }] },
  { id: 'act-subtarea', grupo: 'Actividades', msg: 'agrégale una subtarea al cierre de ventas: validar notas de crédito, para Camila el jueves',
    espera: [{ tool: 'crear_subtarea', args: { actividad: igual('a1'), responsable: igual('Camila Rojas'), fecha_entrega: igual('2026-10-08') } }] },
  { id: 'act-eliminar', grupo: 'Actividades', msg: 'borra la de conciliar ventas SAP, ya no va',
    espera: [{ tool: 'eliminar_actividad', args: { actividad: igual('a5') } }] },
  { id: 'act-reabrir', grupo: 'Actividades', msg: 'desbloquea lo de conciliar ventas sap, ya llegaron los accesos',
    espera: [{ tool: 'actualizar_actividad', args: { actividad: igual('a5'), estado: (x) => x === 'en_proceso' || x === 'pendiente' } }] },

  // --- Actividades: listar ---
  { id: 'act-lista-mias', grupo: 'Listas', msg: '¿qué tengo pendiente esta semana?',
    espera: [{ tool: 'listar_actividades', args: { responsable: (x) => x === 'yo' || x === 'Sebastián Díaz' } }] },
  { id: 'act-lista-vencidas', grupo: 'Listas', msg: 'muéstrame todo lo vencido del equipo',
    espera: [{ tool: 'listar_actividades', args: { plazo: igual('vencidas') } }] },
  { id: 'act-lista-persona', grupo: 'Listas', msg: 'qué tiene tomás',
    espera: [{ tool: 'listar_actividades', args: { responsable: igual('Tomás Valdés') } }] },

  // --- Minuta ---
  { id: 'min-crear', grupo: 'Minuta', msg: 'para la minuta: revisar el contrato de arriendo de bodegas, responsable Diego',
    espera: [{ tool: 'crear_tema_minuta', args: { responsable: igual('Diego Paredes'), tema: contiene('arriendo') } }] },
  { id: 'min-asignar', grupo: 'Minuta', msg: 'asígnale a Juan Soto el tema de capacidad de congelado, para el viernes',
    espera: [{ tool: 'asignar_tema_minuta', args: { tema: igual('m1'), responsable: igual('Juan Soto'), fecha_entrega: igual('2026-10-09') } }],
    o: [[
      { tool: 'actualizar_tema_minuta', args: { tema: igual('m1'), responsable: igual('Juan Soto') } },
      { tool: 'asignar_tema_minuta', args: { tema: igual('m1') } },
    ]] },
  { id: 'min-conversado', grupo: 'Minuta', msg: 'lo del proveedor de transporte ya lo conversamos',
    espera: [{ tool: 'marcar_conversado', args: { tema: igual('m2') } }] },
  { id: 'min-comentario', grupo: 'Minuta', msg: 'en el tema de congelado anota que la planta pide 20% más de capacidad',
    espera: [{ tool: 'actualizar_tema_minuta', args: { tema: igual('m1'), comentario: contiene('20%') } }] },
  { id: 'min-plazo', grupo: 'Minuta', msg: 'el tema del proveedor de transporte muévelo a la próxima semana',
    espera: [{ tool: 'actualizar_tema_minuta', args: { tema: igual('m2'), plazo: (x) => typeof x === 'string' && x >= '2026-10-12' && x <= '2026-10-16' } }] },

  // --- Proyectos ---
  { id: 'pro-crear', grupo: 'Proyectos', msg: 'crea un proyecto "Tablero de ventas" con tres partes: levantar requerimientos, modelo de datos y diseño del tablero',
    espera: [{ tool: 'crear_proyecto', args: { nombre: contiene('tablero de ventas'), subtareas: largo(3) } }] },
  { id: 'pro-subtarea', grupo: 'Proyectos', msg: 'en Gobernar in full agrega "mapear aprobaciones" para Camila del 13 al 20 de octubre',
    espera: [{ tool: 'agregar_subtarea_proyecto', args: { proyecto: igual('p1'), responsables: lista('Camila Rojas'), fecha_inicio: igual('2026-10-13'), fecha_termino: igual('2026-10-20') } }] },
  { id: 'pro-subtarea-nivel', grupo: 'Proyectos', msg: 'bajo "Levantar procesos" agrega "entrevistar a planta"',
    espera: [{ tool: 'agregar_subtarea_proyecto', args: { proyecto: igual('p1'), padre: igual('i1'), titulo: contiene('entrevistar') } }] },
  { id: 'pro-asignar-sin-fechas', grupo: 'Proyectos', msg: 'asigna a Tomás lo de revisar quién cargará el pedido',
    espera: [{ tool: 'pedir_aclaracion', args: { pregunta: existe } }] },
  { id: 'pro-asignar', grupo: 'Proyectos', msg: 'asigna a Tomás lo de revisar quién cargará el pedido, desde mañana hasta el viernes',
    espera: [{ tool: 'asignar_item_proyecto', args: { item: igual('i2'), responsable: igual('Tomás Valdés'), fecha_inicio: igual('2026-10-08'), fecha_termino: igual('2026-10-09') } }] },
  { id: 'pro-cerrar-item', grupo: 'Proyectos', msg: 'el inventario de reportes de Fabric ya está resuelto',
    espera: [{ tool: 'actualizar_item_proyecto', args: { item: igual('i3'), estado: igual('resuelto') } }] },
  { id: 'pro-consultar', grupo: 'Proyectos', msg: '¿cómo va Gobernar in full?',
    espera: [{ tool: 'consultar_proyecto', args: { proyecto: igual('p1') } }] },
  { id: 'pro-a-minuta', grupo: 'Proyectos', msg: 'lleva lo de levantar procesos a la reunión, hay que conversarlo',
    espera: [{ tool: 'llevar_a_minuta', args: { ref: igual('i1') } }] },

  // --- Compromisos ---
  { id: 'com-consultar', grupo: 'Compromisos', msg: '¿cómo vamos con los compromisos?',
    espera: [{ tool: 'consultar_compromisos', args: {} }] },
  { id: 'com-vencidos', grupo: 'Compromisos', msg: 'qué compromisos quedaron vencidos sin cerrar',
    espera: [{ tool: 'consultar_compromisos', args: { solo_vencidos: igual(true) } }] },
  { id: 'com-marcar', grupo: 'Compromisos', msg: 'Camila ya hizo la capacitación, márcala',
    espera: [{ tool: 'actualizar_actividad', args: { actividad: igual('a4'), estado: igual('completado') } }] },
  { id: 'com-mover', grupo: 'Compromisos', msg: 'la matriz de riesgos no se alcanzó, pásala a la otra semana',
    espera: [{ tool: 'actualizar_actividad', args: { actividad: igual('a3'), fecha_entrega: igual('2026-10-14') } }] },
  { id: 'com-cerrar', grupo: 'Compromisos', msg: 'cierra la semana y lo que no se hizo muévelo',
    espera: [{ tool: 'cerrar_semana', args: { pendientes: igual('mover') } }] },
  { id: 'com-multi', grupo: 'Compromisos', msg: 'marca hecho lo de Tomás, y lo de Juan Soto llévalo a la minuta',
    espera: [
      { tool: 'actualizar_actividad', args: { actividad: igual('a1'), estado: igual('completado') } },
      { tool: 'llevar_a_minuta', args: { ref: igual('a3') } },
    ] },

  // --- Errores e ingestas ---
  { id: 'err-registrar', grupo: 'Errores', msg: 'se cayó el reporte de SAP PM, muestra órdenes duplicadas y nadie puede trabajar',
    espera: [{ tool: 'registrar_error', args: { severidad: (x) => x === 'alta' || x === 'critica' } }] },
  { id: 'err-no-es-error', grupo: 'Errores', msg: 'revisar por qué el tablero de producción sale lento',
    espera: [{ tool: 'crear_actividad', args: {} }] },
  { id: 'err-cerrar', grupo: 'Errores', msg: 'el tablero de producción ya carga, ciérralo',
    espera: [{ tool: 'actualizar_error', args: { error: igual('e1'), estado: (x) => x === 'cerrado' || x === 'resuelto' } }] },
  { id: 'err-critico', grupo: 'Errores', msg: 'sube el error del tablero de producción a crítico',
    espera: [{ tool: 'actualizar_error', args: { error: igual('e1'), severidad: igual('critica') } }] },
  { id: 'ing-crear', grupo: 'Ingestas', msg: 'pedir a TI la ingesta de ventas de septiembre a la tabla de BI, compromiso el 15',
    espera: [{ tool: 'crear_ingesta', args: { fecha_compromiso: igual('2026-10-15') } }] },
  { id: 'ing-cambiar', grupo: 'Ingestas', msg: 'la carga del maestro de clientes ya se completó',
    espera: [{ tool: 'actualizar_ingesta', args: { ingesta: igual('g1'), estado: igual('completado') } }] },

  // --- Consultas ---
  { id: 'q-carga', grupo: 'Consultas', msg: '¿quién está más libre el viernes?',
    espera: [{ tool: 'consultar_carga', args: { fecha: igual('2026-10-09') } }] },
  { id: 'q-resumen', grupo: 'Consultas', msg: '¿cómo va el equipo este mes?',
    espera: [{ tool: 'consultar_resumen', args: { periodo: igual('mes') } }] },
  { id: 'q-notif', grupo: 'Consultas', msg: 'qué notificaciones tengo',
    espera: [{ tool: 'consultar_notificaciones', args: {} }] },
]
