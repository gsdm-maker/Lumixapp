# Sistema de diseño de Lumix

Rediseño 2026. Fuentes: el brief de UI/UX (`Lumix_Claude_UIUX_Brief.md`) y la propuesta aprobada
("Del chat al trabajo ordenado", 24 ideas). Este archivo es la referencia para cualquier pantalla
nueva o modificada.

> Regla general: si un elemento no ayuda a entender información ni a hacer una acción, sale.

## 1. Identidad

- **Tinta, papel y una sola señal.** Neutros fríos, un acento (petróleo por defecto) y color
  semántico solo cuando comunica estado.
- **Claro por defecto.** El oscuro se mantiene igual de cuidado. Preferencia: Claro, Oscuro o
  Sistema (Perfil → Apariencia).
- **Bordes, no tarjetas.** Secciones separadas con líneas de 1px y fondos apenas distintos.
  Sombra solo en lo que flota (menús, diálogos, avisos).
- **Tipografía:** IBM Plex Sans (alojada en `public/fonts`, la CSP no permite Google Fonts).
  Plex Mono solo para claves temporales y atajos de teclado.
- **Sin** emojis como íconos, degradados, violeta, IDs inventados (`#ACT-104`), bloques de
  héroe ni tarjetas dentro de tarjetas.

## 2. Tokens (src/index.css)

Todo color sale de una variable. Nunca escribir colores de Tailwind a mano (`bg-slate-800`,
`text-red-400`, `bg-indigo-600`) en código nuevo.

| Token (clase)                                                       | Uso                                               |
| ------------------------------------------------------------------- | ------------------------------------------------- |
| `bg-shell`                                                          | Fondo general de la app                           |
| `bg-panel`                                                          | Encabezados, tablas, paneles, diálogos            |
| `bg-surface`                                                        | Controles en reposo, filas de grupo, hover        |
| `bg-surface-2`                                                      | Hover más marcado                                 |
| `bg-surface-soft`                                                   | Insets sutiles                                    |
| `bg-field`                                                          | Inputs                                            |
| `border-border` / `border-border-strong`                            | Divisores / bordes de controles                   |
| `text-fg` / `text-fg-body` / `text-fg-muted` / `text-fg-faint`      | Títulos y datos / cuerpo / secundario / metadatos |
| `text-accent`, `bg-accent-fill`, `bg-accent-soft`, `text-on-accent` | Acento: enlaces, acción principal, selección      |
| `success`, `warning`, `danger`, `blocked` (+ `-soft`)               | Solo semántica de estado                          |

**Tema y acento** se cambian con atributos en `<html>` (`data-theme`, `data-accent`), gestionados
por `ThemeContext` y aplicados antes de pintar por `public/tema-inicial.js`.

**Agregar un acento:** un bloque `[data-accent='x'] { --a-50 … --a-950 }` en `index.css`, una
entrada en `ACCENTS` (`src/core/theme/apariencia.ts`) y el valor en `public/tema-inicial.js`.

**Compatibilidad:** `indigo-*` apunta a la escala del acento, así que el código viejo que usaba
índigo cambia de color junto con el acento. El código nuevo usa `accent*` directamente.

## 3. Escala

- **Texto (5 tamaños):** `text-2xs` 11 (atajos, gráficos), `text-xs` 12 (metadatos), `text-sm`
  13 (cuerpo y tablas), `text-lg` 15 (títulos de sección/página), `text-2xl` 21 (cifra
  principal). `text-base` 16 solo en inputs en móvil (evita el zoom de iOS). Nada de
  `text-[10px]` ni tamaños arbitrarios.
- **Esquinas:** `rounded-md` (5px) controles, `rounded-lg` (6px) contenedores. `rounded-full`
  solo para avatares y puntos.
- **Alturas de control:** 28px (`xs`), 32px (`sm`, barras de filtro), 36px (`md`).

## 4. Componentes (src/shared/components/ui)

| Necesitas…                      | Usa                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------ |
| Encabezado de página            | `PageHeader` (title, meta, actions, children)                                  |
| Filtros                         | `FilterBar`, `FilterChip`, `FilterSpacer`, `SearchInput`                       |
| Elegir una opción entre pocas   | `SegmentedControl`                                                             |
| Botón                           | `Button` (primary, secondary, ghost, danger · xs/sm/md/lg · `icon`, `loading`) |
| Botón solo ícono                | `IconButton` (con `label` obligatorio)                                         |
| Ícono                           | `Icon name="…"` (set propio; si falta uno se agrega en `Icon.tsx`)             |
| Estado de algo                  | `StatusLabel` + mapas de `@shared/utils/estados`                               |
| Prioridad                       | `PriorityBars` / `PriorityPicker`                                              |
| Fecha de entrega                | `DueDate` (relativa: "hoy", "hace 3 d")                                        |
| Avance                          | `ProgressBar`                                                                  |
| Detalle de un ítem de una lista | `SidePanel` (no tapa la lista en escritorio)                                   |
| Decisión o formulario corto     | `Modal` (con `footer`)                                                         |
| Confirmar algo irreversible     | `useConfirm()`                                                                 |
| Confirmar algo hecho / deshacer | `useToast().success(msg, { action: { label: 'Deshacer', onClick } })`          |
| Vacío / cargando                | `EmptyState` / `LoadingState`, `Spinner`, `SkeletonRows`                       |
| Formularios                     | `Input`, `Textarea`, `Select`, `FieldLabel`                                    |
| Título chico de bloque          | `SectionLabel`                                                                 |
| Etiqueta/conteo                 | `Badge`                                                                        |

## 5. Patrones

- **Confirmar y deshacer:** lo reversible se hace al tiro y ofrece "Deshacer" en un aviso; lo
  irreversible pasa por `useConfirm`, con "Cancelar" a la izquierda y la acción a la derecha,
  nombrando qué se borra.
- **Estado:** punto + texto, nunca píldora de color. Un solo mapa por familia en
  `estados.ts`.
- **Fechas:** cercanas en palabras ("hoy", "ayer", "jue 8"), exacta en el tooltip.
- **Acciones de fila:** la siguiente acción lógica (Iniciar/Completar) aparece en la fila; el
  resto vive en el panel de detalle.
- **Móvil:** las tablas se vuelven listas de dos líneas; la barra inferior tiene 4 destinos +
  "Más" y se oculta con el teclado abierto.
- **Accesibilidad:** foco visible (`:focus-visible` en el acento), `aria-label` en todo botón
  sin texto, el estado se lee por forma además de color, respeta `prefers-reduced-motion`.

## 6. Checklist antes de dar una pantalla por terminada

- ¿La jerarquía se entiende en 3 segundos? ¿La acción principal es obvia?
- ¿Hay tarjetas, píldoras, íconos o colores que no comunican nada?
- ¿Usa solo tokens y la escala de texto? (`grep "text-\[" ` y colores de Tailwind = 0)
- ¿Funciona en claro, oscuro y con los tres acentos?
- ¿Funciona a 375px de ancho sin scroll horizontal de la página?
