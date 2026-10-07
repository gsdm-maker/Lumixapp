import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bell,
  Bot,
  Bug,
  Calendar,
  CalendarArrowUp,
  ChartGantt,
  ChartNoAxesColumn,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  CircleCheckBig,
  ClipboardList,
  Clock,
  Copy,
  Database,
  Dot,
  Download,
  Ellipsis,
  ExternalLink,
  Eye,
  Flag,
  FolderKanban,
  GripVertical,
  Handshake,
  Info,
  Kanban,
  Layers,
  Link,
  ListChecks,
  ListFilter,
  Lock,
  LogOut,
  Menu,
  MessageSquare,
  Monitor,
  MonitorDown,
  Moon,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Reply,
  Search,
  SendHorizontal,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Target,
  Trash,
  TriangleAlert,
  Undo2,
  Upload,
  User,
  UserRoundPen,
  Users,
  X,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react'

// Iconos de Lumix: Lucide (el set de la familia shadcn/ui), con trazo uniforme de 1.75.
//
// La app usa SIEMPRE este componente con un nombre propio (name="calendar"), nunca el icono de
// Lucide directo: asi el set se puede cambiar en un solo lugar (ya paso una vez, de SVG
// dibujados a mano a Lucide) y cada concepto tiene un solo icono en toda la app. Si falta uno,
// se agrega aca con un nombre que diga el concepto, no la forma.
const ICONOS = {
  chat: MessageSquare,
  list: ListChecks,
  checkCircle: CircleCheckBig,
  circleCheck: CircleCheck,
  clipboard: ClipboardList,
  folder: FolderKanban,
  handshake: Handshake,
  bug: Bug,
  database: Database,
  calendar: Calendar,
  chart: ChartNoAxesColumn,
  bell: Bell,
  users: Users,
  user: User,
  shield: Shield,
  logout: LogOut,
  plus: Plus,
  x: X,
  check: Check,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  chevronDown: ChevronDown,
  chevronUp: ChevronUp,
  arrowLeft: ArrowLeft,
  arrowRight: ArrowRight,
  arrowUp: ArrowUp,
  search: Search,
  filter: ListFilter,
  download: Download,
  upload: Upload,
  more: Ellipsis,
  trash: Trash,
  pencil: Pencil,
  clock: Clock,
  alert: TriangleAlert,
  info: Info,
  play: Play,
  pause: Pause,
  undo: Undo2,
  reply: Reply,
  send: SendHorizontal,
  lock: Lock,
  grip: GripVertical,
  menu: Menu,
  sun: Sun,
  moon: Moon,
  monitor: Monitor,
  link: Link,
  refresh: RefreshCw,
  calendarMove: CalendarArrowUp,
  userSwap: UserRoundPen,
  sliders: SlidersHorizontal,
  external: ExternalLink,
  install: MonitorDown,
  eye: Eye,
  layers: Layers,
  timeline: ChartGantt,
  board: Kanban,
  target: Target,
  dot: Dot,
  sparkles: Sparkles,
  flag: Flag,
  copy: Copy,
  bot: Bot,
} satisfies Record<string, LucideIcon>

export type IconName = keyof typeof ICONOS

interface IconProps extends Omit<LucideProps, 'ref'> {
  name: IconName
  /** Lado en px. 16 en controles, 14 en metadatos, 18 en navegacion. */
  size?: number
}

export function Icon({ name, size = 16, className, strokeWidth = 1.75, ...rest }: IconProps) {
  const Componente = ICONOS[name]
  return (
    <Componente
      size={size}
      strokeWidth={strokeWidth}
      aria-hidden="true"
      focusable="false"
      className={className ? `shrink-0 ${className}` : 'shrink-0'}
      {...rest}
    />
  )
}
