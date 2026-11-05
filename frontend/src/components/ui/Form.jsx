import { cn } from '../../lib/utils.js';

export const INPUT_CLASS =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm transition ' +
  'placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 ' +
  'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';

export function Input({ className, ...rest }) {
  return <input {...rest} className={cn(INPUT_CLASS, className)} />;
}

export function Textarea({ className, rows = 3, ...rest }) {
  return (
    <textarea rows={rows} {...rest} className={cn(INPUT_CLASS, 'resize-y leading-relaxed', className)} />
  );
}

export function Select({ className, children, ...rest }) {
  return (
    <select {...rest} className={cn(INPUT_CLASS, 'cursor-pointer appearance-none pr-9', className)}>
      {children}
    </select>
  );
}

export function Field({ label, hint, error, required, children, className, htmlFor }) {
  return (
    <div className={cn('block', className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500"
        >
          {label}
          {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1 text-xs font-medium text-rose-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}
