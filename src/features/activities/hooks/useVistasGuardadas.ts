import { useCallback, useState } from 'react'
import type { FiltrosActividades } from '@features/activities/hooks/useActivities'
import type { Agrupacion } from '@features/activities/utils/urgencia'

// Vistas guardadas (idea 7) y la agrupacion elegida. Viven en localStorage del navegador, por
// usuario: son comodidades personales, no datos del equipo, asi que no justifican una tabla.
// Toda lectura/escritura va en try/catch: en modo privado o con el almacenamiento bloqueado
// la pantalla tiene que funcionar igual, solo que sin recordar nada.

export interface VistaGuardada {
  id: string
  nombre: string
  filtros: FiltrosActividades
}

function leer<T>(clave: string, porDefecto: T): T {
  try {
    const raw = localStorage.getItem(clave)
    return raw ? (JSON.parse(raw) as T) : porDefecto
  } catch {
    return porDefecto
  }
}

function escribir(clave: string, valor: unknown) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor))
  } catch {
    /* sin almacenamiento: se pierde al recargar, nada mas */
  }
}

// Una vista guardada con una version vieja de los filtros (campos faltantes) se descarta en
// vez de aplicar un filtro a medias.
function esVistaValida(v: unknown): v is VistaGuardada {
  const x = v as VistaGuardada
  return (
    !!x &&
    typeof x.id === 'string' &&
    typeof x.nombre === 'string' &&
    !!x.filtros &&
    typeof x.filtros.status === 'string' &&
    typeof x.filtros.team === 'string' &&
    typeof x.filtros.plazo === 'string'
  )
}

export function useVistasGuardadas(userId: string | undefined) {
  const clave = `lumix.actividades.vistas.${userId ?? 'anonimo'}`
  // Se guarda junto con la clave para releer cuando cambia el usuario sin un effect.
  const [estado, setEstado] = useState(() => ({
    clave,
    vistas: leer<unknown[]>(clave, []).filter(esVistaValida),
  }))
  const vistas =
    estado.clave === clave ? estado.vistas : leer<unknown[]>(clave, []).filter(esVistaValida)

  const persistir = useCallback(
    (nuevas: VistaGuardada[]) => {
      escribir(clave, nuevas)
      setEstado({ clave, vistas: nuevas })
    },
    [clave],
  )

  const guardar = (nombre: string, filtros: FiltrosActividades) => {
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    persistir([...vistas, { id, nombre, filtros }])
  }

  const borrar = (id: string) => persistir(vistas.filter((v) => v.id !== id))

  return { vistas, guardar, borrar }
}

const AGRUPACIONES: Agrupacion[] = ['urgencia', 'persona', 'proyecto', 'ninguno']

/** Agrupacion elegida, recordada por usuario. Por defecto, urgencia. */
export function useAgrupacion(userId: string | undefined) {
  const clave = `lumix.actividades.agrupar.${userId ?? 'anonimo'}`
  const [estado, setEstado] = useState(() => ({ clave, valor: leer<string>(clave, 'urgencia') }))
  const crudo = estado.clave === clave ? estado.valor : leer<string>(clave, 'urgencia')
  const agrupacion: Agrupacion = AGRUPACIONES.includes(crudo as Agrupacion)
    ? (crudo as Agrupacion)
    : 'urgencia'

  const setAgrupacion = (a: Agrupacion) => {
    escribir(clave, a)
    setEstado({ clave, valor: a })
  }

  return { agrupacion, setAgrupacion }
}
