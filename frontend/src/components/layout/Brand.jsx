import { Icon } from '../Icon.jsx';

export function Brand({ compact = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
        <Icon name="book" className="h-5 w-5" />
      </span>
      {!compact && (
        <div className="leading-tight">
          <p className="text-sm font-semibold text-slate-900">Question Bank</p>
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Admin · v2.0
          </p>
        </div>
      )}
    </div>
  );
}
