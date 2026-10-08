// Tipos del agente del chat. Sin imports: los usa tambien el banco de pruebas (Node).

/** Una accion que el modelo pidio: nombre de la herramienta del catalogo y sus datos. */
export interface Llamada {
  tool: string
  args: Record<string, unknown>
  /** Si una guarda reemplazo lo que pidio el modelo, por que. */
  guarda?: string
}

export interface Pistas {
  nombres_ambiguos: { escrito: string; opciones: string[] }[]
  fechas_mencionadas: boolean
  /** El mensaje habla de compromisos o de la reunion semanal. */
  menciona_compromisos: boolean
  /** "ya lo conversamos", "lo hablamos": cierre de un tema de minuta. */
  dice_conversado: boolean
}

/** Lo que quedo hecho, como tarjeta con cabecera de color (debajo del texto de Lumix). */
export interface Tarjeta {
  tono: 'violeta' | 'verde' | 'ambar' | 'rojo'
  /** Cabecera en mayusculas: ASIGNADA, HECHO, VENCIDA... */
  etiqueta: string
  /** Dato corto a la derecha de la cabecera: fecha, %. */
  valor?: string
  titulo: string
  detalle?: string
  /** A donde lleva al tocarla: una actividad (se abre en Actividades) o una hoja. */
  activityId?: string
  ruta?: string
}
