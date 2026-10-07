import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Command } from 'cmdk'
import * as Dialog from '@radix-ui/react-dialog'
import { useAuth } from '@core/auth/hooks/useAuth'
import { useCapabilities } from '@core/auth/hooks/useCapabilities'
import type { Capability } from '@core/auth/capabilities'
import { useTheme } from '@core/theme/ThemeContext'
import { activitiesService } from '@infrastructure/supabase/activities.service'
import { minutesService } from '@infrastructure/supabase/minutes.service'
import { Icon, type IconName } from '@shared/components/ui/Icon'
import { ProjectDot } from '@shared/components/ui/ProjectDot'
import { DueDate } from '@shared/components/ui/Indicators'
import { useCapaEnPila } from '@shared/hooks/useOverlay'
import { TAG } from '@shared/utils/colores'
import type { Activity, MinuteItem } from '@shared/types'
import { navItems } from './navItems'
import { EVENTO_PALETA } from './paletaEventos'

// Tipos que se pueden crear desde la paleta: abren el chat con ese tipo ya elegido (el chat es
// donde Lumix entiende y crea; la paleta solo acorta el camino). Cada uno se ofrece solo a quien
// puede crearlo, con el mismo permiso que pide el chat o el modulo.
const CREAR: { tipo: string; label: string; icon: IconName; color: string; cap?: Capability }[] = [
  { tipo: 'actividad', label: 'Nueva actividad', icon: 'list', color: TAG.blue.text },
  {
    tipo: 'error',
    label: 'Registrar un error',
    icon: 'bug',
    color: TAG.red.text,
    cap: 'modulos.errores',
  },
  {
    tipo: 'minuta',
    label: 'Tema para la minuta',
    icon: 'clipboard',
    color: TAG.amber.text,
    cap: 'minuta.gestionar',
  },
  {
    tipo: 'proyecto',
    label: 'Nuevo proyecto',
    icon: 'folder',
    color: TAG.violet.text,
    cap: 'proyectos.gestionar',
  },
]

const ITEM =
  'flex items-center gap-2.5 h-9 px-2.5 rounded-md text-sm text-fg cursor-pointer select-none data-[selected=true]:bg-surface'

/**
 * Paleta de comandos (Ctrl+K / Cmd+K), al estilo de shadcn/ui: buscar actividades y proyectos,
 * crear, ir a cualquier modulo y cambiar el tema, sin tocar el mouse. Vive en AppLayout; se abre
 * con el atajo o con abrirPaletaDeComandos().
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [actividades, setActividades] = useState<Activity[]>([])
  const [proyectos, setProyectos] = useState<MinuteItem[]>([])
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const { can, canViewAllActivities } = useCapabilities()
  const { theme, setPreference } = useTheme()
  useCapaEnPila(open)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    const abrir = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener(EVENTO_PALETA, abrir)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(EVENTO_PALETA, abrir)
    }
  }, [])

  // Datos para buscar: se cargan al abrir (siempre frescos) y solo del equipo activo. Quien no
  // ve a todo el equipo solo encuentra lo suyo, igual que en el resto de la app.
  const teamId = profile?.team_id
  useEffect(() => {
    if (!open || !teamId) return
    let cancelado = false
    Promise.all([activitiesService.getByTeam(teamId), minutesService.getByTeam(teamId, 'proyecto')])
      .then(([acts, items]) => {
        if (cancelado) return
        setActividades(
          acts
            .filter((a) => a.status !== 'completado')
            .filter((a) => canViewAllActivities || a.responsible_id === user?.id),
        )
        setProyectos(items.filter((i) => !i.parent_item_id))
      })
      .catch(() => {})
    return () => {
      cancelado = true
    }
  }, [open, teamId, canViewAllActivities, user?.id])

  const ir = (ruta: string, state?: unknown) => {
    setOpen(false)
    navigate(ruta, state ? { state } : undefined)
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/30 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed z-[70] left-1/2 top-[12vh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-panel shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 duration-150"
        >
          <Dialog.Title className="sr-only">Paleta de comandos</Dialog.Title>
          <Command loop className="flex flex-col">
            <div className="flex items-center gap-2.5 px-3.5 border-b border-border">
              <Icon name="search" size={16} className="text-fg-faint" />
              <Command.Input
                autoFocus
                placeholder="Busca una actividad o proyecto, o escribe qué quieres hacer…"
                className="flex-1 h-12 bg-transparent text-base sm:text-sm text-fg placeholder:text-fg-faint outline-none"
              />
              <kbd className="hidden sm:inline font-mono text-2xs text-fg-faint border border-border rounded px-1">
                Esc
              </kbd>
            </div>
            <Command.List className="max-h-[60vh] overflow-y-auto p-1.5 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-fg-faint">
              <Command.Empty className="py-8 text-center text-sm text-fg-faint">
                No encontré nada con eso.
              </Command.Empty>

              <Command.Group heading="Crear">
                {CREAR.filter((c) => !c.cap || can(c.cap)).map((c) => (
                  <Command.Item
                    key={c.tipo}
                    value={`crear ${c.label}`}
                    onSelect={() => ir('/chat', { tipo: c.tipo })}
                    className={ITEM}
                  >
                    <Icon name={c.icon} size={16} className={c.color} />
                    {c.label}
                  </Command.Item>
                ))}
              </Command.Group>

              {actividades.length > 0 && (
                <Command.Group heading="Actividades">
                  {actividades.slice(0, 200).map((a) => (
                    <Command.Item
                      key={a.id}
                      value={`actividad ${a.title} ${a.id}`}
                      onSelect={() => ir('/activities', { activityId: a.id })}
                      className={ITEM}
                    >
                      <Icon name="list" size={16} className="text-fg-faint" />
                      <span className="flex-1 truncate">{a.title}</span>
                      <DueDate date={a.due_date} className="text-xs" />
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {proyectos.length > 0 && (
                <Command.Group heading="Proyectos">
                  {proyectos.map((p) => (
                    <Command.Item
                      key={p.id}
                      value={`proyecto ${p.tema} ${p.id}`}
                      onSelect={() => ir(`/proyectos/${p.id}`)}
                      className={ITEM}
                    >
                      <ProjectDot id={p.id} />
                      <span className="flex-1 truncate">{p.tema}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              <Command.Group heading="Ir a">
                {navItems
                  .filter((n) => !n.capability || can(n.capability))
                  .map((n) => (
                    <Command.Item
                      key={n.to}
                      value={`ir ${n.label}`}
                      onSelect={() => ir(n.to)}
                      className={ITEM}
                    >
                      <Icon
                        name={n.icon}
                        size={16}
                        className={
                          n.color === 'accent'
                            ? 'text-accent'
                            : n.color
                              ? TAG[n.color].text
                              : 'text-fg-faint'
                        }
                      />
                      {n.label}
                    </Command.Item>
                  ))}
                <Command.Item value="ir perfil" onSelect={() => ir('/profile')} className={ITEM}>
                  <Icon name="user" size={16} className="text-fg-faint" />
                  Perfil
                </Command.Item>
              </Command.Group>

              <Command.Group heading="Apariencia">
                <Command.Item
                  value="tema claro oscuro apariencia"
                  onSelect={() => {
                    setPreference(theme === 'dark' ? 'light' : 'dark')
                    setOpen(false)
                  }}
                  className={ITEM}
                >
                  <Icon
                    name={theme === 'dark' ? 'sun' : 'moon'}
                    size={16}
                    className="text-fg-faint"
                  />
                  {theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
                </Command.Item>
              </Command.Group>
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
