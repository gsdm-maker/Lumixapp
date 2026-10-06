/** "Tomas Valdes Rojas" -> "Tomas V.". Para mostrar personas en espacios chicos. */
export function nombreCorto(full: string): string {
  const partes = full.trim().split(/\s+/)
  if (partes.length < 2) return partes[0] ?? ''
  return `${partes[0]} ${partes[1][0]}.`
}
