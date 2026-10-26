// Topes de tamano de lo que se manda a la IA.
//
// POR QUE EXISTE ESTE ARCHIVO
// El tope diario (registrar_uso_ia) cuenta llamadas, no tamano: sin esto, cada una de esas
// llamadas podia traer un texto enorme y multiplicar el gasto de la clave de OpenAI. Se corta
// ANTES de leer el JSON, para no procesar cuerpos gigantes.
//
// Los numeros son caracteres y tienen margen sobre el uso real: un mensaje del chat rara vez pasa
// de unos cientos de caracteres; la carga masiva admite varias paginas pegadas.

/** Texto que escribe la persona en el chat (mensaje, pregunta, actualizacion). */
export const MAX_MENSAJE = 8_000
/** Texto pegado en la carga masiva. */
export const MAX_TEXTO_MASIVO = 30_000
/** Cuerpo completo de la peticion (texto + contexto + listas). */
export const MAX_CUERPO = 150_000

// El cuerpo queda sin tipar, igual que el req.json() que reemplaza: cada funcion valida sus campos.
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cuerpo = Record<string, any>

export type Lectura = { ok: true; body: Cuerpo } | { ok: false; status: number; error: string }

/** Lee el cuerpo como JSON solo si no pasa el tope de tamano. */
export async function leerJson(req: Request, max = MAX_CUERPO): Promise<Lectura> {
  const declarado = Number(req.headers.get('Content-Length') ?? 0)
  if (declarado > max) return demasiadoGrande()
  const texto = await req.text()
  if (texto.length > max) return demasiadoGrande()
  try {
    const body = JSON.parse(texto)
    if (!body || typeof body !== 'object') throw new Error('no es un objeto')
    return { ok: true, body }
  } catch {
    return { ok: false, status: 400, error: 'Cuerpo de la peticion invalido' }
  }
}

/** Devuelve el error si el texto pasa el tope, o null si esta dentro. */
export function textoExcede(texto: string, max = MAX_MENSAJE): string | null {
  if (texto.length <= max) return null
  return `El texto es demasiado largo (máximo ${max.toLocaleString('es-CL')} caracteres). Divídelo en partes.`
}

function demasiadoGrande(): Lectura {
  return {
    ok: false,
    status: 413,
    error: 'La petición es demasiado grande. Divide el texto en partes más cortas.',
  }
}
