// Banco de pruebas del agente del chat: corre cada caso contra cada modelo y mide aciertos,
// tiempo y costo.
//
//   node --experimental-strip-types bench/agente/correr.mjs            (modelos por defecto)
//   node --experimental-strip-types bench/agente/correr.mjs gpt-4.1-mini gpt-4.1  (solo esos)
//   node --experimental-strip-types bench/agente/correr.mjs --rep 3               (3 vueltas: mide estabilidad)
//   ... --tope 2       gasto maximo en US$ (por defecto 1): si la estimacion lo supera, no corre
//   ... --paralelo 2   llamadas simultaneas (bajar en planes gratis con limite por minuto)
//   Modelos con @: gemini-2.5-flash@none apaga el razonamiento (mas rapido y barato)
//
// Claves: OPENAI_API_KEY / GEMINI_API_KEY, o en SUPABASE_CREDS.md ("API OPENIA LUMIX: ...",
// "API GEMINI LUMIX: ..."). Nunca se imprimen. Los resultados quedan en bench/agente/resultados/ (fuera de git).

import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
// Fuente unica: el catalogo de la Edge Function y las pistas/guardas de la app. Lo que se mide
// es exactamente lo que corre (por eso se ejecuta con --experimental-strip-types).
import { CATALOGO, SISTEMA } from '../../supabase/functions/ai-agente/catalogo.ts'
import { CASOS, CONTEXTO } from './casos.mjs'
import { calcularPistas as pistas } from '../../src/features/chat/agente/pistas.ts'
import { aplicarGuardas } from '../../src/features/chat/agente/guardas.ts'

const AQUI = dirname(fileURLToPath(import.meta.url))

// Precios de lista por millon de tokens (entrada, salida), US$. Referenciales: verificar en
// https://openai.com/api/pricing y https://ai.google.dev/pricing antes de decidir por costo.
const PRECIOS = {
  'gpt-4.1-mini': [0.4, 1.6],
  'gpt-4.1': [2, 8],
  'gpt-4.1-nano': [0.1, 0.4],
  'gpt-4o-mini': [0.15, 0.6],
  'gpt-4o': [2.5, 10],
  'gpt-5-mini': [0.25, 2],
  'gpt-5': [1.25, 10],
  'gemini-2.5-flash': [0.3, 2.5],
  'gemini-2.5-flash-lite': [0.1, 0.4],
  'gemini-2.5-pro': [1.25, 10],
}
const POR_DEFECTO = ['gemini-2.5-flash@none', 'gemini-2.5-flash-lite@none']
// Tokens tipicos por llamada (medidos): sirven para estimar el costo ANTES de correr.
const TOKENS_ENTRADA = 3200
const TOKENS_SALIDA = 120
const SOLO_LECTURA = new Set([
  'listar_actividades',
  'consultar_proyecto',
  'consultar_compromisos',
  'consultar_carga',
  'consultar_resumen',
  'consultar_notificaciones',
])

// Proveedores. Gemini se usa por su modo compatible con OpenAI: mismo formato de mensajes y
// herramientas, cambia solo la direccion y la clave.
const PROVEEDORES = {
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    env: 'OPENAI_API_KEY',
    creds: /API OPENIA LUMIX:\s*(\S+)/,
  },
  gemini: {
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    env: 'GEMINI_API_KEY',
    creds: /API GEMINI LUMIX:\s*(\S+)/,
  },
}

/** "gemini-2.5-flash@none" -> modelo, proveedor y esfuerzo de razonamiento (opcional). */
function parsear(id) {
  const [modelo, esfuerzo] = id.split('@')
  return { id, modelo, esfuerzo, proveedor: modelo.startsWith('gemini') ? 'gemini' : 'openai' }
}

function clave(proveedor) {
  const p = PROVEEDORES[proveedor]
  if (process.env[p.env]) return process.env[p.env]
  for (const f of [join(AQUI, '../../../SUPABASE_CREDS.md'), join(AQUI, '../../SUPABASE_CREDS.md')]) {
    if (!existsSync(f)) continue
    const m = readFileSync(f, 'utf8').match(p.creds)
    if (m) return m[1]
  }
  throw new Error(`Falta la clave de ${proveedor}: define ${p.env} o agregala en SUPABASE_CREDS.md`)
}

const esRazonamientoOpenAI = (m) => /^(gpt-5|o\d)/.test(m)

