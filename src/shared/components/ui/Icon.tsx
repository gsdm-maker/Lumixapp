import type { SVGProps } from 'react'

// Set de iconos de Lumix: trazo de 1.75 sobre una grilla de 24, sin relleno, mismo peso en
// todos. Reemplaza los emojis usados como iconos (📅 ⚠ 🗑 👤 ⏸ ▶...) y los SVG sueltos que cada
// pantalla dibujaba a su manera. Dibujados a mano para no sumar una dependencia: si falta uno,
// se agrega aca (un path de 24x24, sin fill) y no en la pantalla.
const PATHS = {
  chat: 'M4 5h16v11H9l-5 4V5z',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  checkCircle: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM8 12.5l2.5 2.5L16 9.5',
  clipboard: 'M9 4h6v3H9zM7 5.5H5V21h14V5.5h-2M8.5 12h7M8.5 16h5',
  folder: 'M3 6.5h6.5l2 2H21V19H3z',
  handshake: 'M4 12l4-4h4l2 2 2-2h4M4 12l5 5 2-2M20 10l-6 6-2-2M9.5 14.5l2 2',
  bug: 'M8 9h8v6a4 4 0 0 1-8 0V9zM10 6.5a2 2 0 0 1 4 0V9h-4zM4 13h4M16 13h4M5 8l3 2M19 8l-3 2M5 19l3-2.5M19 19l-3-2.5',
  database:
    'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3.5v4M16 3.5v4',
  chart: 'M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5h4',
  users:
    'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.5-3.5 3.2-5.5 6.5-5.5s6 2 6.5 5.5M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.8c1.9.7 3.2 2.5 3.5 5.2',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c.6-4 3.6-6.5 7.5-6.5s6.9 2.5 7.5 6.5',
  shield: 'M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z',
  logout: 'M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10',
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  chevronLeft: 'M14.5 6l-6 6 6 6',
  chevronRight: 'M9.5 6l6 6-6 6',
  chevronDown: 'M6 9.5l6 6 6-6',
  chevronUp: 'M6 14.5l6-6 6 6',
  arrowLeft: 'M19 12H5M11 6l-6 6 6 6',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  arrowUp: 'M12 19V5M6 11l6-6 6 6',
  search: 'M10.5 17.5a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20.5 20.5l-5-5',
  filter: 'M4 5h16l-6 7.5V19l-4-2v-4.5z',
  download: 'M12 4v11M7 10.5l5 5 5-5M4.5 20h15',
  upload: 'M12 16V5M7 9.5l5-5 5 5M4.5 20h15',
  more: 'M5.5 12h.01M12 12h.01M18.5 12h.01',
  trash: 'M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5',
  pencil: 'M15 5l4 4L8.5 19.5H4.5v-4zM13 7l4 4',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2',
  alert: 'M12 4l9 15.5H3zM12 10v4M12 17h.01',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5.5M12 7.5h.01',
  play: 'M8 5.5v13l10.5-6.5z',
  pause: 'M8 5.5v13M16 5.5v13',
  undo: 'M9 14l-5-5 5-5M4 9h10a6 6 0 0 1 0 12h-3',
  reply: 'M10 8L5 12.5 10 17M5 12.5h9a5 5 0 0 1 5 5V19',
  send: 'M5 12l15-7-5.5 15-3-6.5z',
  lock: 'M6 11h12v9.5H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  menu: 'M4 7h16M4 12h16M4 17h16',
  sun: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
  moon: 'M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z',
  monitor: 'M3.5 5h17v11h-17zM9 20h6M12 16v4',
  link: 'M10 14a4 4 0 0 0 6 .5l3-3a4 4 0 0 0-5.7-5.7l-1.3 1.3M14 10a4 4 0 0 0-6-.5l-3 3a4 4 0 0 0 5.7 5.7l1.3-1.3',
  refresh: 'M20 6v5h-5M4 18v-5h5M18.5 9A7 7 0 0 0 6 7.5M5.5 15A7 7 0 0 0 18 16.5',
  calendarMove: 'M4 6h16v14H4zM4 10h16M8 3.5v4M16 3.5v4M10 15h5M13 13l2 2-2 2',
  userSwap:
    'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.5-3.5 3.2-5.5 6.5-5.5M15 15h6M19 13l2 2-2 2M21 20h-6M17 18l-2 2 2 2',
  sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  external: 'M14 4h6v6M20 4l-9 9M18 13.5V20H4V6h6.5',
  install: 'M12 4v10M8 10l4 4 4-4M5 17v3h14v-3',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  layers: 'M12 4l8.5 4.5L12 13 3.5 8.5zM3.5 12.5L12 17l8.5-4.5M3.5 16.5L12 21l8.5-4.5',
  timeline: 'M4 6h8M8 12h10M6 18h7M4 3.5v17',
  board: 'M4 5h4.5v14H4zM9.75 5h4.5v9h-4.5zM15.5 5H20v11h-4.5z',
  target:
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 12h.01',
  dot: 'M12 12h.01',
} as const

export type IconName = keyof typeof PATHS

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  /** Lado en px. 16 en controles, 14 en metadatos, 18 en navegacion. */
  size?: number
}

export function Icon({ name, size = 16, className, strokeWidth = 1.75, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className ? `shrink-0 ${className}` : 'shrink-0'}
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
