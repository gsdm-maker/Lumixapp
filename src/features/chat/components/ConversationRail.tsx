import { SectionLabel } from '@shared/components/ui/Indicators'
import { cx } from '@shared/utils/cx'
import type { ResumenDia } from '@features/chat/components/log/registro'
import { textoLumix } from '@features/chat/components/log/registro'

interface Props {
  resumen: ResumenDia
  onJump: (messageId: string) => void
}

function Fila({ label, value, alerta }: { label: string; value: number; alerta?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <span className="text-fg-muted">{label}</span>
      <span
        className={cx(
          'font-semibold tabular-nums',
          alerta && value > 0 ? 'text-warning' : 'text-fg',
        )}
      >
        {value}
      </span>
    </div>
  )
}

/**
 * Costado de escritorio con lo que produjo el chat hoy. Refuerza la idea del brief: "hablo
 * con Lumix para ordenar el trabajo". Se calcula con los mensajes ya cargados.
 */
export function ConversationRail({ resumen, onJump }: Props) {
  const pendientes = resumen.porDecidir
  return (
    <aside
      aria-label="Resumen del día"
      className="hidden lg:flex w-60 shrink-0 flex-col gap-3 overflow-y-auto border-l border-border bg-panel px-4 py-4"
    >
      <SectionLabel>Salió de esta conversación hoy</SectionLabel>
      <div className="flex flex-col gap-2">
        <Fila label="Actividades creadas" value={resumen.actividades} />
        <Fila label="Errores registrados" value={resumen.errores} />
        <Fila label="Movidas de fecha" value={resumen.movidas} />
        <Fila label="Por decidir" value={pendientes.length} alerta />
      </div>

      {pendientes.length > 0 && (
        <>
          <div className="mt-2">
            <SectionLabel>Por decidir</SectionLabel>
          </div>
          <ul className="flex flex-col gap-0.5 -mx-2">
            {pendientes.slice(-6).map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onJump(m.id)}
                  className="w-full rounded-md px-2 py-1 text-left text-xs text-fg-muted hover:bg-surface hover:text-fg line-clamp-2"
                >
                  {textoLumix(m.content).text}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  )
}
