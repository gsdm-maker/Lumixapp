// Carga masiva de temas de minuta desde una planilla.
//
// El paso de validacion no es un adorno: se muestra TODO lo que se va a escribir, fila por
// fila, antes de escribir nada. En una carga de cincuenta temas, descubrir despues que
// veinte quedaron con el responsable equivocado cuesta mucho mas que revisar antes.

import { useState, type ReactNode } from 'react'
import { Modal } from '@shared/components/ui/Modal'
import { Button } from '@shared/components/ui/Button'
import { useToast } from '@shared/components/ui/Toast'
import { downloadText } from '@shared/utils/csv'
import { formatDateLocal } from '@shared/utils/date'
import { MINUTE_ESTADO } from '@shared/utils/estados'
import { plantillaCSV, validarFilas, type FilaValidada } from '@features/minuta/utils/bulkMinuta'
import type { Profile } from '@shared/types'

type Props = {
  open: boolean
  onClose: () => void
  members: Profile[]
  /** Temas que ya estan en la hoja, para detectar los repetidos antes de escribir. */
  temasExistentes: string[]
  onConfirm: (
    filas: FilaValidada[],
  ) => Promise<{ creados: number; fallidos: { linea: number; motivo: string }[] }>
}

export function CargaMasivaModal({ open, onClose, members, temasExistentes, onConfirm }: Props) {
  const [filas, setFilas] = useState<FilaValidada[] | null>(null)
  // Lineas marcadas para importar. Los repetidos entran desmarcados: el caso tipico es
  // corregir tres filas y volver a subir el archivo entero, y ahi lo que se quiere es que
  // entren solo las nuevas. Se pueden marcar a mano si de verdad se quiere repetir el tema.
  const [marcadas, setMarcadas] = useState<Set<number>>(new Set())
  const [nombreArchivo, setNombreArchivo] = useState('')
  const [importando, setImportando] = useState(false)
  const toast = useToast()

  const importables = filas?.filter((f) => !f.errores.length) ?? []
  const validas = importables.filter((f) => marcadas.has(f.linea))
  const conError = filas?.filter((f) => f.errores.length) ?? []
  const duplicadas = importables.filter((f) => f.duplicado)

  const alternar = (linea: number) =>
    setMarcadas((cur) => {
      const n = new Set(cur)
      if (n.has(linea)) n.delete(linea)
      else n.add(linea)
      return n
    })

  const cerrar = () => {
    setFilas(null)
    setMarcadas(new Set())
    setNombreArchivo('')
    onClose()
  }

  const leerArchivo = async (file: File) => {
    setNombreArchivo(file.name)
    try {
      const texto = await file.text()
      const resultado = validarFilas(texto, members, temasExistentes)
      if (!resultado.length) {
        toast.error('La planilla no tiene filas con datos.')
        setFilas(null)
        return
      }
      setFilas(resultado)
      setMarcadas(
        new Set(resultado.filter((f) => !f.errores.length && !f.duplicado).map((f) => f.linea)),
      )
    } catch (err) {
      console.error('Lectura de planilla fallida:', err)
      toast.error('No pude leer el archivo. Debe ser un CSV.')
      setFilas(null)
    }
  }

  const importar = async () => {
    if (!validas.length) return
    setImportando(true)
    try {
      const { creados, fallidos } = await onConfirm(validas)
      if (creados)
        toast.success(
          `${creados} tema${creados === 1 ? '' : 's'} agregado${creados === 1 ? '' : 's'}.`,
        )
      if (fallidos.length)
        toast.error(
          `${fallidos.length} fila(s) no se pudieron guardar: línea ${fallidos.map((f) => f.linea).join(', ')}.`,
        )
      if (creados) cerrar()
    } finally {
      setImportando(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={cerrar}
      title="Carga masiva"
      description="Agrega varios temas desde una planilla CSV. Se revisa todo antes de escribir."
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={cerrar} disabled={importando}>
            Cancelar
          </Button>
          <Button onClick={importar} loading={importando} disabled={!validas.length}>
            {`Importar ${validas.length || ''} tema${validas.length === 1 ? '' : 's'}`}
          </Button>
        </>
      }
    >
      <ol className="space-y-5">
        <Paso n={1} titulo="Descarga la plantilla">
          <p className="text-xs text-fg-faint">
            Tiene las columnas exactas y filas de ejemplo. También sirve un archivo descargado con
            Exportar: son las mismas columnas.
          </p>
          <Button
            size="xs"
            variant="secondary"
            icon="download"
            onClick={() => downloadText('plantilla_minuta.csv', plantillaCSV())}
          >
            Descargar plantilla CSV
          </Button>
        </Paso>

        <Paso n={2} titulo="Sube la planilla completada">
          <input
            type="file"
            accept=".csv,text/csv"
            aria-label="Planilla CSV"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) leerArchivo(f)
              e.target.value = '' // permite volver a subir el mismo archivo corregido
            }}
            className="block w-full text-xs text-fg-muted file:mr-3 file:h-7 file:px-2.5 file:rounded-md file:border file:border-solid file:border-border-strong file:bg-panel file:text-xs file:font-medium file:text-fg hover:file:bg-surface file:cursor-pointer"
          />
          {nombreArchivo && <p className="text-xs text-fg-faint">{nombreArchivo}</p>}
        </Paso>

        {filas && (
          <Paso n={3} titulo="Revisa antes de importar">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="text-fg">{validas.length} marcadas para importar</span>
              {duplicadas.length > 0 && (
                <span className="text-warning">{duplicadas.length} ya existen, desmarcadas</span>
              )}
              {conError.length > 0 && (
                <span className="text-danger">{conError.length} con error, se omiten</span>
              )}
              {importables.length > 0 && (
                <Button
                  size="xs"
                  variant="ghost"
                  className="ml-auto"
                  onClick={() =>
                    setMarcadas(
                      validas.length === importables.length
                        ? new Set()
                        : new Set(importables.map((f) => f.linea)),
                    )
                  }
                >
                  {validas.length === importables.length ? 'Desmarcar todas' : 'Marcar todas'}
                </Button>
              )}
            </div>

            <div className="max-h-64 overflow-auto rounded-md border border-border">
              <table className="w-full text-xs border-separate border-spacing-0">
                <thead className="text-fg-faint">
                  <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:bg-panel [&>th]:border-b [&>th]:border-border [&>th]:px-2 [&>th]:py-1.5 [&>th]:text-left [&>th]:font-medium">
                    <th className="w-6">
                      <span className="sr-only">Importar</span>
                    </th>
                    <th>#</th>
                    <th>Tema</th>
                    <th>Responsables</th>
                    <th>Estado</th>
                    <th>Plazo</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => {
                    const malo = f.errores.length > 0
                    return (
                      <tr
                        key={f.linea}
                        className="[&>td]:border-b [&>td]:border-border [&>td]:px-2 [&>td]:py-1.5 [&>td]:align-top"
                      >
                        <td>
                          {!malo && (
                            <input
                              type="checkbox"
                              checked={marcadas.has(f.linea)}
                              onChange={() => alternar(f.linea)}
                              className="accent-accent mt-0.5"
                              aria-label={`Importar la línea ${f.linea}`}
                            />
                          )}
                        </td>
                        <td className="text-fg-faint tabular-nums">{f.linea}</td>
                        <td>
                          <span className={malo ? 'text-fg-faint line-through' : 'text-fg-body'}>
                            {f.tema || '(vacío)'}
                          </span>
                          {f.errores.map((e, i) => (
                            <p key={i} className="text-danger mt-0.5">
                              {e}
                            </p>
                          ))}
                          {f.avisos.map((a, i) => (
                            <p key={i} className="text-warning mt-0.5">
                              {a}
                            </p>
                          ))}
                        </td>
                        <td className="text-fg-muted">
                          {f.paraTodos
                            ? 'Todos'
                            : f.responsables.length
                              ? f.responsables
                                  .map((id) => members.find((m) => m.id === id)?.full_name ?? '?')
                                  .join(', ')
                              : (f.responsablesText ?? '') || '—'}
                        </td>
                        <td className="text-fg-muted whitespace-nowrap">
                          {MINUTE_ESTADO[f.estado].label}
                        </td>
                        <td className="text-fg-muted whitespace-nowrap">
                          {f.plazo ? formatDateLocal(f.plazo) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Paso>
        )}
      </ol>
    </Modal>
  )
}

/** Un paso numerado: numero y texto, sin caja (antes cada paso era una tarjeta). */
function Paso({ n, titulo, children }: { n: number; titulo: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="w-5 h-5 shrink-0 inline-flex items-center justify-center rounded-full border border-border-strong text-2xs font-semibold text-fg-muted tabular-nums">
        {n}
      </span>
      <div className="flex-1 min-w-0 space-y-2">
        <p className="text-sm font-medium text-fg">{titulo}</p>
        {children}
      </div>
    </li>
  )
}
