import { useState } from 'react'
import { activitiesService } from '@infrastructure/supabase/activities.service'
import { minutesService } from '@infrastructure/supabase/minutes.service'
import { Button } from '@shared/components/ui/Button'
import { DatePicker } from '@shared/components/ui/DatePicker'
import { PriorityPicker, SectionLabel } from '@shared/components/ui/Indicators'
import { FieldLabel, Input, Select } from '@shared/components/ui/Input'
import { StatusLabel } from '@shared/components/ui/StatusLabel'
import { useToast } from '@shared/components/ui/Toast'
import { estadoActividad } from '@shared/utils/estados'
import { cx } from '@shared/utils/cx'
import type { Activity, MinuteItem, Profile } from '@shared/types'
import { crearActividad } from '@features/activities/utils/crearActividad'
import { FECHA_CAMPO } from '@features/activities/utils/ui'
import { CheckMinuta } from './AssignActivityModal'

interface SubtareasSectionProps {
  activity: Activity
  userId: string | undefined
  /** Item del proyecto vinculado a la actividad abierta (null si no viene de uno). */
  itemPadre: MinuteItem | null
  proyectoItems: MinuteItem[]
  subtareas: Activity[]
  nombres: Record<string, string>
  /** Miembros del equipo de la actividad: a quien se le puede asignar la subtarea. */
  subMembers: Profile[]
  /** Nombre del equipo de una subtarea de otro equipo (delegada). */
  nombreEquipo: (teamId: string) => string
  canEdit: boolean
  canManageProyectos: boolean
  onOpenChild: (c: Activity) => void
  /** Subtarea normal creada: se agrega a la lista sin recargar todo. */
  onCreada: (child: Activity, memberId: string, nombre: string | undefined) => void
  reload: () => void
}

/**
 * Subtareas: proyectos con varios niveles (ej. "Revisar capacidad" -> "ver faena" -> "ajustar
 * capacidad de faena"). Mismo equipo, cualquiera que pueda editar la actividad. Cada hija se
 * abre con su propio detalle -y sus propias hijas-, asi que la profundidad no tiene limite
 * fijo en la UI.
 *
 * Comparten la tabla y el mecanismo con delegar -misma parent_activity_id, mismo
 * crearActividad- asi que un tema de minuta en cualquier nivel sigue alimentando Compromisos.
 */
