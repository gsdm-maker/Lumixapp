// Banco de pruebas del agente del chat: corre cada caso contra cada modelo y mide aciertos,
// tiempo y costo.
//
//   node bench/agente/correr.mjs                       (modelos por defecto, 1 vuelta)
//   node bench/agente/correr.mjs gpt-4.1-mini gpt-4.1  (solo esos)
//   node bench/agente/correr.mjs --rep 3               (3 vueltas: mide estabilidad)
//
// La clave se toma de OPENAI_API_KEY o de SUPABASE_CREDS.md ("API OPENIA LUMIX: ..."). Nunca
// se imprime. Los resultados quedan en bench/agente/resultados/ (fuera de git).

import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CATALOGO, SISTEMA } from './catalogo.mjs'
import { CASOS, CONTEXTO } from './casos.mjs'
import { pistas } from './pistas.mjs'
import { aplicarGuardas } from './guardas.mjs'

const AQUI = dirname(fileURLToPath(import.meta.url))

// Precios de lista por millon de tokens (entrada, salida), US$. Referenciales: verificar en
// https://openai.com/api/pricing antes de decidir por costo.
const PRECIOS = {
  'gpt-4.1-mini': [0.4, 1.6],
  'gpt-4.1': [2, 8],
  'gpt-4.1-nano': [0.1, 0.4],
  'gpt-4o-mini': [0.15, 0.6],
  'gpt-4o': [2.5, 10],
  'gpt-5-mini': [0.25, 2],
  'gpt-5': [1.25, 10],
}
const POR_DEFECTO = ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini', 'gpt-4o', 'gpt-5-mini']
const SOLO_LECTURA = new Set([
  'listar_actividades',
  'consultar_proyecto',
  'consultar_compromisos',
  'consultar_carga',
  'consultar_resumen',
  'consultar_notificaciones',
])

function clave() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY
  for (const p of [join(AQUI, '../../../SUPABASE_CREDS.md'), join(AQUI, '../../SUPABASE_CREDS.md')]) {
    if (!existsSync(p)) continue
    const m = readFileSync(p, 'utf8').match(/API OPENIA LUMIX:\s*(\S+)/)
    if (m) return m[1]
  }
  throw new Error('Falta la clave: define OPENAI_API_KEY o agrega "API OPENIA LUMIX:" en SUPABASE_CREDS.md')
}

const esRazonamiento = (m) => /^(gpt-5|o\d)/.test(m)

async function llamar(modelo, msg, key) {
  const body = {
    model: modelo,
    messages: [
      {
        role: 'system',
        content: `${SISTEMA}\n\nCONTEXTO:\n${JSON.stringify(CONTEXTO)}\n\nPISTAS:\n${JSON.stringify(pistas(msg, CONTEXTO.miembros))}`,
      },
      { role: 'user', content: msg },
    ],
    tools: CATALOGO,
    tool_choice: 'auto',
    ...(esRazonamiento(modelo)
      ? { max_completion_tokens: 4000, reasoning_effort: 'low' }
      : { max_tokens: 800, temperature: 0 }),
  }
  const t0 = performance.now()
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  })
  const ms = performance.now() - t0
  const json = await res.json()
  if (!res.ok) throw new Error(`${res.status} ${json.error?.message ?? ''}`.slice(0, 200))
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
  return { ms, llamadas, texto: choice.content ?? '', uso: json.usage }
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
  const modelos = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--rep')
  const lista = modelos.length ? modelos : POR_DEFECTO
  const key = clave()

  const resultados = []
  for (const modelo of lista) {
    process.stdout.write(`${modelo}: `)
    const tareas = CASOS.flatMap((caso) =>
      Array.from({ length: rep }, () => async () => {
        try {
          const r = await llamar(modelo, caso.msg, key)
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
    resultados.push(...(await enParalelo(tareas, 4)))
    process.stdout.write('\n')
  }

  // Resumen por modelo.
  const filas = lista.map((modelo) => {
    const r = resultados.filter((x) => x.modelo === modelo)
    const ok = r.filter((x) => x.ok).length
    const okCrudo = r.filter((x) => x.okCrudo).length
    const tiempos = r.map((x) => x.ms).filter(Boolean).sort((a, b) => a - b)
    const [pin, pout] = PRECIOS[modelo] ?? [NaN, NaN]
    const costo = r.reduce(
      (s, x) => s + (x.uso ? (x.uso.prompt_tokens * pin + x.uso.completion_tokens * pout) / 1e6 : 0),
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
