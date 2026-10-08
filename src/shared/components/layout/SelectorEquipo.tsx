import { Desplegable, OpcionMenu } from '@shared/components/ui/Desplegable'
import { Icon } from '@shared/components/ui/Icon'
import { Spinner } from '@shared/components/ui/Spinner'
import { useAuth } from '@core/auth/hooks/useAuth'
import { colorDe, TAG } from '@shared/utils/colores'
import { cx } from '@shared/utils/cx'
import { useEquipos } from './useEquipos'

/** Inicial del equipo sobre su color (siempre el mismo para el mismo equipo). */
function Insignia({ id, nombre, size = 'md' }: { id: string; nombre: string; size?: 'sm' | 'md' }) {
  const c = TAG[colorDe(id)]
  return (
    <span
      aria-hidden="true"
      className={cx(
        'grid place-items-center shrink-0 rounded-lg font-bold',
        c.soft,
        c.text,
        size === 'sm' ? 'w-6 h-6 text-2xs' : 'w-7 h-7 text-xs',
      )}
    >
      {nombre.trim().charAt(0).toUpperCase()}
    </span>
  )
}

/**
 * Equipo activo, siempre a la vista junto a la marca. Quien tiene mas de un equipo (o el admin)
 * lo cambia aca mismo; al cambiar, la pantalla se vuelve a montar con los datos del equipo nuevo
 * (ver AppLayout). Compacto: solo la insignia, con el nombre en el tooltip.
 */
export function SelectorEquipo({
  compacto = false,
  abrirHacia = 'abajo',
}: {
  compacto?: boolean
  abrirHacia?: 'abajo' | 'izquierda' | 'derecha'
}) {
  const { profile } = useAuth()
  const { teams, equipoActual, puedeCambiar, cambiarEquipo, switching } = useEquipos()
  // Mientras cargan los equipos: un lugar del mismo tamaño (sin que la barra salte despues).
  if (!equipoActual)
    return (
      <span
        aria-hidden="true"
        className={cx(
          'vidrio block rounded-full animate-pulse',
          compacto ? 'w-10 h-10' : 'h-10 w-40',
        )}
      />
    )

  const contenido = (
    <>
      <Insignia id={equipoActual.id} nombre={equipoActual.name} />
      {!compacto && (
        <span className="min-w-0 truncate text-sm font-semibold text-fg">{equipoActual.name}</span>
      )}
      {switching ? (
        <Spinner size={14} />
      ) : (
        !compacto &&
        puedeCambiar && <Icon name="chevronDown" size={14} className="shrink-0 text-fg-faint" />
      )}
    </>
  )

  if (!puedeCambiar)
    return (
      <span
        title={`Equipo: ${equipoActual.name}`}
        className={cx(
          'vidrio flex items-center gap-2 rounded-full',
          compacto ? 'p-1.5' : 'h-10 pl-1.5 pr-3.5 max-w-52',
        )}
      >
        {contenido}
      </span>
    )

  return (
    <Desplegable
      label={`Equipo activo: ${equipoActual.name}. Cambiar de equipo`}
      abrirHacia={abrirHacia}
      alinear="izquierda"
      panelClassName="w-64"
      botonClassName={cx(
        'vidrio flex items-center gap-2 rounded-full transition-colors hover:border-border-strong disabled:opacity-60',
        compacto ? 'p-1.5' : 'h-10 pl-1.5 pr-3 max-w-56',
      )}
      boton={contenido}
    >
      {(cerrar) => (
        <>
          <p className="px-3 pt-1.5 pb-1 etiqueta-orbita">Cambiar de equipo</p>
          {teams.map((t) => {
            const activo = t.id === profile?.team_id
            return (
              <OpcionMenu
                key={t.id}
                onClick={() => {
                  cerrar()
                  if (!activo && !switching) cambiarEquipo(t.id)
                }}
                className={activo ? 'bg-surface font-semibold' : undefined}
              >
                <Insignia id={t.id} nombre={t.name} size="sm" />
                <span className="flex-1 truncate">{t.name}</span>
                {activo && <Icon name="check" size={15} className="text-accent" />}
              </OpcionMenu>
            )
          })}
        </>
      )}
    </Desplegable>
  )
}
