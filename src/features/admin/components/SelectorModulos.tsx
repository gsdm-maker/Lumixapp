import { MODULOS } from '@core/auth/modulos'
import { Icon } from '@shared/components/ui/Icon'
import { cx } from '@shared/utils/cx'

/**
 * Fichas para encender o apagar los modulos de Lumix (migracion 056). El chat siempre esta y
 * se muestra fijo. Cada toque avisa la lista nueva, en el orden de MODULOS.
 */
export function SelectorModulos({
  value,
  onChange,
  disabled = false,
}: {
  value: string[]
  onChange: (modulos: string[]) => void
  disabled?: boolean
}) {
  const alternar = (key: string) => {
    const nueva = value.includes(key) ? value.filter((m) => m !== key) : [...value, key]
    onChange(MODULOS.map((m) => m.key).filter((k) => nueva.includes(k)))
  }

  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Módulos">
      <li>
        <span
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-xs font-semibold text-fg-muted"
          title="El chat con Lumix siempre está"
        >
          <Icon name="chat" size={13} className="text-accent" />
          Chat · siempre
        </span>
      </li>
      {MODULOS.map((m) => {
        const on = value.includes(m.key)
        return (
          <li key={m.key}>
            <button
              type="button"
              aria-pressed={on}
              disabled={disabled}
              onClick={() => alternar(m.key)}
              title={m.descripcion}
              className={cx(
                'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors disabled:opacity-50',
                on
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-border bg-panel text-fg-muted hover:text-fg',
              )}
            >
              <Icon name={on ? 'check' : m.icon} size={13} />
              {m.label}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
