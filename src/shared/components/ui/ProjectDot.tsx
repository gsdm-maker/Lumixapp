import { cx } from '@shared/utils/cx'
import { TAG, colorDe } from '@shared/utils/colores'

/**
 * Punto de color de un proyecto (como los de Todoist): el mismo color en la lista, el detalle,
 * Compromisos y donde aparezca. Sale del id del proyecto, asi que no hay que guardarlo.
 */
export function ProjectDot({ id, className }: { id: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'inline-block w-2.5 h-2.5 rounded-full shrink-0',
        TAG[colorDe(id)].dot,
        className,
      )}
    />
  )
}
