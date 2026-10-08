export function parseDateLocal(isoString: string): Date {
  const [y, m, d] = isoString.split('T')[0].split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatDateLocal(isoString: string, format?: 'short' | 'full'): string {
  const date = parseDateLocal(isoString)
  if (format === 'short') {
    return date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
  }
  return date.toLocaleDateString('es-CL')
}

export function getDaysRemainingLocal(dueDate: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const due = parseDateLocal(dueDate)
  due.setHours(0, 0, 0, 0)
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export type DueTone = 'late' | 'today' | 'tomorrow' | 'soon' | 'normal'

/**
 * Fecha de entrega en palabras, como la diria una persona: "hoy", "ayer", "mañana",
 * "hace 3 d", "jue 8", "9 oct". El tono dice que tan urgente es (rojo/ambar solo cuando
 * importa). Usar con <DueDate>.
 */
export function fechaRelativa(iso: string): { text: string; tone: DueTone; days: number } {
  const days = getDaysRemainingLocal(iso)
  const date = parseDateLocal(iso)
  if (days < 0) return { text: days === -1 ? 'ayer' : `hace ${-days} d`, tone: 'late', days }
  if (days === 0) return { text: 'hoy', tone: 'today', days }
  if (days === 1) return { text: 'mañana', tone: 'tomorrow', days }
  if (days <= 6) {
    const dia = date.toLocaleDateString('es-CL', { weekday: 'short' }).replace('.', '')
    return { text: `${dia} ${date.getDate()}`, tone: 'soon', days }
  }
  const mismoAnio = date.getFullYear() === new Date().getFullYear()
  const text = date
    .toLocaleDateString('es-CL', {
      day: 'numeric',
      month: 'short',
      ...(mismoAnio ? {} : { year: 'numeric' }),
    })
    .replace('.', '')
  return { text, tone: 'normal', days }
}

/** Suma dias habiles (lunes a viernes) a una fecha. */
export function addBusinessDays(date: Date, days: number): Date {
  const r = new Date(date)
  let added = 0
  while (added < days) {
    r.setDate(r.getDate() + 1)
    if (r.getDay() !== 0 && r.getDay() !== 6) added++
  }
  return r
}
