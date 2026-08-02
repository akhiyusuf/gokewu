"use client";

import {
  ArrowLeft,
  Book,
  BookOpen,
  Brackets,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CloudOff,
  ExternalLink,
  Eye,
  EyeOff,
  GitCompare,
  GripVertical,
  Info,
  Languages,
  Mic,
  Palette,
  Pause,
  Pencil,
  Play,
  Plus,
  Pointer,
  Repeat,
  RotateCcw,
  RotateCw,
  Search,
  Settings2,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Sun,
  Moon,
  User,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

/** Icon names map to the Lucide icons referenced in the design file. */
const MAP = {
  "arrow-left": ArrowLeft,
  book: Book,
  "book-open": BookOpen,
  brackets: Brackets,
  check: Check,
  "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "chevron-up": ChevronUp,
  "cloud-off": CloudOff,
  "external-link": ExternalLink,
  eye: Eye,
  "eye-off": EyeOff,
  "git-compare": GitCompare,
  "grip-vertical": GripVertical,
  info: Info,
  languages: Languages,
  mic: Mic,
  moon: Moon,
  palette: Palette,
  pause: Pause,
  pencil: Pencil,
  play: Play,
  plus: Plus,
  pointer: Pointer,
  repeat: Repeat,
  "rotate-ccw": RotateCcw,
  "rotate-cw": RotateCw,
  search: Search,
  "settings-2": Settings2,
  "shield-check": ShieldCheck,
  "skip-back": SkipBack,
  "skip-forward": SkipForward,
  sun: Sun,
  user: User,
  users: Users,
  "volume-2": Volume2,
  "volume-x": VolumeX,
  x: X,
} as const;

export type IconName = keyof typeof MAP;

export function Icon({
  name,
  size = 18,
  className,
  style,
}: {
  name: IconName;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const Cmp = MAP[name];
  return <Cmp size={size} className={className} style={style} aria-hidden="true" strokeWidth={2} />;
}
