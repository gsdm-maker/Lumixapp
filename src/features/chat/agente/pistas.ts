// Pistas que el codigo calcula ANTES de llamar a la IA: lo que se puede saber con certeza no se
// le deja adivinar al modelo. Sin imports con alias: tambien lo usa el banco de pruebas.

import type { Pistas } from './tipos.ts'

const sinTildes = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')

/** Nombres de pila que calzan con mas de una persona y se escribieron sin apellido. */
export function nombresAmbiguos(msg: string, miembros: string[]): Pistas['nombres_ambiguos'] {
  const texto = ` ${sinTildes(msg).replace(/[^a-z0-9ñ ]/g, ' ')} `
  const porNombre = new Map<string, string[]>()
  for (const m of miembros) {
    const pila = sinTildes(m.split(' ')[0] ?? '')
    if (pila) porNombre.set(pila, [...(porNombre.get(pila) ?? []), m])
  }
  const res: Pistas['nombres_ambiguos'] = []
  for (const [pila, personas] of porNombre) {
    if (personas.length < 2 || !texto.includes(` ${pila} `)) continue
    // Con apellido (o la inicial: "Juan S.") ya no es ambiguo.
    const conApellido = personas.some((p) => {
      const [, apellido] = sinTildes(p).split(' ')
      return !!apellido && new RegExp(` ${pila} ${apellido[0]}`).test(texto)
    })
    if (!conApellido) res.push({ escrito: pila, opciones: personas })
  }
  return res
}

const FECHA =
  /\b(hoy|manana|pasado|lunes|martes|miercoles|jueves|viernes|sabado|domingo|semana|mes|fin de|proxim\w*|\d{1,2}\s*(\/|-|de)\s*\w+|el \d{1,2}|al \d{1,2}|del \d{1,2}|en \d+ dias?)\b/

export function fechasMencionadas(msg: string): boolean {
  return FECHA.test(sinTildes(msg))
}

export function calcularPistas(msg: string, miembros: string[]): Pistas {
  return {
    nombres_ambiguos: nombresAmbiguos(msg, miembros),
    fechas_mencionadas: fechasMencionadas(msg),
  }
}
