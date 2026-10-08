import type { NivelCarga } from '@shared/utils/nivelCarga'

const FONDO: Record<NivelCarga, string> = {
  libre: 'radial-gradient(circle at 35% 30%, #c8f5df, #2fbf85 70%)',
  normal: 'radial-gradient(circle at 35% 30%, #e3d9ff, #7b5cff 70%)',
  alta: 'radial-gradient(circle at 35% 30%, #ffe2b8, #f59e0b 70%)',
  saturado: 'radial-gradient(circle at 35% 30%, #ffd0c8, #e5533d 70%)',
}

/**
 * Carita de carga (idea de las caritas por dia de Planius, pero diciendo algo util): verde
 * libre, violeta normal, ambar alta, rojo saturado. Es decorativa: quien la usa muestra tambien
 * el nivel en texto (WCAG 1.4.1: el color no puede ser lo unico).
 */
export function Carita({ nivel, size = 20 }: { nivel: NivelCarga; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="relative inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, background: FONDO[nivel] }}
    >
      <i
        className="absolute rounded-sm bg-white/95"
        style={{ top: size * 0.3, left: size * 0.27, width: size * 0.15, height: size * 0.2 }}
      />
      <i
        className="absolute rounded-sm bg-white/95"
        style={{ top: size * 0.3, right: size * 0.27, width: size * 0.15, height: size * 0.2 }}
      />
    </span>
  )
}
