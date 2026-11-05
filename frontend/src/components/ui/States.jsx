import { cn } from '../../lib/utils.js';
import { Icon } from '../Icon.jsx';
import { Button } from './Button.jsx';
import { Spinner } from './Spinner.jsx';

export function LoadingBlock({ label = 'Loading…', className }) {
  return (
    <div className={cn('flex items-center justify-center gap-3 py-14 text-sm text-slate-500', className)}>
      <Spinner className="h-5 w-5 text-indigo-500" />
      {label}
    </div>
  );
}

export function ErrorBlock({ error, onRetry, className }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-xl border border-rose-200 bg-rose-50/60 px-6 py-10 text-center',
        className
      )}
    >
      <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-rose-600 shadow-sm">
        <Icon name="alert" className="h-5 w-5" />
      </span>
      <div>
        <p className="text-sm font-semibold text-rose-800">Something went wrong</p>
        <p className="mt-1 max-w-md text-sm text-rose-700/80">{error?.message || 'Unknown error'}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" icon="refresh" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ icon = 'info', title, message, action, className }) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-6 py-14 text-center', className)}>
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-slate-100 text-slate-400">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <div>
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        {message && <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{message}</p>}
      </div>
      {action}
    </div>
  );
}
