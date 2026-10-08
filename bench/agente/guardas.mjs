// Guardas: revisan lo que propone la IA ANTES de ejecutarlo. Lo que el codigo sabe con certeza
// (un nombre ambiguo, una fecha que nadie dijo) no se le deja pasar al modelo aunque lo ignore.

const CON_RESPONSABLE = new Set([
  'crear_actividad',
  'crear_subtarea',
  'actualizar_actividad',
  'crear_tema_minuta',
  'actualizar_tema_minuta',
  'asignar_tema_minuta',
  'asignar_item_proyecto',
])

export function aplicarGuardas(llamadas, pistas) {
  for (const amb of pistas.nombres_ambiguos) {
    const eligio = llamadas.some(
      (c) =>
        (CON_RESPONSABLE.has(c.tool) && amb.opciones.includes(c.args.responsable)) ||
        (Array.isArray(c.args.responsables) && c.args.responsables.some((r) => amb.opciones.includes(r))),
    )
    if (eligio)
      return [
        {
          tool: 'pedir_aclaracion',
          args: { pregunta: `¿A cuál ${amb.escrito} te refieres?`, opciones: amb.opciones },
          guarda: 'nombre_ambiguo',
        },
      ]
  }
  if (!pistas.fechas_mencionadas && llamadas.some((c) => c.tool === 'asignar_item_proyecto'))
    return [
      {
        tool: 'pedir_aclaracion',
        args: { pregunta: '¿Desde y hasta cuándo? Asignar un ítem de proyecto necesita inicio y término.' },
        guarda: 'fechas_inventadas',
      },
    ]
  return llamadas
}
