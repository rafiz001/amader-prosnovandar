import { cn } from '../../lib/utils.js';

export function Toggle({ checked, onChange, label, hint, disabled = false, className }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition',
        checked
          ? 'border-indigo-200 bg-indigo-50/50'
          : 'border-slate-200 bg-white hover:bg-slate-50',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-700">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-slate-400">{hint}</span>}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-full transition-colors',
          checked ? 'bg-indigo-600' : 'bg-slate-300'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[1.125rem]' : 'translate-x-0.5'
          )}
        />
      </span>
    </button>
  );
}
