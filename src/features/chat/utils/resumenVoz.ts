import { fechaRelativa } from '@shared/utils/date'
import type { usePanelLumix } from '@features/chat/hooks/usePanelLumix'

type Panel = NonNullable<ReturnType<typeof usePanelLumix>['panel']>

function saludo(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches'
}

/** "unas 6 horas", "unas 2 horas y media", "menos de una hora": para decirlo en voz alta. */
function horasHabladas(h: number): string {
  if (h < 0.75) return 'menos de una hora'
  const media = Math.round(h * 2) / 2
  const enteras = Math.floor(media)
  const y = media > enteras ? ' y media' : ''
  return enteras === 1 && !y ? 'una hora' : `unas ${enteras} horas${y}`
}

const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios)

/**
 * Lo que Lumix dice en voz alta al tocar el circulo: el dia de hoy (que vence, cuanto pesa, lo
 * primero), lo atrasado, el avance de los compromisos y los temas por conversar. Se arma con los
 * datos del panel, sin llamar a la IA (no cuesta nada y es inmediato).
 */
export function resumenDelDia(panel: Panel, nombre: string): string {
  const partes: string[] = [`${saludo()}, ${nombre.split(' ')[0] || ''}.`]

  // Hoy
  const hoy = panel.semana.find((d) => d.esHoy)
  const n = panel.hoyLista.length
  if (n === 0) {
    partes.push('Hoy no tienes actividades que venzan.')
  } else {
    partes.push(
      `Hoy tienes ${n} ${plural(n, 'actividad', 'actividades')}${hoy ? `, ${horasHabladas(hoy.horas)}` : ''}.`,
    )
    const [primera, segunda] = panel.hoyLista
    let orden = `Lo primero: ${primera.title}`
    if (segunda) orden += `; después, ${segunda.title}`
    if (n > 2) orden += `, y ${n - 2} ${plural(n - 2, 'más', 'más')}`
    partes.push(`${orden}.`)
    if (hoy && (hoy.nivel === 'alta' || hoy.nivel === 'saturado')) {
      partes.push('Es un día cargado.')
      if (panel.sugerencia)
        partes.push(
          `Podrías mover ${panel.sugerencia.actividad.title} al ${panel.sugerencia.hacia.dia} ${panel.sugerencia.hacia.numero}, que está libre.`,
        )
    }
  }

  // Atrasadas
  const k = panel.atrasadas.length
  if (k > 0) {
    const vieja = panel.atrasadas[0]
    const dias = -fechaRelativa(vieja.due_date).days
    const cuando = dias <= 1 ? 'de ayer' : `de hace ${dias} días`
    partes.push(
      `Tienes ${k} ${plural(k, 'actividad atrasada', 'actividades atrasadas')}; la más antigua es ${vieja.title}, ${cuando}.`,
    )
  }

  // Compromisos
  if (panel.total > 0) {
    const faltan = panel.pendientes.length
    partes.push(
      `Vas en ${panel.porcentaje ?? 0} por ciento de tus compromisos de la semana; la meta es ${panel.meta} por ciento${
        faltan ? `, y te ${plural(faltan, 'falta', 'faltan')} ${faltan}` : ''
      }.`,
    )
  }

  if (panel.porConversar > 0)
    partes.push(
      `Hay ${panel.porConversar} ${plural(panel.porConversar, 'tema', 'temas')} por conversar en la minuta.`,
    )

  partes.push(n > 0 || k > 0 ? '¿Por dónde partimos?' : 'Que tengas un buen día.')
  return partes.join(' ')
}
