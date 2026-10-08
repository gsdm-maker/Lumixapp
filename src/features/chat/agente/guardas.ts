// Guardas: revisan lo que propone la IA ANTES de ejecutarlo. Lo que el codigo sabe con certeza
// (un nombre ambiguo, una fecha que nadie dijo) no se deja pasar aunque el modelo lo ignore.
// Medido en el banco de pruebas: con esto gpt-4.1 pasa de 129/132 a 132/132.

import type { Llamada, Pistas } from './tipos.ts'

const CON_RESPONSABLE = new Set([
  'crear_actividad',
  'crear_subtarea',
  'actualizar_actividad',
  'crear_tema_minuta',
  'actualizar_tema_minuta',
  'asignar_tema_minuta',
  'asignar_item_proyecto',
])

export function aplicarGuardas(llamadas: Llamada[], pistas: Pistas): Llamada[] {
  for (const amb of pistas.nombres_ambiguos) {
    const eligio = llamadas.some(
      (c) =>
        (CON_RESPONSABLE.has(c.tool) && amb.opciones.includes(c.args.responsable as string)) ||
        (Array.isArray(c.args.responsables) &&
          (c.args.responsables as string[]).some((r) => amb.opciones.includes(r))),
    )
    if (eligio)
      return [
        {
          tool: 'pedir_aclaracion',
          args: {
            pregunta: `¿A cuál ${capital(amb.escrito)} te refieres?`,
            opciones: amb.opciones,
          },
          guarda: 'nombre_ambiguo',
        },
      ]
  }
  if (!pistas.fechas_mencionadas && llamadas.some((c) => c.tool === 'asignar_item_proyecto'))
    return [
      {
        tool: 'pedir_aclaracion',
        args: {
          pregunta: '¿Desde y hasta cuándo? Asignar un ítem de proyecto necesita inicio y término.',
        },
        guarda: 'fechas_inventadas',
      },
    ]
  return llamadas.map((c) => corregir(c, pistas))
}

/**
 * Correcciones de intencion que el codigo puede asegurar mirando el texto (medidas en el banco
 * de pruebas: son justo los fallos repetidos de gpt-4.1-mini).
 */
function corregir(c: Llamada, pistas: Pistas): Llamada {
  // "¿Que tengo?" / "¿que tiene Tomas?" sin hablar de compromisos es una lista de actividades.
  if (c.tool === 'consultar_compromisos' && !pistas.menciona_compromisos && !c.args.solo_vencidos)
    return {
      tool: 'listar_actividades',
      args: {
        responsable: c.args.responsable ?? 'yo',
        ...(c.args.semana === 'actual' ? { plazo: 'semana' } : {}),
      },
      guarda: 'lista_no_compromisos',
    }
  // "Ya lo conversamos" sobre un tema: es la accion propia de la Minuta, no un cambio de estado.
  const soloEstado =
    c.tool === 'actualizar_tema_minuta' &&
    Object.keys(c.args).every((k) => k === 'tema' || k === 'estado')
  if (soloEstado && pistas.dice_conversado)
    return { tool: 'marcar_conversado', args: { tema: c.args.tema }, guarda: 'conversado' }
  return c
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
