import { KIND_LABEL, KIND_TONE } from '../../lib/constants.js';
import { cn } from '../../lib/utils.js';

const BADGE_TONES = {
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  rose: 'bg-rose-50 text-rose-700 ring-rose-200',
  sky: 'bg-sky-50 text-sky-700 ring-sky-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
};

export function Badge({ tone = 'slate', className, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
        BADGE_TONES[tone] || BADGE_TONES.slate,
        className
      )}
    >
      {children}
    </span>
  );
}

export function KindBadge({ kind }) {
  return <Badge tone={KIND_TONE[kind] || 'slate'}>{KIND_LABEL[kind] || kind}</Badge>;
}