export function SubtareasSection({
  activity,
  userId,
  itemPadre,
  proyectoItems,
  subtareas,
  nombres,
  subMembers,
  nombreEquipo,
  canEdit,
  canManageProyectos,
  onOpenChild,
  onCreada,
  reload,
}: SubtareasSectionProps) {
  const toast = useToast()
  const [abierto, setAbierto] = useState(false)
  const [title, setTitle] = useState('')
  const [member, setMember] = useState('')
  const [priority, setPriority] = useState(activity.priority)
  const [due, setDue] = useState(activity.due_date.split('T')[0])
  // Solo cuando la actividad padre viene de un Proyecto: ahi la subtarea tambien se crea como
  // item del proyecto, que se planifica con inicio y termino (igual que al asignar desde
  // Proyectos), asi que el inicio es obligatorio.
  const [inicio, setInicio] = useState('')
  const [toMinuta, setToMinuta] = useState(false)
  const [busy, setBusy] = useState(false)

  // Fechas YYYY-MM-DD: comparar como texto ordena igual que comparar fechas.
  const fechasInvertidas = !!inicio && !!due && inicio > due
  const fechasInvalidas = !!itemPadre && (!inicio || !due || fechasInvertidas)
  // Crear el item en el proyecto exige proyectos.gestionar (o lider/admin) en la RLS
  // (puede_escribir_hoja, migracion 049). Sin eso el insert fallaria despues de crear la
  // actividad: mejor no ofrecerlo.
  const puedeAgregar = canEdit && (!itemPadre || canManageProyectos)

  const abrir = () => {
    setAbierto(true)
    setPriority(activity.priority)
    setDue(activity.due_date.split('T')[0])
    setInicio('')
  }

  const limpiar = () => {
    setAbierto(false)
    setTitle('')
    setMember('')
    setInicio('')
  }

  // Subtarea del mismo proyecto/actividad, dentro del MISMO equipo: a diferencia de delegar,
  // cualquiera que pueda editar la actividad la puede usar (no exige liderar otro equipo), y
  // el titulo es propio -no el de la actividad padre-.
  const crear = async () => {
    if (!userId || !member || !title.trim()) return
    if (itemPadre) return crearEnProyecto(itemPadre)
    setBusy(true)
    try {
      const dueISO = due ? new Date(due).toISOString() : activity.due_date
      const child = await crearActividad(
        {
          teamId: activity.team_id,
          memberId: member,
          title: title.trim(),
          description: '',
          priority,
          dueISO,
          addToMinuta: toMinuta,
          parentId: activity.id,
          observations: `Subtarea de: ${activity.title}`,
        },
        userId,
      )
      onCreada(child, member, subMembers.find((m) => m.id === member)?.full_name)
      limpiar()
      toast.success(toMinuta ? 'Subtarea creada y agregada a la minuta' : 'Subtarea creada')
    } catch {
      toast.error('No se pudo crear la subtarea')
    } finally {
      setBusy(false)
    }
  }

  // Subtarea de una actividad que viene de un Proyecto: se crea como item hijo en el proyecto
  // (Lista, Tablero y Cronograma la muestran) vinculado a su actividad, igual que si se
  // hubiera asignado desde Proyectos. SIN parent_activity_id a proposito: ese campo dispara
  // el cierre automatico del padre (migracion 025), y en Proyectos cada actividad se cierra
  // por su cuenta. La relacion padre-hija se lee del arbol del proyecto (ver utils/arbol.ts).
  const crearEnProyecto = async (padre: MinuteItem) => {
    if (!userId || fechasInvalidas) return
    setBusy(true)
    try {
      let raiz = padre
      while (raiz.parent_item_id) {
        const p = proyectoItems.find((i) => i.id === raiz.parent_item_id)
        if (!p) break
        raiz = p
      }
      const child = await crearActividad(
        {
          teamId: activity.team_id,
          memberId: member,
          title: title.trim(),
          description: '',
          priority,
          dueISO: new Date(due + 'T00:00:00').toISOString(),
          addToMinuta: toMinuta,
          observations: `Origen: Proyecto: ${raiz.tema}`,
        },
        userId,
      )
      try {
        await minutesService.create({
          team_id: padre.team_id,
          tipo: 'proyecto',
          orden: proyectoItems.filter((i) => i.team_id === padre.team_id).length,
          tema: title.trim(),
          para_todos: false,
          responsables: [member],
          responsables_text: '',
          estado: 'en_desarrollo',
          plazo: due,
          fecha_inicio: inicio,
          prioridad: priority,
          comentarios: '',
          linked_activity_ids: [child.id],
          created_by: userId,
          parent_item_id: padre.id,
        })
      } catch (err) {
        // Sin el item, la actividad quedaria suelta y fuera del proyecto: se deshace.
        await activitiesService.remove(child.id).catch(() => {})
        throw err
      }
      limpiar()
      // La hija aparece en la lista via el arbol del proyecto (hijosProyecto), que se lee de
      // la recarga; por eso no se agrega a mano como en la subtarea normal.
      reload()
      toast.success(
        toMinuta
          ? 'Subtarea creada en el proyecto y en la minuta'
          : 'Subtarea creada en el proyecto',
      )
    } catch {
      toast.error('No se pudo crear la subtarea')
    } finally {
      setBusy(false)
    }
  }

  // Sin hijas y sin poder crear: la seccion no aporta nada.
  if (subtareas.length === 0 && !canEdit) return null

  const hechas = subtareas.filter((s) => s.status === 'completado').length

  return (
    <section className="space-y-2">
      <SectionLabel
        action={
          !abierto &&
          puedeAgregar && (
            <Button size="xs" variant="ghost" icon="plus" onClick={abrir}>
              Agregar subtarea
            </Button>
          )
        }
      >
        Subtareas
        {subtareas.length > 0 && (
          <span className="ml-1 font-normal normal-case tracking-normal">
            · {hechas} de {subtareas.length}
          </span>
        )}
      </SectionLabel>

      {canEdit && !!itemPadre && !canManageProyectos && (
        <p className="text-xs text-fg-faint">
          Esta actividad es de un proyecto: sus subtareas las agrega quien gestiona proyectos.
        </p>
      )}

      {subtareas.length > 0 && (
        <ul className="border border-border rounded-md divide-y divide-border">
          {subtareas.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onOpenChild(c)}
                className="w-full flex items-start justify-between gap-3 px-2.5 py-1.5 text-left hover:bg-surface"
              >
                <span className="min-w-0">
                  <span
                    className={cx(
                      'block text-sm break-words',
                      c.status === 'completado' ? 'text-fg-muted' : 'text-fg',
                    )}
                  >
                    {c.title}
                  </span>
                  <span className="block text-xs text-fg-faint">
                    {nombres[c.responsible_id] || 'Miembro'}
                    {c.team_id !== activity.team_id && ` · ${nombreEquipo(c.team_id)}`}
                  </span>
                </span>
                <StatusLabel {...estadoActividad(c.status, c.due_date)} className="mt-0.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {abierto && (
        <div className="space-y-3 rounded-md border border-border-strong bg-surface-soft p-3">
          <Input
            label="Título de la subtarea"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Ver faena"
          />
          <Select label="Asignar a" value={member} onChange={(e) => setMember(e.target.value)}>
            <option value="">Elegir persona…</option>
            {subMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name}
              </option>
            ))}
          </Select>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Prioridad</FieldLabel>
            <PriorityPicker value={priority} onChange={setPriority} />
          </div>
          {itemPadre ? (
            <div className="space-y-1.5">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Inicio</FieldLabel>
                  <DatePicker
                    value={inicio || null}
                    onChange={(v) => setInicio(v ?? '')}
                    className={FECHA_CAMPO}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Término (entrega)</FieldLabel>
                  <DatePicker
                    value={due || null}
                    onChange={(v) => setDue(v ?? '')}
                    className={FECHA_CAMPO}
                  />
                </div>
              </div>
              <p className={cx('text-xs', fechasInvalidas ? 'text-warning' : 'text-fg-faint')}>
                {fechasInvertidas
                  ? 'El inicio no puede ser posterior al término'
                  : fechasInvalidas
                    ? 'Define inicio y término para poder crearla'
                    : 'También quedará como subtarea en el proyecto'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <FieldLabel>Fecha de entrega</FieldLabel>
              <DatePicker
                value={due || null}
                onChange={(v) => setDue(v ?? '')}
                className={FECHA_CAMPO}
              />
            </div>
          )}
          <CheckMinuta checked={toMinuta} onChange={setToMinuta} />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={limpiar}>
              Cancelar
            </Button>
            <Button
              size="sm"
              loading={busy}
              disabled={!member || !title.trim() || fechasInvalidas}
              onClick={crear}
            >
              Crear subtarea
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
