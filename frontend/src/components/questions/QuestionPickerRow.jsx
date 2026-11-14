import { DIFFICULTY_TONE } from '../../lib/constants.js';
import { cn, dirOf, num } from '../../lib/utils.js';
import { Markdown } from '../markdown/Markdown.jsx';
import { MathTex } from '../markdown/MathTex.jsx';
import { Badge, KindBadge } from '../ui/index.js';

export function QuestionPickerRow({ q, selected, onToggle }) {
  const dir = q.dir || dirOf(q.lang);

  const handleKeyDown = (e) => {
    if (e.target.closest('a')) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle(q);
    }
  };

  const handleClick = (e) => {
    if (e.target.closest('a')) return;
    onToggle(q);
  };

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        aria-label={selected ? 'Deselect question' : 'Select question'}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          'block w-full cursor-pointer rounded-xl border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400',
          selected
            ? 'border-indigo-400 bg-indigo-50/80 shadow-pop ring-2 ring-indigo-300'
            : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50'
        )}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <KindBadge kind={q.kind} />
          <Badge tone="slate">{q.type}</Badge>
          {q.chapter_name && <Badge tone="indigo">{q.chapter_name}</Badge>}
          <Badge tone={DIFFICULTY_TONE[q.difficulty] || 'slate'}>{q.difficulty}</Badge>
          <Badge tone="sky">{q.lang}</Badge>
          <Badge tone="violet">{num(q.marks)} mk</Badge>
        </div>

        <div className={cn('mt-2', dir === 'rtl' ? 'rtl-text' : 'ltr-text')}>
          {q.text ? (
            <Markdown dir={dir} className="text-sm leading-relaxed text-slate-800">
              {q.text}
            </Markdown>
          ) : (
            <span className="text-sm text-slate-400">(no text)</span>
          )}
          {q.math && <MathTex tex={q.math} display className="mt-1 text-sm text-slate-700" />}
        </div>

        {q.options && q.options.length > 0 && (
          <ol className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
            {q.options.map((opt, i) => (
              <li key={i} className="flex items-center gap-2 rounded-md bg-slate-50 px-2 py-1">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">
                  {String.fromCharCode(65 + i)}
                </span>
                <Markdown inline dir={dir} className="text-xs text-slate-600">
                  {opt}
                </Markdown>
              </li>
            ))}
          </ol>
        )}
      </div>
    </li>
  );
}
