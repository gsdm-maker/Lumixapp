// Pistas que el codigo calcula ANTES de llamar a la IA: lo que se puede saber con certeza no se
// le deja adivinar al modelo. En la app, esto sale del mismo parser de la vista previa del chat
// (composer/vistaPrevia.ts).

const sinTildes = (s) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

/** Nombres de pila que calzan con mas de una persona y se escribieron sin apellido. */
export function nombresAmbiguos(msg, miembros) {
  const texto = ` ${sinTildes(msg).replace(/[^a-z0-9ñ ]/g, ' ')} `
  const porNombre = new Map()
  for (const m of miembros) {
    const pila = sinTildes(m.split(' ')[0])
    porNombre.set(pila, [...(porNombre.get(pila) ?? []), m])
  }
  const res = []
  for (const [pila, personas] of porNombre) {
    if (personas.length < 2 || !texto.includes(` ${pila} `)) continue
    const conApellido = personas.some((p) => texto.includes(` ${sinTildes(p)} `))
    if (!conApellido) res.push({ escrito: pila, opciones: personas })
  }
  return res
}

const FECHA =
  /\b(hoy|manana|pasado|lunes|martes|miercoles|jueves|viernes|sabado|domingo|semana|mes|fin de|proxim\w*|\d{1,2}\s*(\/|-|de)\s*\w+|el \d{1,2}|en \d+ dias?)\b/

export function fechasMencionadas(msg) {
  return FECHA.test(sinTildes(msg))
}

export function pistas(msg, miembros) {
  return { nombres_ambiguos: nombresAmbiguos(msg, miembros), fechas_mencionadas: fechasMencionadas(msg) }
}
