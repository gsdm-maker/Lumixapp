import { useState } from 'react'
import { Button } from '@shared/components/ui/Button'
import { Icon } from '@shared/components/ui/Icon'
import { Nucleo } from '@shared/components/ui/Nucleo'
import { useToast } from '@shared/components/ui/Toast'
import { fmtHoras, hoyYMD } from '@features/gantt/utils/carga'
import { cambiarEntrega } from '@features/compromisos/utils/operaciones'
import type { Sugerencia } from '@features/chat/hooks/usePanelLumix'
import type { MinuteItem } from '@shared/types'

// "Ahora no" vale por el dia: mañana, si vuelve a pasar, Lumix lo vuelve a sugerir.
const CLAVE = 'lumix-sugerencia-descartada'

function descartadaHoy(): boolean {
  try {
    return window.localStorage.getItem(CLAVE) === hoyYMD()
  } catch {
    return false
  }
}

/**
 * "Lumix sugiere" (rediseno Orbita): Lumix toma la iniciativa cuando hoy estas pasado de la
 * capacidad y hay un dia libre mas adelante en la semana; propone mover lo de menor prioridad.
 * No hace nada sin el "Si": mover una fecha es una decision de la persona.
 */
export function SugerenciaLumix({
  sugerencia,
  temas,
  onHecho,
}: {
  sugerencia: Sugerencia | null
  temas: MinuteItem[]
  onHecho: () => void
}) {
  const toast = useToast()
  const [oculta, setOculta] = useState(descartadaHoy)
  const [moviendo, setMoviendo] = useState(false)
  if (!sugerencia || oculta) return null
  const { actividad, hacia, hoy } = sugerencia

  const mover = async () => {
    setMoviendo(true)
    try {
      const antes = actividad.due_date.split('T')[0]
      await cambiarEntrega(actividad, hacia.ymd, temas)
      toast.success(`«${actividad.title}» ahora vence el ${hacia.dia} ${hacia.numero}`, {
        action: {
          label: 'Deshacer',
          onClick: () => {
            cambiarEntrega(actividad, antes, temas)
              .then(onHecho)
              .catch(() => toast.error('No se pudo deshacer'))
          },
        },
      })
      onHecho()
    } catch {
      toast.error('No se pudo mover la actividad')
    } finally {
      setMoviendo(false)
    }
  }

  const ahoraNo = () => {
    try {
      window.localStorage.setItem(CLAVE, hoyYMD())
    } catch {
      /* sin almacenamiento: solo se oculta en esta sesion */
    }
    setOculta(true)
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-3 sm:px-5 pb-2 animate-aparecer">
      <div
        // Borde del acento: es una propuesta de Lumix (el violeta marca lo que viene del agente).
        className="flex flex-wrap items-center gap-3 rounded-3xl p-3.5 bg-panel border border-accent/40"
        role="status"
      >
        <Nucleo size={28} chispas />
        <div className="min-w-0 flex-1 basis-60">
          <p className="flex items-center gap-1.5 text-sm font-bold text-fg">
            <Icon name="sparkles" size={14} className="text-accent" />
            Lumix sugiere
          </p>
          <p className="text-sm text-fg-muted">
            Hoy vienes con {fmtHoras(hoy.horas)} y el {hacia.dia} {hacia.numero} con{' '}
            {fmtHoras(hacia.horas)}. ¿Paso «{actividad.title}» al {hacia.dia}?
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={mover} loading={moviendo}>
            Sí, muévelo
          </Button>
          <Button size="sm" variant="ghost" onClick={ahoraNo} disabled={moviendo}>
            Ahora no
          </Button>
        </div>
      </div>
    </div>
  )
}
