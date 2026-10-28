import { useState } from 'react'
import { adminService, type EmpresaInfo } from '@infrastructure/supabase/admin.service'
import { Button } from '@shared/components/ui/Button'
import { Input } from '@shared/components/ui/Input'
import { useToast } from '@shared/components/ui/Toast'

/**
 * Niveles de la jerarquia de la empresa ("1 Gerencia › 2 Subgerencia › 3 Área › 4 Equipo").
 * Se definen una vez; despues, al crear una unidad debajo de otra, se propone el nivel
 * siguiente. Son solo nombres: una rama puede saltarse niveles y una empresa chica puede tener
 * uno solo.
 */
export function NivelesEmpresa({
  empresa,
  onGuardado,
}: {
  empresa: EmpresaInfo
  onGuardado: () => void
}) {
  const toast = useToast()
  const [editando, setEditando] = useState(false)
  const [lista, setLista] = useState<string[]>(empresa.niveles)
  const [guardando, setGuardando] = useState(false)

  const empezar = () => {
    setLista(empresa.niveles)
    setEditando(true)
  }

  const guardar = async () => {
    const limpia = lista.map((n) => n.trim()).filter(Boolean)
    if (!limpia.length) return toast.error('Deja al menos un nivel')
    setGuardando(true)
    try {
      await adminService.editarEmpresa(empresa.id, { niveles: limpia })
      toast.success('Niveles actualizados')
      setEditando(false)
      onGuardado()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  if (!editando)
    return (
      <div className="lamina flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <span className="text-xs font-semibold text-fg-muted">Niveles de {empresa.nombre}</span>
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-fg">
          {empresa.niveles.map((n, i) => (
            <li key={n} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-fg-faint">›</span>}
              <span className="rounded-full bg-surface px-2 py-0.5">
                <span className="text-xs text-fg-faint tabular-nums">{i + 1}</span> {n}
              </span>
            </li>
          ))}
        </ol>
        <Button variant="ghost" size="sm" icon="pencil" className="ml-auto" onClick={empezar}>
          Editar
        </Button>
      </div>
    )

  return (
    <div className="lamina px-4 py-3 space-y-3">
      <div>
        <p className="text-sm font-medium text-fg">Niveles de {empresa.nombre}</p>
        <p className="text-xs text-fg-faint">
          De arriba hacia abajo. Al crear una unidad debajo de otra se propone el nivel siguiente;
          igual puedes elegir otro o saltarte niveles.
        </p>
      </div>
      <ol className="space-y-2">
        {lista.map((n, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="w-5 text-right text-xs text-fg-faint tabular-nums">{i + 1}</span>
            <div className="flex-1 max-w-xs">
              <Input
                aria-label={`Nivel ${i + 1}`}
                value={n}
                onChange={(e) => setLista(lista.map((x, j) => (j === i ? e.target.value : x)))}
                maxLength={40}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon="x"
              aria-label={`Quitar nivel ${i + 1}`}
              disabled={lista.length === 1}
              onClick={() => setLista(lista.filter((_, j) => j !== i))}
            />
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="ghost"
          size="sm"
          icon="plus"
          disabled={lista.length >= 8}
          onClick={() => setLista([...lista, ''])}
        >
          Agregar nivel
        </Button>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEditando(false)}>
            Cancelar
          </Button>
          <Button size="sm" loading={guardando} onClick={() => void guardar()}>
            Guardar niveles
          </Button>
        </div>
      </div>
    </div>
  )
}
