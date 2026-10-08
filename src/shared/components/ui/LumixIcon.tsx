import { Nucleo } from './Nucleo'

interface LumixIconProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE = { sm: 22, md: 30, lg: 42 }

/**
 * Logo de Lumix. Desde el rediseno Orbita es el nucleo del agente (ver Nucleo): el mismo cuerpo
 * que aparece en el chat, asi la marca y el agente son una sola cosa. Antes era un bot plano
 * sobre el acento.
 */
export function LumixIcon({ size = 'md', className }: LumixIconProps) {
  return <Nucleo size={SIZE[size]} label="Lumix" className={className} />
}