function parametros({ modelo, esfuerzo, proveedor }) {
  if (proveedor === 'gemini')
    // Gemini 2.5 piensa por defecto (y lo cobra como salida). "none" lo apaga en Flash.
    return { max_tokens: 2000, temperature: 0, ...(esfuerzo ? { reasoning_effort: esfuerzo } : {}) }
  if (esRazonamientoOpenAI(modelo))
    return { max_completion_tokens: 4000, reasoning_effort: esfuerzo ?? 'low' }
  return { max_tokens: 800, temperature: 0 }
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

async function llamar(m, msg, key) {
  const body = {
    model: m.modelo,
    messages: [
      {
        role: 'system',
        content: `${SISTEMA}

CONTEXTO:
${JSON.stringify(CONTEXTO)}

PISTAS:
${JSON.stringify(pistas(msg, CONTEXTO.miembros))}`,
      },
      { role: 'user', content: msg },
    ],
    tools: CATALOGO,
    tool_choice: 'auto',
    ...parametros(m),
  }
  // Reintento con espera ante 429 por ritmo (no por falta de credito: ese corta todo).
  for (let intento = 0; ; intento++) {
    const t0 = performance.now()
    const res = await fetch(PROVEEDORES[m.proveedor].url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    })
    const ms = performance.now() - t0
    const json = await res.json().catch(() => ({}))
    const err = (Array.isArray(json) ? json[0] : json)?.error
    if (res.status === 429 && intento < 4 && !/credit|quota|billing/i.test(err?.message ?? '')) {
      await esperar(2000 * 2 ** intento)
      continue
    }
    if (!res.ok) throw new Error(`${res.status} ${err?.message ?? ''}`.slice(0, 200))
    const choice = json.choices[0].message
    const llamadas = (choice.tool_calls ?? []).map((c) => {
      let args = {}
      try {
        args = JSON.parse(c.function.arguments)
      } catch {
        args = { _invalido: c.function.arguments }
      }
      return { tool: c.function.name, args }
    })
    // La salida incluye lo que el modelo "penso" (se cobra igual).
    const uso = json.usage
      ? { entrada: json.usage.prompt_tokens, salida: json.usage.total_tokens - json.usage.prompt_tokens }
      : null
    return { ms, llamadas, texto: choice.content ?? '', uso }
  }
}

/** Empareja lo esperado con lo que llamo el modelo. Devuelve null si pasa, o el motivo. */
function evaluar(esperado, llamadas) {
  const libres = [...llamadas]
  for (const e of esperado) {
    const i = libres.findIndex(
      (c) => c.tool === e.tool && Object.entries(e.args).every(([k, ok]) => ok(c.args[k])),
    )
    if (i === -1) {
      const mismo = libres.find((c) => c.tool === e.tool)
      return mismo
        ? `${e.tool}: argumentos ${JSON.stringify(mismo.args)}`
        : `faltó ${e.tool}`
    }
    libres.splice(i, 1)
  }
  const sobran = libres.filter((c) => !SOLO_LECTURA.has(c.tool))
  if (sobran.length) return `de más: ${sobran.map((c) => c.tool).join(', ')}`
  return null
}

function evaluarCaso(caso, llamadas) {
  if (llamadas.length === 0) return 'no llamó ninguna acción'
  const motivo = evaluar(caso.espera, llamadas)
  if (!motivo) return null
  for (const alt of caso.o ?? []) if (!evaluar(alt, llamadas)) return null
  return motivo
}

async function enParalelo(tareas, n) {
  const res = []
  let i = 0
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < tareas.length) {
        const k = i++
        res[k] = await tareas[k]()
      }
    }),
  )
  return res
}

