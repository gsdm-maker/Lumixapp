// "Cerrar semana" (idea 11 de la propuesta UI/UX).
//
// Antes la semana terminaba sin cierre: lo no cumplido quedaba ahi hasta que alguien lo
// movia de a uno. Este paso, al final de la reunion, pregunta UNA vez que hacer con todo lo
// que sigue abierto y lo aplica con las mismas acciones de cada fila (mover una semana,
// llevar a la minuta), sin logica nueva ni datos nuevos.
//
// La propuesta tambien guardaba el % de la semana en un historial, para que el Dashboard
// muestre la tendencia. Eso necesita una tabla nueva en la base, asi que queda pendiente:
// por ahora el % solo se informa aqui.

import { useState } from 'react'
import { Button } from '@shared/components/ui/Button'
import { Modal } from '@shared/components/ui/Modal'
import { useToast } from '@shared/components/ui/Toast'
import { cx } from '@shared/utils/cx'
import type { Compromiso } from '@features/compromisos/hooks/useCompromisos'

type Opcion = 'mover' | 'minuta' | 'dejar'

export function CerrarSemanaModal({
  open,
  onClose,
  etiqueta,
  abiertos,
  porcentaje,
  cumplidos,
  total,
  moverUnaSemana,
  llevarAMinuta,
  onListo,
}: {
  open: boolean
  onClose: () => void
  etiqueta: string
  /** Compromisos de la semana que siguen sin cumplir. */
  abiertos: Compromiso[]
  porcentaje: number | null
  cumplidos: number
  total: number
  moverUnaSemana: (c: Compromiso) => Promise<unknown>
  llevarAMinuta: (c: Compromiso) => Promise<unknown>
  onListo: () => void
}) {
  const [opcion, setOpcion] = useState<Opcion>('mover')
  const [aplicando, setAplicando] = useState(false)
  const toast = useToast()
  // Los que ya estan esperando en la minuta no se vuelven a llevar (seria un tema repetido).
  const paraMinuta = abiertos.filter((c) => !c.enMinuta)

  const opciones: { value: Opcion; titulo: string; detalle: string; disabled?: boolean }[] = [
    {
      value: 'mover',
      titulo: 'Mover todo una semana',
      detalle: `${abiertos.length} compromiso${abiertos.length === 1 ? '' : 's'} pasan a entregarse 7 días después.`,
    },
    {
      value: 'minuta',
      titulo: 'Llevar todo a la minuta',
      detalle: paraMinuta.length
        ? `${paraMinuta.length} quedan como tema para conversar en la próxima reunión.`
        : 'Todos ya están en la minuta.',
      disabled: paraMinuta.length === 0,
    },
    {
      value: 'dejar',
      titulo: 'Dejar como está',
      detalle: 'No se cambia nada: siguen apareciendo como vencidos sin cerrar.',
    },
  ]

  const aplicar = async () => {
    if (opcion === 'dejar') {
      onClose()
      return
    }
    setAplicando(true)
    const lista = opcion === 'mover' ? abiertos : paraMinuta
    let ok = 0
    // De a uno y en orden, no en paralelo: llevar a la minuta calcula el orden del tema nuevo
    // leyendo los que ya hay, y en paralelo todos tomarian el mismo numero.
    for (const c of lista) {
      try {
        await (opcion === 'mover' ? moverUnaSemana(c) : llevarAMinuta(c))
        ok++
      } catch {
        // Se sigue con el resto; abajo se informa cuantos fallaron.
      }
    }
    setAplicando(false)
    const fallidos = lista.length - ok
    if (ok)
      toast.success(
        opcion === 'mover'
          ? `${ok} compromiso${ok === 1 ? '' : 's'} movido${ok === 1 ? '' : 's'} a la próxima semana`
          : `${ok} compromiso${ok === 1 ? '' : 's'} llevado${ok === 1 ? '' : 's'} a la minuta`,
      )
    if (fallidos) toast.error(`${fallidos} no se pudieron actualizar`)
    onListo()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cerrar semana"
      description={etiqueta}
      size="md"
      dismissible={!aplicando}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={aplicando}>
            Cancelar
          </Button>
          <Button onClick={aplicar} loading={aplicando}>
            {opcion === 'dejar' ? 'Cerrar' : 'Aplicar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-fg-body">
          La semana cierra con{' '}
          <span className="font-semibold text-fg tabular-nums">{porcentaje ?? 0}%</span> cumplido (
          {cumplidos} de {total}).{' '}
          {abiertos.length === 0
            ? 'No queda nada abierto.'
            : `Quedan ${abiertos.length} abiertos. ¿Qué hacemos con ellos?`}
        </p>
        {abiertos.length > 0 && (
          <div role="radiogroup" aria-label="Qué hacer con lo abierto" className="space-y-1.5">
            {opciones.map((o) => (
              <label
                key={o.value}
                className={cx(
                  'flex gap-3 rounded-md border px-3 py-2.5 cursor-pointer',
                  opcion === o.value ? 'border-accent bg-accent-soft' : 'border-border-strong',
                  o.disabled && 'opacity-50 cursor-not-allowed',
                )}
              >
                <input
                  type="radio"
                  name="cerrar-semana"
                  value={o.value}
                  checked={opcion === o.value}
                  disabled={o.disabled}
                  onChange={() => setOpcion(o.value)}
                  className="mt-0.5 accent-accent"
                />
                <span>
                  <span className="block text-sm font-medium text-fg">{o.titulo}</span>
                  <span className="block text-xs text-fg-muted">{o.detalle}</span>
                </span>
              </label>
            ))}
          </div>
        )}
        {abiertos.length > 0 && (
          <ul className="max-h-40 overflow-y-auto divide-y divide-border border-y border-border">
            {abiertos.map((c) => (
              <li key={c.id} className="py-1.5 text-xs text-fg-muted truncate">
                {c.title}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
