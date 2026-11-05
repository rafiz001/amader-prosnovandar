import { cn } from '../../lib/utils.js';
import { Icon } from '../Icon.jsx';
import { Spinner } from './Spinner.jsx';

const BTN_VARIANTS = {
  primary: 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 focus-visible:ring-indigo-300',
  secondary:
    'bg-white text-slate-700 border border-slate-300 shadow-sm hover:bg-slate-50 focus-visible:ring-slate-300',
  ghost: 'text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-300',
  danger: 'bg-rose-600 text-white shadow-sm hover:bg-rose-700 focus-visible:ring-rose-300',
  dangerGhost: 'text-rose-600 hover:bg-rose-50 focus-visible:ring-rose-200',
  subtle: 'bg-slate-100 text-slate-700 hover:bg-slate-200 focus-visible:ring-slate-300',
};

const BTN_SIZES = {
  sm: 'h-8 gap-1.5 px-3 text-xs',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-11 gap-2 px-5 text-sm',
  icon: 'h-9 w-9',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  loading = false,
  icon,
  iconRight,
  children,
  ...rest
}) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center rounded-lg font-medium transition-colors',
        'focus:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50',
        BTN_VARIANTS[variant],
        BTN_SIZES[size],
        className
      )}
    >
      {loading ? (
        <Spinner className="h-4 w-4" />
      ) : icon ? (
        <Icon name={icon} className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      ) : null}
      {children}
      {iconRight ? <Icon name={iconRight} className="h-4 w-4" /> : null}
    </button>
  );
}
