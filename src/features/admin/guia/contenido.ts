import type { IconName } from '@shared/components/ui/Icon'
import type { TagColor } from '@shared/utils/colores'
import type { SeccionGuia } from '@features/guia/contenido'

// Contenido de la Guia de administracion (consola, /admin/guia). Misma forma que la Guia de
// Lumix (features/guia/contenido.ts): si cambia una pagina de la consola, actualizar aca su
// seccion en el mismo commit.

/** El recorrido para dejar una empresa funcionando, de punta a punta. */
export const FLUJO_ADMIN: {
  titulo: string
  texto: string
  icon: IconName
  color: TagColor | 'accent'
}[] = [
  {
    titulo: '1. Empresa y Admin',
    texto: 'El Owner crea la empresa y nombra a su Admin.',
    icon: 'database',
    color: 'violet',
  },
  {
    titulo: '2. Niveles',
    texto: 'El Admin define los niveles: Gerencia › Subgerencia › Área › Equipo.',
    icon: 'layers',
    color: 'blue',
  },
  {
    titulo: '3. Unidades',
    texto: 'Arma el árbol: cada unidad cuelga de la de arriba.',
    icon: 'board',
    color: 'green',
  },
  {
    titulo: '4. Personas',
    texto: 'Suma a cada persona a su unidad con su rol. Un Líder por unidad.',
    icon: 'users',
    color: 'amber',
  },
  {
    titulo: '5. Seguimiento',
    texto: 'Cuentas, claves y el registro de todo lo que se hizo.',
    icon: 'historial',
    color: 'orange',
  },
]

