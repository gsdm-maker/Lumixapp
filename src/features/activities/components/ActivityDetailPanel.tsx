import { useEffect, useState, type ReactNode } from 'react'
import { activitiesService } from '@infrastructure/supabase/activities.service'
import { profilesService } from '@infrastructure/supabase/profiles.service'
import { teamsService } from '@infrastructure/supabase/teams.service'
import { useAuth } from '@core/auth/hooks/useAuth'
import { useCapabilities } from '@core/auth/hooks/useCapabilities'
import { Button } from '@shared/components/ui/Button'
import { DatePicker } from '@shared/components/ui/DatePicker'
import {
  DueDate,
  PriorityBars,
  PriorityPicker,
  SectionLabel,
} from '@shared/components/ui/Indicators'
import { Textarea } from '@shared/components/ui/Input'
import { SegmentedControl } from '@shared/components/ui/SegmentedControl'
import { SidePanel } from '@shared/components/ui/SidePanel'
import { StatusLabel } from '@shared/components/ui/StatusLabel'
import { useToast } from '@shared/components/ui/Toast'
import { estadoActividad, PRIORITY_LABEL } from '@shared/utils/estados'
import { formatDateLocal } from '@shared/utils/date'
import type { Activity, ActivityStatus, MinuteItem, Profile } from '@shared/types'
import { FECHA_INLINE } from '@features/activities/utils/ui'
import { SubtareasSection } from './SubtareasSection'
import { DelegarSection } from './DelegarSection'

const HORAS = ['1', '2', '3', '4', '5', '8', '12']

interface ActivityDetailPanelProps {
  activity: Activity | null
  /** Pila de "desde donde entre" al abrir subtareas, para volver nivel por nivel. */
  parentStack: Activity[]
  onBack: () => void
  onOpenChild: (c: Activity) => void
  onClose: () => void
  /** La actividad abierta cambio (se edito un campo): refrescar la copia de la pagina. */
  onUpdated: (a: Activity) => void
  proyectoItems: MinuteItem[]
  allActivities: Activity[]
  managedIds: string[]
  teamNames: Record<string, string>
  nombrePersona: (id: string) => string
  reload: () => void
  cambiarEstado: (a: Activity, status: ActivityStatus) => Promise<void>
  eliminar: (a: Activity) => void
}

/**
 * Detalle de una actividad en panel lateral (idea 8). Reemplaza al modal: en escritorio la
 * lista sigue a la vista y se puede recorrer con las flechas mientras el panel cambia.
 *
 * El panel NO se remonta al cambiar de actividad (moveria el foco y cortaria la navegacion con
 * flechas); lo que tiene formularios propios se monta con key por actividad para partir limpio.
 */
