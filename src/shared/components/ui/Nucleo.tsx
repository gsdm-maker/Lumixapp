import type { CSSProperties } from 'react'
import { cx } from '@shared/utils/cx'

interface NucleoProps {
  /** Diametro en px. */
  size?: number
  /** Flota suave (el nucleo grande del saludo). */
  flotar?: boolean
  /** Late mientras Lumix trabaja. */
  pensando?: boolean
  /** Destellos: Lumix tiene algo que sugerir. */
  chispas?: boolean
  className?: string
  /** Texto para lectores de pantalla; sin el, es decorativo. */
  label?: string
}

/**
 * El nucleo de Lumix (rediseno Orbita): una esfera violeta-azul con una orbita punteada que
 * gira. Es el "cuerpo" del agente: flota cuando saluda, late cuando piensa y destella cuando
 * sugiere algo. Animaciones en index.css; se apagan con prefers-reduced-motion.
 */
export function Nucleo({
  size = 32,
  flotar = false,
  pensando = false,
  chispas = false,
  className,
  label,
}: NucleoProps) {
  const orbita = Math.max(4, Math.round(size * 0.14))
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cx('relative inline-block shrink-0', className)}
      style={{
        width: size,
        height: size,
        animation: flotar ? 'nucleo-flotar 5s ease-in-out infinite' : undefined,
      }}
    >
      <span
        className="absolute rounded-full border border-dashed"
        style={{
          inset: -orbita,
          borderColor: 'rgb(150 130 255 / 0.55)',
          animation: 'nucleo-girar 20s linear infinite',
        }}
      >
        {size >= 48 && (
          <span
            className="absolute rounded-full"
            style={{
              top: 4,
              left: '50%',
              width: 7,
              height: 7,
              background: '#c9b8ff',
              boxShadow: '0 0 10px #c9b8ff',
            }}
          />
        )}
      </span>
      <span
        className="absolute inset-0 rounded-full"
        style={{
          background:
            'radial-gradient(circle at 32% 28%, #e3d9ff, #8b6cff 38%, #3d7bff 72%, #14143a)',
          boxShadow: `0 0 ${Math.round(size * 0.55)}px rgb(123 92 255 / 0.5), inset -${Math.round(size * 0.1)}px -${Math.round(size * 0.12)}px ${Math.round(size * 0.28)}px rgb(10 10 40 / 0.5), inset ${Math.round(size * 0.08)}px ${Math.round(size * 0.08)}px ${Math.round(size * 0.2)}px rgb(255 255 255 / 0.35)`,
          animation: pensando ? 'nucleo-latir 1.4s ease-in-out infinite' : undefined,
        }}
      />
      {chispas && (
        <>
          <Chispa style={{ top: 2, right: 0, width: 10, height: 10 }} />
          <Chispa
            style={{ bottom: size * 0.1, left: -6, width: 7, height: 7, animationDelay: '1.1s' }}
          />
        </>
      )}
    </span>
  )
}

function Chispa({ style }: { style: CSSProperties }) {
  return (
    <span
      className="absolute bg-white"
      style={{
        clipPath: 'polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%)',
        animation: 'nucleo-destello 2.6s ease-in-out infinite',
        ...style,
      }}
    />
  )
}