export const SECCIONES_ADMIN: SeccionGuia[] = [
  {
    id: 'empresas',
    titulo: 'Empresas',
    icon: 'database',
    color: 'violet',
    ruta: '/admin/empresas',
    soloOwner: true,
    resumen:
      'Solo para el Owner: crear empresas, nombrar a su Admin y elegir en cuál trabajar. Cada empresa ve solo lo suyo.',
    acciones: [
      {
        t: 'Crear empresa',
        d: 'Escribe el nombre y toca "Crear empresa". Nace con los niveles Gerencia › Subgerencia › Área › Equipo.',
      },
      {
        t: 'Nombrar Admin',
        d: 'Nombre y email: se crea su cuenta con una clave temporal que se muestra una sola vez. Entrégasela; al entrar deberá cambiarla.',
      },
      {
        t: 'Quitar Admin',
        d: 'La × junto a su nombre. La persona sigue en la empresa como Integrante.',
      },
      {
        t: 'Trabajar en una empresa',
        d: '"Trabajar aquí" o el selector de arriba a la derecha. Personas, Estructura y Actividad muestran solo esa empresa.',
      },
    ],
    reglas: [
      'Una empresa sin Admin aparece como "sin Admin todavía".',
      'Lo que veas en la consola es siempre de la empresa elegida arriba.',
    ],
  },
  {
    id: 'niveles',
    titulo: 'Niveles de la empresa',
    icon: 'layers',
    color: 'blue',
    ruta: '/admin/estructura',
    resumen:
      'Los nombres de los niveles de la jerarquía, de arriba hacia abajo. Se definen una vez y la consola los propone al crear unidades.',
    acciones: [
      {
        t: 'Ver los niveles',
        d: 'En Estructura, la franja de arriba: 1 Gerencia › 2 Subgerencia › 3 Área › 4 Equipo.',
      },
      {
        t: 'Editar',
        d: 'Cambiar nombres, quitar con la × o sumar con "Agregar nivel" (de 1 a 8). Luego "Guardar niveles".',
      },
      {
        t: 'Nivel sugerido',
        d: 'Al crear una unidad debajo de otra se propone el nivel siguiente, marcado "(sugerido)".',
      },
    ],
    reglas: [
      'Una unidad de primer nivel toma el nivel 1.',
      'Puedes saltarte niveles: debajo de una Gerencia puede ir directo un Equipo.',
      'Son solo nombres: una empresa chica puede dejar uno solo, por ejemplo "Equipo".',
    ],
  },
  {
    id: 'modulos',
    titulo: 'Módulos',
    icon: 'sliders',
    color: 'violet',
    ruta: '/admin/estructura',
    resumen:
      'Qué partes de Lumix usa tu empresa. El Chat siempre está; lo demás se enciende o apaga, para toda la empresa o por unidad.',
    acciones: [
      {
        t: 'Módulos de la empresa',
        d: 'En Estructura, bajo los niveles: toca cada módulo para encenderlo o apagarlo. Aplica al tiro.',
      },
      {
        t: 'Módulos de una unidad',
        d: 'En la unidad, desmarca "los mismos de la empresa" y elige los suyos (por ejemplo, Ingestas solo para Datos).',
      },
      {
        t: 'Volver a los de la empresa',
        d: 'Marca de nuevo "los mismos de la empresa" en esa unidad.',
      },
    ],
    reglas: [
      'Un módulo apagado no lo ve nadie en esa unidad, ni el Admin: desaparece del menú y de la Guía.',
      'Encima siguen los permisos por persona de Equipos → Permisos.',
      'Apagar un módulo no borra sus datos: al encenderlo vuelven a aparecer.',
    ],
  },
  {
    id: 'planes',
    titulo: 'Planes y prueba',
    icon: 'clock',
    color: 'red',
    ruta: '/admin/empresas',
    soloOwner: true,
    resumen:
      'Cada empresa nueva parte con 15 días de prueba. Al vencer, la app le pide contactarte y la IA deja de responder; sus datos quedan guardados.',
    acciones: [
      {
        t: 'Ver el plan',
        d: 'En Empresas: Prueba con los días que quedan, Prueba vencida, Gratis o Pagada.',
      },
      { t: 'Dar gratis', d: 'La empresa queda sin vencimiento.' },
      { t: 'Prueba +15 días', d: 'Extiende la prueba 15 días desde hoy.' },
      { t: 'Marcar pagada', d: 'Para quien ya contrató (mientras no exista el portal de pago).' },
    ],
    reglas: [
      'Quien se registra solo crea su espacio en la Bienvenida y queda en prueba.',
      'Tú (Owner) nunca quedas bloqueado.',
    ],
  },
  {
    id: 'estructura',
    titulo: 'Estructura',
    icon: 'board',
    color: 'green',
    ruta: '/admin/estructura',
    resumen:
      'El árbol de unidades a la izquierda y, a la derecha, la unidad elegida con su gente. Todo se arma desde aquí.',
    acciones: [
      {
        t: 'Unidad de primer nivel',
        d: 'Escribe el nombre bajo el árbol y toca +.',
      },
      {
        t: 'Unidad debajo de otra',
        d: 'Elige la de arriba y usa "Crear unidad debajo de…": nombre, nivel y "Crear".',
      },
      { t: 'Renombrar', d: 'Toca el nombre de la unidad y escribe el nuevo.' },
      { t: 'Cambiar nivel', d: 'El selector de nivel junto al nombre.' },
      {
        t: 'Mover',
        d: '"Depende de": elige la nueva unidad de arriba, o "Nadie (primer nivel)".',
      },
      {
        t: 'Borrar unidad',
        d: 'Al final de la unidad, con confirmación. Sus subunidades pasan a la unidad de arriba y su gente sale de ella.',
      },
    ],
    reglas: [
      'Solo se borra una unidad sin trabajo: actividades, errores, minutas o proyectos, reuniones ni chat. Si tiene, la consola dice qué tiene.',
      'Una unidad no puede depender de una que cuelga de ella.',
      'Las cuentas de la gente no se borran al borrar una unidad.',
    ],
  },
  {
    id: 'personas-unidad',
    titulo: 'Sumar personas a la estructura',
    icon: 'users',
    color: 'amber',
    ruta: '/admin/estructura',
    resumen:
      'Cada persona se suma desde la unidad donde va a estar, con el rol que tendrá ahí: Líder, Integrante o Invitado.',
    acciones: [
      {
        t: 'Nueva persona',
        d: 'En "Agregar persona", elige el rol y toca "Nueva persona". La unidad ya viene elegida; entrega la clave temporal que aparece.',
      },
      {
        t: 'Persona de la empresa',
        d: 'En "Agregar persona", elígela, elige su rol y toca "Agregar".',
      },
      {
        t: 'Cambiar rol o quitar',
        d: 'En la lista de la unidad, el selector de rol o la ×. Quitar la saca de esa unidad, no borra su cuenta.',
      },
      {
        t: 'Nombrar Líder',
        d: 'Elige "Líder" en su rol. La casilla "agregarlo también como Integrante de [unidad de arriba]" viene marcada.',
      },
    ],
    reglas: [
      'Un solo Líder por unidad: nombrar a otro pasa al anterior a Integrante.',
      'Si la persona ya estaba en la unidad de arriba, conserva el rol que tenía ahí.',
      'Una persona puede estar en varias unidades, pero en una sola empresa.',
    ],
    consejos: [
      'Arma primero las unidades de arriba hacia abajo y después nombra a cada Líder: así cada jefatura queda también en el equipo de su jefe.',
    ],
  },
  {
    id: 'cuentas',
    titulo: 'Personas y cuentas',
    icon: 'user',
    color: 'pink',
    ruta: '/admin',
    resumen:
      'Todas las cuentas de la empresa, con sus unidades, su rol y su último ingreso. Toca a una persona para abrir su panel.',
    acciones: [
      {
        t: 'Nueva persona',
        d: 'Nombre, email, unidad y rol. Lumix genera una clave temporal que se muestra una sola vez.',
      },
      {
        t: 'Clave temporal',
        d: 'Una clave nueva para quien olvidó la suya. Al entrar deberá cambiarla.',
      },
      {
        t: 'Desactivar y reactivar',
        d: 'Quien se fue deja de poder entrar; no se borra nada y se puede revertir.',
      },
      {
        t: 'Unidades y roles',
        d: 'Sumar a otra unidad, quitar o cambiar su rol, también desde su panel.',
      },
    ],
    permisos: [
      'Nadie actúa sobre su propia cuenta.',
      'Un Admin no modifica a otro Admin; el Owner sí.',
    ],
  },
  {
    id: 'actividad',
    titulo: 'Actividad',
    icon: 'historial',
    color: 'orange',
    ruta: '/admin/actividad',
    resumen:
      'El registro de cada cambio hecho en la consola de tu empresa: quién, qué y cuándo. No se puede editar.',
    acciones: [
      {
        t: 'Qué queda anotado',
        d: 'Cuentas creadas, claves generadas, desactivaciones, cambios de rol, unidades creadas, movidas o borradas, niveles.',
      },
    ],
    reglas: ['Las claves nunca quedan anotadas.', 'Cada empresa ve solo su propio registro.'],
  },
  {
    id: 'preguntas',
    titulo: 'Preguntas frecuentes',
    icon: 'info',
    resumen: 'Lo que más se pregunta al administrar.',
    acciones: [
      {
        t: '¿Qué ve cada uno en la app?',
        d: 'Un Líder ve todo lo que cuelga de su unidad, pero solo controla el nivel de abajo. Un Integrante ve lo de sus unidades. Un Invitado, solo su unidad.',
      },
      {
        t: '¿Puede haber dos Líderes en una unidad?',
        d: 'No. Nombrar a otro pasa al anterior a Integrante.',
      },
      {
        t: '¿Por qué no puedo borrar una unidad?',
        d: 'Porque tiene trabajo. Mueve o elimina sus actividades y minutas, o déjala y mueve a su gente.',
      },
      {
        t: '¿Por qué no veo otras empresas?',
        d: 'Un Admin solo ve la suya. Solo el Owner ve todas.',
      },
      {
        t: 'Perdí la clave temporal de alguien',
        d: 'Genera otra desde Personas → su panel → Clave temporal.',
      },
    ],
  },
]

/** Quién es quién en la administración y dentro de cada unidad. */
export const ROLES_ADMIN: { rol: string; donde: string; texto: string }[] = [
  {
    rol: 'Owner',
    donde: 'Toda la plataforma',
    texto: 'Ve y administra todas las empresas. Crea empresas y nombra a su Admin.',
  },
  {
    rol: 'Admin',
    donde: 'Su empresa',
    texto: 'Arma la estructura, crea cuentas y asigna roles. No ve otras empresas.',
  },
  {
    rol: 'Líder',
    donde: 'Una unidad',
    texto: 'Dirige su unidad y controla la de abajo. Ve todo lo que cuelga de ella.',
  },
  { rol: 'Integrante', donde: 'Una unidad', texto: 'Trabaja en la unidad y ve lo de esa unidad.' },
  { rol: 'Invitado', donde: 'Una unidad', texto: 'Externo: ve solo lo de esa unidad.' },
]
