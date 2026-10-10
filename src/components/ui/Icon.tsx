import React from 'react';
import * as LucideIcons from 'lucide-react';

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | number;
export type IconVariant = 'default' | 'primary' | 'secondary' | 'muted' | 'success' | 'warning' | 'danger' | 'info' | 'white';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  name?: string;
  icon?: React.ComponentType<{ className?: string; size?: number | string; strokeWidth?: number | string }>;
  size?: IconSize;
  variant?: IconVariant;
  strokeWidth?: number;
  className?: string;
  rtlMirror?: boolean;
  label?: string;
}

const sizeMap: Record<string, number> = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
};

const variantMap: Record<IconVariant, string> = {
  default: '',
  primary: 'text-sky-600',
  secondary: 'text-slate-600',
  muted: 'text-slate-400',
  success: 'text-emerald-600',
  warning: 'text-amber-600',
  danger: 'text-rose-600',
  info: 'text-sky-600',
  white: 'text-white',
};

// Semantic Icon Resolver Map for Dory Medical SaaS
const semanticIconMap: Record<string, keyof typeof LucideIcons> = {
  // Medical & Clinic
  doctor: 'Stethoscope',
  stethoscope: 'Stethoscope',
  clinic: 'Building2',
  building: 'Building2',
  patient: 'User',
  patients: 'Users',
  ticket: 'Ticket',
  queue: 'Users',
  appointment: 'Calendar',
  calendar: 'Calendar',
  followup: 'Clock',
  prescription: 'FileText',
  'medical-record': 'ClipboardList',
  medical: 'Activity',

  // Finance
  finance: 'DollarSign',
  revenue: 'TrendingUp',
  payment: 'CreditCard',
  receipt: 'Receipt',
  refund: 'RotateCcw',
  expense: 'TrendingDown',
  wallet: 'Wallet',
  cash: 'Banknote',
  card: 'CreditCard',

  // Laboratory
  lab: 'Microscope',
  'lab-test': 'TestTube2',
  sample: 'Pipette',
  result: 'FileCheck',

  // System & Navigation
  dashboard: 'LayoutDashboard',
  settings: 'Settings',
  team: 'Users',
  permissions: 'ShieldCheck',
  security: 'Lock',
  key: 'KeyRound',
  analytics: 'BarChart3',
  reports: 'FileSpreadsheet',
  subscription: 'Crown',
  qr: 'QrCode',
  scanner: 'Camera',
  help: 'HelpCircle',
  logout: 'LogOut',

  // General Actions
  search: 'Search',
  bell: 'Bell',
  mail: 'Mail',
  phone: 'Phone',
  'map-pin': 'MapPin',
  lock: 'Lock',
  plus: 'Plus',
  minus: 'Minus',
  edit: 'Pencil',
  trash: 'Trash2',
  check: 'Check',
  'check-circle': 'CheckCircle2',
  x: 'X',
  close: 'X',
  'x-circle': 'XCircle',
  info: 'Info',
  warning: 'AlertTriangle',
  alert: 'AlertCircle',
  sparkles: 'Sparkles',

  // Arrows / RTL candidate icons
  'arrow-left': 'ArrowLeft',
  'arrow-right': 'ArrowRight',
  'chevron-left': 'ChevronLeft',
  'chevron-right': 'ChevronRight',
};

// Icons that should automatically flip in RTL mode (Arabic)
const rtlAutoMirror = new Set([
  'arrow-left',
  'arrow-right',
  'chevron-left',
  'chevron-right',
  'ArrowLeft',
  'ArrowRight',
  'ChevronLeft',
  'ChevronRight',
  'LogOut',
  'logout',
  'Send',
  'send',
]);

export const Icon: React.FC<IconProps> = ({
  name,
  icon: IconComponent,
  size = 'xl',
  variant = 'default',
  strokeWidth = 1.75,
  className = '',
  rtlMirror,
  label,
  ...props
}) => {
  const numericSize = typeof size === 'number' ? size : sizeMap[size] || 20;

  // Resolve component
  let Component: React.ComponentType<any> | null = IconComponent || null;

  if (!Component && name) {
    // 1. Check direct Lucide name
    if (name in LucideIcons) {
      Component = LucideIcons[name as keyof typeof LucideIcons] as React.ComponentType<any>;
    } else {
      // 2. Check semantic map
      const mappedName = semanticIconMap[name.toLowerCase()];
      if (mappedName && mappedName in LucideIcons) {
        Component = LucideIcons[mappedName] as React.ComponentType<any>;
      }
    }
  }

  // Fallback to HelpCircle if name specified but not found
  if (!Component && name) {
    Component = LucideIcons.HelpCircle;
  }

  if (!Component) {
    return null;
  }

  const isRtlMirrored = rtlMirror ?? (name ? rtlAutoMirror.has(name) : false);

  const combinedClassName = [
    'shrink-0 inline-block align-middle transition-colors duration-150',
    variantMap[variant],
    isRtlMirrored ? 'rtl:rotate-180' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Component
      size={numericSize}
      strokeWidth={strokeWidth}
      className={combinedClassName}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      {...props}
    />
  );
};

export const DoryIcon = Icon;

/**
 * Clean, subtle Dory AI Badge Component
 * Used across medical AI features instead of generic emojis or bright AI sparkles.
 */
export const DoryAIIcon: React.FC<{ size?: IconSize; className?: string }> = ({
  className = '',
}) => {
  return (
    <span className={`inline-flex items-center justify-center rounded-md bg-teal-50 px-1.5 py-0.5 text-[10px] font-bold text-teal-800 border border-teal-200/70 ${className}`}>
      <LucideIcons.Activity className="w-3 h-3 ml-1 text-teal-700 shrink-0" strokeWidth={1.75} />
      <span>ذكاء طبي</span>
    </span>
  );
};

export const DoryAIBadge = DoryAIIcon;
