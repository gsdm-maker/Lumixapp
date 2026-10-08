// Donde esta encendido el agente del chat. Etapa 1: solo en el Equipo Prueba, para probarlo con
// datos reales sin que los equipos con compañeros reales lo vean (ni reciban sus avisos).
// Para abrirlo a otro equipo, agregar su id; para todos, devolver true.

const EQUIPOS = new Set(['8ac72637-a5a1-4aae-ba17-38fdf013ac7d']) // Equipo Prueba

export function agenteActivo(teamId: string | null | undefined): boolean {
  return !!teamId && EQUIPOS.has(teamId)
}
