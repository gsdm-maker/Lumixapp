import type {
  CargaPersona,
  CompromisoSemana,
  Rendimiento,
} from '@features/dashboard/utils/metricas'

// Exportar el dashboard a un CSV que abre Excel tal cual: punto y coma como separador (Excel en
// espanol usa la coma para decimales) y BOM para que respete los acentos.

const celda = (v: string | number | null) => {
  const s = v === null ? '' : String(v)
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function exportarDashboard({
  equipo,
  periodo,
  indicadores,
  rendimiento,
  compromisos,
  carga,
}: {
  equipo: string
  periodo: string
  indicadores: [string, string | number][]
  rendimiento: Rendimiento[]
  compromisos: CompromisoSemana[]
  carga: CargaPersona[]
}) {
  const filas: (string | number | null)[][] = [
    ['Resumen del equipo', equipo],
    ['Periodo', periodo],
    ['Generado', new Date().toLocaleString('es-CL')],
    [],
    ['Indicador', 'Valor'],
    ...indicadores,
    [],
    [
      'Semana',
      'Completadas',
      'Creadas',
      'Compromisos cumplidos',
      'Compromisos total',
      '% compromisos',
    ],
    ...rendimiento.map((r, i) => [
      r.label,
      r.completadas,
      r.creadas,
      compromisos[i]?.cumplidos ?? null,
      compromisos[i]?.total ?? null,
      compromisos[i]?.porcentaje ?? null,
    ]),
    [],
    [
      'Persona',
      'Horas en proceso',
      'Horas pendientes',
      'Horas detenidas',
      'Horas totales',
      'Actividades abiertas',
    ],
    ...carga.map((c) => [c.nombre, c.enProceso, c.pendiente, c.detenida, c.total, c.actividades]),
  ]
  const csv = String.fromCharCode(0xfeff) + filas.map((f) => f.map(celda).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `lumix-dashboard-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
