// Agente del chat: convierte un mensaje en acciones del catalogo (catalogo.ts).
//
// La funcion NO ejecuta nada ni toca la base: devuelve las acciones que el modelo eligio, y la
// app las revisa (guardas), las confirma si hace falta y las ejecuta con los permisos de quien
// escribe. Asi el agente nunca puede hacer algo que la persona no podria hacer en la hoja.
//
// Modelo: gpt-4.1-mini, elegido en el banco de pruebas (bench/agente): 132/132 con las guardas
// de la app, ~0,8 s y ~US$ 1,4 por 1.000 mensajes (gpt-4.1 acierta igual y cuesta 5 veces mas).
// Se cambia sin tocar codigo con AI_MODEL_AGENTE (ej. "gpt-4.1", "gemini-3.5-flash-lite"); Gemini
// usa GEMINI_API_KEY y OpenAI, OPENAI_API_KEY.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { buildCors, jsonResponse } from '../_shared/cors.ts'
import { bloqueoPorPlan, dentroDelTopeIa, getUser } from '../_shared/auth.ts'
import { checkRateLimit } from '../_shared/rate-limit.ts'
import { leerJson, textoExcede } from '../_shared/limites.ts'
import { pickModel, proveedorDe, tuningParams } from '../_shared/model.ts'
import { CATALOGO, SISTEMA } from './catalogo.ts'

const AI_MODEL = pickModel('agente', 'gpt-4.1-mini')
const PROVEEDOR = proveedorDe(AI_MODEL)
const RATE_LIMIT_MAX = 30
// El contexto (actividades, temas, compromisos...) puede crecer: se pone un techo para que un
// equipo con mucho historial no dispare el costo de cada mensaje.
const MAX_CONTEXTO = 60_000

interface Turno {
  role?: string
  text?: string
}

serve(async (req: Request) => {
  const cors = buildCors(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, cors)

  const user = await getUser(req)
  if (!user) return jsonResponse({ error: 'No autorizado' }, 401, cors)
  const bloqueo = await bloqueoPorPlan(user.id)
  if (bloqueo) return jsonResponse({ error: bloqueo, plan: 'vencido' }, 402, cors)
  if (!checkRateLimit(user.id, RATE_LIMIT_MAX)) {
    return jsonResponse({ error: 'Too many requests. Try again in a minute.' }, 429, cors)
  }
  if (!(await dentroDelTopeIa(user.id))) {
    return jsonResponse(
      { error: 'Alcanzaste el límite diario de mensajes con IA. Intenta mañana.' },
      429,
      cors,
    )
  }

  try {
    const lectura = await leerJson(req)
    if (!lectura.ok) return jsonResponse({ error: lectura.error }, lectura.status, cors)
    const { mensaje, contexto, pistas, historial } = lectura.body as {
      mensaje?: unknown
      contexto?: unknown
      pistas?: unknown
      historial?: unknown
    }
    if (!mensaje || typeof mensaje !== 'string') {
      return jsonResponse({ error: 'mensaje es obligatorio' }, 400, cors)
    }
    const largo = textoExcede(mensaje)
    if (largo) return jsonResponse({ error: largo }, 413, cors)
    const ctx = JSON.stringify(contexto ?? {})
    if (ctx.length > MAX_CONTEXTO) {
      return jsonResponse({ error: 'Contexto demasiado grande' }, 413, cors)
    }

    // Hilo previo: ultimos 6 turnos, 300 caracteres cada uno. Sirve para completar una orden
    // cuando la persona responde una pregunta de Lumix ("Juan Pérez", "del 13 al 20").
    const turnos: Turno[] = Array.isArray(historial) ? historial.slice(-6) : []
    const previos = turnos.map((t) => ({
      role: t.role === 'lumix' ? ('assistant' as const) : ('user' as const),
      content: String(t.text ?? '').slice(0, 300),
    }))

    const response = await fetch(PROVEEDOR.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${PROVEEDOR.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: PROVEEDOR.model,
        messages: [
          {
            role: 'system',
            content: `${SISTEMA}\n\nCONTEXTO:\n${ctx}\n\nPISTAS:\n${JSON.stringify(pistas ?? {})}`,
          },
          ...previos,
          { role: 'user', content: mensaje },
        ],
        tools: CATALOGO,
        tool_choice: 'auto',
        ...tuningParams(PROVEEDOR.model, 800, 0),
        ...PROVEEDOR.extra,
      }),
    })

    if (!response.ok) {
      console.error('AI API error:', await response.text())
      return jsonResponse({ error: 'AI service error' }, 502, cors)
    }

    const data = await response.json()
    const msg = data.choices?.[0]?.message ?? {}
    const llamadas = (msg.tool_calls ?? []).map(
      (c: { function: { name: string; arguments: string } }) => {
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(c.function.arguments)
        } catch {
          // Argumentos ilegibles: la accion llega vacia y la app la descarta.
        }
        return { tool: c.function.name, args }
      },
    )

    return jsonResponse({ llamadas, texto: msg.content ?? '', model: AI_MODEL }, 200, cors)
  } catch (err) {
    console.error('Function error:', err)
    return jsonResponse({ error: 'Internal server error' }, 500, cors)
  }
})