async function main() {
  const args = process.argv.slice(2)
  const rep = args.includes('--rep') ? Number(args[args.indexOf('--rep') + 1]) : 1
  const opcion = (n, def) => (args.includes(n) ? Number(args[args.indexOf(n) + 1]) : def)
  // Tope de gasto en US$: se estima ANTES de correr y no se parte si lo supera. Una prueba sin
  // tope dejo una vez sin credito la clave de produccion.
  const tope = opcion('--tope', 1)
  const paralelo = opcion('--paralelo', 4)
  const modelos = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'))
  const lista = modelos.length ? modelos : POR_DEFECTO

  const estimado = lista.reduce((s, id) => {
    const [pin, pout] = PRECIOS[parsear(id).modelo] ?? [5, 20]
    return s + (CASOS.length * rep * (TOKENS_ENTRADA * pin + TOKENS_SALIDA * pout)) / 1e6
  }, 0)
  console.log(`Costo estimado: US$ ${estimado.toFixed(2)} (tope US$ ${tope})`)
  if (estimado > tope) {
    console.log('Supera el tope: no se corre. Sube --tope si de verdad quieres gastarlo.')
    return
  }
  const claves = {}
  for (const id of lista) claves[parsear(id).proveedor] ??= clave(parsear(id).proveedor)

  const resultados = []
  for (const modelo of lista) {
    process.stdout.write(`${modelo}: `)
    const tareas = CASOS.flatMap((caso) =>
      Array.from({ length: rep }, () => async () => {
        try {
          const m = parsear(modelo)
          const r = await llamar(m, caso.msg, claves[m.proveedor])
          // Se mide dos veces: lo que propone el modelo solo, y lo que queda tras las guardas
          // (que es lo que de verdad se ejecutaria en la app).
          const okCrudo = !evaluarCaso(caso, r.llamadas)
          const guardadas = aplicarGuardas(r.llamadas, pistas(caso.msg, CONTEXTO.miembros))
          const fallo = evaluarCaso(caso, guardadas)
          process.stdout.write(fallo ? 'x' : '.')
          return { modelo, caso: caso.id, grupo: caso.grupo, msg: caso.msg, ok: !fallo, okCrudo, fallo, ...r, guardadas }
        } catch (err) {
          process.stdout.write('!')
          return { modelo, caso: caso.id, grupo: caso.grupo, msg: caso.msg, ok: false, fallo: `API: ${err.message}`, ms: 0, llamadas: [], uso: null }
        }
      }),
    )
    resultados.push(...(await enParalelo(tareas, paralelo)))
    process.stdout.write('\n')
  }

  // Resumen por modelo.
  const filas = lista.map((modelo) => {
    const r = resultados.filter((x) => x.modelo === modelo)
    const ok = r.filter((x) => x.ok).length
    const okCrudo = r.filter((x) => x.okCrudo).length
    const tiempos = r.map((x) => x.ms).filter(Boolean).sort((a, b) => a - b)
    const [pin, pout] = PRECIOS[parsear(modelo).modelo] ?? [NaN, NaN]
    const costo = r.reduce(
      (s, x) => s + (x.uso ? (x.uso.entrada * pin + x.uso.salida * pout) / 1e6 : 0),
      0,
    )
    const grupos = {}
    for (const x of r) {
      grupos[x.grupo] ??= [0, 0]
      grupos[x.grupo][1]++
      if (x.ok) grupos[x.grupo][0]++
    }
    return {
      modelo,
      solo_ia: `${okCrudo}/${r.length}`,
      aciertos: `${ok}/${r.length}`,
      pct: Math.round((ok / r.length) * 100),
      ms_mediana: Math.round(tiempos[Math.floor(tiempos.length / 2)] ?? 0),
      ms_p95: Math.round(tiempos[Math.floor(tiempos.length * 0.95)] ?? 0),
      usd_por_1000: Math.round((costo / r.length) * 1000 * 100) / 100,
      grupos,
    }
  })

  console.log('\nModelo          Solo IA    Con guardas %    Mediana  p95     US$/1000 msj')
  for (const f of filas)
    console.log(
      `${f.modelo.padEnd(15)} ${f.solo_ia.padEnd(10)} ${f.aciertos.padEnd(11)} ${String(f.pct).padEnd(4)} ${(f.ms_mediana + ' ms').padEnd(8)} ${(f.ms_p95 + ' ms').padEnd(7)} ${f.usd_por_1000}`,
    )

  const dir = join(AQUI, 'resultados')
  mkdirSync(dir, { recursive: true })
  const sello = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  writeFileSync(
    join(dir, `bench-${sello}.json`),
    JSON.stringify({ fecha: new Date().toISOString(), rep, resumen: filas, resultados }, null, 2),
  )
  console.log(`\nDetalle: bench/agente/resultados/bench-${sello}.json`)
  const fallos = resultados.filter((x) => !x.ok)
  if (fallos.length) {
    console.log('\nFallos:')
    for (const f of fallos) console.log(`  [${f.modelo}] ${f.caso}: ${f.fallo}`)
  }
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
