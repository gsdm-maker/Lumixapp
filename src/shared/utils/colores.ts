// Paleta de etiquetas (estilo Todoist): un color con significado para cada modulo, proyecto y
// persona. Las clases van escritas completas a proposito: Tailwind solo genera las clases que
// encuentra literalmente en el codigo, asi que no se pueden armar con `bg-tag-${color}`.

// 7 tonos: la teoria de paletas categoricas recomienda no pasar de 6-7 (mas alla dejan de
// distinguirse). Sin turquesa: chocaba con el acento petroleo (mismo tono, 196 vs 203 grados).
export type TagColor = 'red' | 'orange' | 'amber' | 'green' | 'blue' | 'violet' | 'pink'

export const TAG: Record<TagColor, { text: string; soft: string; dot: string }> = {
  red: { text: 'text-tag-red', soft: 'bg-tag-red-soft', dot: 'bg-tag-red' },
  orange: { text: 'text-tag-orange', soft: 'bg-tag-orange-soft', dot: 'bg-tag-orange' },
  amber: { text: 'text-tag-amber', soft: 'bg-tag-amber-soft', dot: 'bg-tag-amber' },
  green: { text: 'text-tag-green', soft: 'bg-tag-green-soft', dot: 'bg-tag-green' },
  blue: { text: 'text-tag-blue', soft: 'bg-tag-blue-soft', dot: 'bg-tag-blue' },
  violet: { text: 'text-tag-violet', soft: 'bg-tag-violet-soft', dot: 'bg-tag-violet' },
  pink: { text: 'text-tag-pink', soft: 'bg-tag-pink-soft', dot: 'bg-tag-pink' },
}

// Orden pensado para que dos proyectos o personas seguidas no caigan en tonos parecidos.
const ORDEN: TagColor[] = ['blue', 'orange', 'violet', 'green', 'pink', 'amber', 'red']

/**
 * Color estable para algo que no tiene color propio (un proyecto, una persona): siempre el
 * mismo para el mismo id/nombre, en esta sesion y en la proxima.
 */
export function colorDe(semilla: string): TagColor {
  let h = 0
  for (let i = 0; i < semilla.length; i++) h = (h * 31 + semilla.charCodeAt(i)) | 0
  return ORDEN[Math.abs(h) % ORDEN.length]
}
