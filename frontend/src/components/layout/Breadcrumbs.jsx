import { Icon } from '../Icon.jsx';

export function Breadcrumbs({ stack, onGoto }) {
  if (stack.length === 0) return null;
  return (
    <nav className="flex min-w-0 items-center gap-1 text-sm" aria-label="Breadcrumb">
      {stack.map((crumb, index) => {
        const last = index === stack.length - 1;
        return (
          <span key={`${crumb.name}-${index}`} className="flex min-w-0 items-center gap-1">
            {index > 0 && <Icon name="chevronRight" className="h-3.5 w-3.5 shrink-0 text-slate-300" />}
            {last ? (
              <span className="truncate font-medium text-slate-900">{crumb.label}</span>
            ) : (
              <button
                onClick={() => onGoto(index)}
                className="truncate rounded px-1 py-0.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              >
                {crumb.label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