export function ActivityDetailPanel(props: ActivityDetailPanelProps) {
  const { activity, parentStack, proyectoItems, allActivities, managedIds } = props
  const { profile, user } = useAuth()
  const { canDeleteActivities, canEditAllActivities, canManageProyectos } = useCapabilities()
  const toast = useToast()

  // Equipos que lidera (para delegar), excluyendo el equipo activo.
  const [managedTeams, setManagedTeams] = useState<{ id: string; name: string }[]>([])
  useEffect(() => {
    if (!user) return
    teamsService
      .getManagedTeams(user.id)
      .then((ts) => setManagedTeams(ts.filter((t) => t.id !== profile?.team_id)))
      .catch(() => {})
  }, [user, profile?.team_id])

  // Hijas (parent_activity_id) y nombres de personas. Se guardan junto al id de la actividad
  // a la que pertenecen: al pasar a otra no se ven las de la anterior mientras carga, sin
  // tener que limpiar el estado a mano en el effect.
  const [hijas, setHijas] = useState<{
    forId: string
    kids: Activity[]
    names: Record<string, string>
    subMembers: Profile[]
  } | null>(null)
  const activityId = activity?.id
  const activityTeam = activity?.team_id
  useEffect(() => {
    if (!activityId || !activityTeam) return
    let cancelled = false
    activitiesService
      .getByParent(activityId)
      .then(async (kids) => {
        if (cancelled) return
        // Miembros del propio equipo (para agregar subtareas) + de los equipos de cada hija
        // ya existente (para mostrar su nombre), en un solo set de nombres.
        const teamIds = [...new Set([activityTeam, ...kids.map((k) => k.team_id)])]
        // En paralelo: el panel cambia de actividad al recorrer la lista con las flechas, y una
        // consulta por equipo en serie se notaba con hijas delegadas a otros equipos.
        const porEquipo = await Promise.all(teamIds.map((tid) => profilesService.getByTeam(tid)))
        const names: Record<string, string> = {}
        porEquipo.flat().forEach((m) => (names[m.id] = m.full_name))
        const subMembers: Profile[] = porEquipo[teamIds.indexOf(activityTeam)] ?? []
        if (!cancelled) setHijas({ forId: activityId, kids, names, subMembers })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [activityId, activityTeam])

  if (!activity) return null

  const propias = hijas?.forId === activity.id ? hijas : null
  const children = propias?.kids ?? []
  const childNames = propias?.names ?? {}

  const agregarHija = (child: Activity, memberId: string, nombre: string | undefined) =>
    setHijas((h) =>
      h && h.forId === activity.id
        ? {
            ...h,
            kids: [...h.kids, child],
            names: nombre ? { ...h.names, [memberId]: nombre } : h.names,
          }
        : h,
    )

  // Editable si NO esta cerrada y sos el responsable, lideras el equipo de esa actividad, o
  // tenes "editar actividades ajenas" en ese equipo (el permiso se resuelve contra el equipo
  // activo, por eso solo vale para actividades de ese equipo; la RLS lo exige igual, 049).
  const canEdit =
    activity.status !== 'completado' &&
    (activity.responsible_id === profile?.id ||
      managedIds.includes(activity.team_id) ||
      (canEditAllActivities && activity.team_id === profile?.team_id))

  // Item del proyecto al que esta vinculada la actividad abierta (null si no viene de uno).
  const itemPadre = proyectoItems.find((i) => i.linked_activity_ids.includes(activity.id)) ?? null
  // Subtareas a listar: las de parent_activity_id (delegadas / creadas antes) + las
  // actividades de los items hijos en el proyecto, sin repetir.
  const hijosProyecto = itemPadre
    ? proyectoItems
        .filter((i) => i.parent_item_id === itemPadre.id)
        .flatMap((i) => i.linked_activity_ids)
        .map((id) => allActivities.find((a) => a.id === id))
        .filter((a): a is Activity => !!a)
    : []
  const subtareas = [
    ...children,
    ...hijosProyecto.filter((h) => !children.some((c) => c.id === h.id)),
  ]

  // Contexto para la linea sobre el titulo: equipo y el nivel inmediatamente superior
  // (el item padre en el proyecto, o la actividad padre), igual que la linea gris de la lista.
  const padreItem = itemPadre?.parent_item_id
    ? proyectoItems.find((i) => i.id === itemPadre.parent_item_id)
    : undefined
  const padreAct = activity.parent_activity_id
    ? allActivities.find((a) => a.id === activity.parent_activity_id)
    : undefined
  const nivel = padreItem?.tema || padreAct?.title || null
  const equipo = props.teamNames[activity.team_id]
  const eyebrow = [equipo, nivel].filter(Boolean).join(' › ') || null

  const actualizar = async (campos: Partial<Activity>) => {
    try {
      await activitiesService.update(activity.id, campos)
      props.onUpdated({ ...activity, ...campos })
      props.reload()
    } catch {
      toast.error('No se pudo guardar el cambio')
    }
  }

  const movida = activity.plazo_change_count ?? 0
  const anterior = parentStack[parentStack.length - 1]

  return (
    <SidePanel
      open
      onClose={props.onClose}
      eyebrow={eyebrow}
      title={activity.title}
      footer={
        <AccionesEstado
          key={activity.id}
          activity={activity}
          canDelete={canDeleteActivities}
          cambiarEstado={props.cambiarEstado}
          guardarMotivo={(motivo) =>
            activitiesService.update(activity.id, { observations: motivo })
          }
          eliminar={props.eliminar}
        />
      }
    >
      <div className="space-y-5">
        {anterior && (
          <Button
            size="xs"
            variant="ghost"
            icon="arrowLeft"
            onClick={props.onBack}
            className="-ml-2 max-w-full"
          >
            <span className="truncate">Volver a "{anterior.title}"</span>
          </Button>
        )}

        <dl className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 text-sm">
          <Dato label="Estado">
            <StatusLabel {...estadoActividad(activity.status, activity.due_date)} />
          </Dato>
          <Dato label="Responsable">
            <span className="text-fg">{props.nombrePersona(activity.responsible_id)}</span>
          </Dato>
          <Dato label="Entrega">
            <span className="flex flex-wrap items-center gap-2">
              {canEdit ? (
                <DatePicker
                  value={activity.due_date.split('T')[0]}
                  onChange={(v) => {
                    if (v) void actualizar({ due_date: new Date(v).toISOString() })
                  }}
                  className={FECHA_INLINE}
                />
              ) : (
                <span className="text-fg">{formatDateLocal(activity.due_date)}</span>
              )}
              <DueDate
                date={activity.due_date}
                done={activity.status === 'completado'}
                className="text-xs"
              />
            </span>
          </Dato>
          <Dato label="Prioridad">
            {canEdit ? (
              <PriorityPicker
                value={activity.priority}
                onChange={(p) => actualizar({ priority: p })}
              />
            ) : (
              <span className="inline-flex items-center gap-2 text-fg">
                <PriorityBars priority={activity.priority} />
                {PRIORITY_LABEL[activity.priority]}
              </span>
            )}
          </Dato>
          {(canEdit || activity.estimated_hours) && (
            <Dato label="Horas estimadas">
              {canEdit ? (
                <SegmentedControl
                  label="Horas estimadas"
                  value={String(activity.estimated_hours ?? 3)}
                  onChange={(h) => actualizar({ estimated_hours: Number(h) })}
                  options={HORAS.map((h) => ({ value: h, label: h }))}
                />
              ) : (
                <span className="text-fg">{activity.estimated_hours} h</span>
              )}
            </Dato>
          )}
          {movida > 0 && (
            <Dato label="Fecha movida">
              <span
                className="text-warning"
                title="Veces que se movió la fecha de entrega desde que se creó"
              >
                {movida} {movida === 1 ? 'vez' : 'veces'}
              </span>
            </Dato>
          )}
          <Dato label="Creada">
            <span className="text-fg-muted">{formatDateLocal(activity.created_at)}</span>
          </Dato>
          {activity.completed_at && (
            <Dato label="Cerrada">
              <span className="text-fg-muted">{formatDateLocal(activity.completed_at)}</span>
            </Dato>
          )}
        </dl>

        <section className="space-y-1.5">
          <SectionLabel>Descripción</SectionLabel>
          {canEdit ? (
            <Textarea
              key={activity.id}
              aria-label="Descripción"
              defaultValue={activity.description || ''}
              onBlur={(e) => {
                if (e.target.value !== (activity.description || '')) {
                  void actualizar({ description: e.target.value })
                }
              }}
              rows={2}
              placeholder="Sin descripción"
            />
          ) : (
            <p className="text-sm text-fg-body whitespace-pre-wrap">
              {activity.description || <span className="text-fg-faint">Sin descripción</span>}
            </p>
          )}
        </section>

        {/* key con el texto: si cambia desde afuera (ej. el motivo de un bloqueo), el campo
            vuelve a partir del valor guardado. */}
        <Observaciones
          key={`${activity.id}:${activity.observations ?? ''}`}
          inicial={activity.observations || ''}
          guardar={(v) => actualizar({ observations: v })}
        />

        <SubtareasSection
          key={`sub-${activity.id}`}
          activity={activity}
          userId={user?.id}
          itemPadre={itemPadre}
          proyectoItems={proyectoItems}
          subtareas={subtareas}
          nombres={childNames}
          subMembers={propias?.subMembers ?? []}
          nombreEquipo={(tid) => managedTeams.find((t) => t.id === tid)?.name || 'otro equipo'}
          canEdit={canEdit}
          canManageProyectos={canManageProyectos}
          onOpenChild={props.onOpenChild}
          onCreada={agregarHija}
          reload={props.reload}
        />

        <DelegarSection
          key={`del-${activity.id}`}
          activity={activity}
          userId={user?.id}
          managedTeams={managedTeams}
          onDelegada={agregarHija}
        />
      </div>
    </SidePanel>
  )
}

function Dato({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-fg-faint">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  )
}

function Observaciones({ inicial, guardar }: { inicial: string; guardar: (v: string) => void }) {
  const [valor, setValor] = useState(inicial)
  const [abierta, setAbierta] = useState(!!inicial)

  if (!abierta) {
    return (
      <Button
        size="xs"
        variant="ghost"
        icon="plus"
        className="-ml-2"
        onClick={() => setAbierta(true)}
      >
        Agregar observación
      </Button>
    )
  }
  return (
    <section className="space-y-1.5">
      <SectionLabel>Observaciones</SectionLabel>
      <Textarea
        aria-label="Observaciones"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onBlur={() => {
          if (valor !== inicial) guardar(valor)
        }}
        placeholder="Agregar observación…"
        rows={2}
        autoFocus={!inicial}
      />
    </section>
  )
}

/**
 * Acciones de estado al pie del panel. "Bloquear" pide el motivo en un formulario chico en el
 * mismo pie (antes abria una segunda ventana encima del modal). El motivo queda en
 * observaciones, como antes.
 */
function AccionesEstado({
  activity,
  canDelete,
  cambiarEstado,
  guardarMotivo,
  eliminar,
}: {
  activity: Activity
  canDelete: boolean
  cambiarEstado: (a: Activity, status: ActivityStatus) => Promise<void>
  guardarMotivo: (motivo: string) => Promise<unknown>
  eliminar: (a: Activity) => void
}) {
  const toast = useToast()
  const [bloqueando, setBloqueando] = useState(false)
  const [motivo, setMotivo] = useState(activity.observations || '')
  const [ocupado, setOcupado] = useState<ActivityStatus | null>(null)

  const cambiar = async (status: ActivityStatus) => {
    setOcupado(status)
    try {
      await cambiarEstado(activity, status)
    } finally {
      setOcupado(null)
    }
  }

  const bloquear = async () => {
    setOcupado('bloqueado')
    try {
      if (motivo.trim()) await guardarMotivo(motivo.trim())
      await cambiarEstado(activity, 'bloqueado')
      setBloqueando(false)
    } catch {
      toast.error('No se pudo guardar el motivo')
    } finally {
      setOcupado(null)
    }
  }

  if (bloqueando) {
    return (
      <div className="w-full space-y-2">
        <Textarea
          label="Motivo del bloqueo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ej: Falta información del cliente…"
          rows={2}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={() => setBloqueando(false)}>
            Cancelar
          </Button>
          <Button size="sm" variant="danger" loading={ocupado === 'bloqueado'} onClick={bloquear}>
            Bloquear
          </Button>
        </div>
      </div>
    )
  }

  const s = activity.status
  return (
    <>
      {s === 'pendiente' && (
        <Button
          size="sm"
          icon="play"
          loading={ocupado === 'en_proceso'}
          onClick={() => cambiar('en_proceso')}
        >
          Iniciar
        </Button>
      )}
      {s === 'en_proceso' && (
        <>
          <Button
            size="sm"
            icon="check"
            loading={ocupado === 'completado'}
            onClick={() => cambiar('completado')}
          >
            Completar
          </Button>
          <Button size="sm" variant="secondary" icon="pause" onClick={() => setBloqueando(true)}>
            Bloquear
          </Button>
        </>
      )}
      {s === 'bloqueado' && (
        <Button
          size="sm"
          icon="play"
          loading={ocupado === 'en_proceso'}
          onClick={() => cambiar('en_proceso')}
        >
          Desbloquear
        </Button>
      )}
      {s === 'completado' && (
        <Button
          size="sm"
          variant="secondary"
          icon="undo"
          loading={ocupado === 'pendiente'}
          onClick={() => cambiar('pendiente')}
        >
          Reabrir
        </Button>
      )}
      {/* Eliminar solo aparece con permiso y siempre pide confirmacion: es lo unico de esta
          pantalla que no se puede revertir. */}
      {canDelete && (
        <Button
          size="sm"
          variant="ghost"
          icon="trash"
          className="ml-auto hover:text-danger"
          onClick={() => eliminar(activity)}
        >
          Eliminar
        </Button>
      )}
    </>
  )
}
