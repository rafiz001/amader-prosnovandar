import { cn, dirOf, num } from '../../lib/utils.js';
import { DIFFICULTY_TONE } from '../../lib/constants.js';
import { Icon } from '../Icon.jsx';
import { Badge, Button, KindBadge } from '../ui/index.js';

export function QuestionRow({ q, onEdit, onDelete }) {
  const dir = q.dir || dirOf(q.lang);
  return (
    <li className="flex flex-wrap items-start gap-3 px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <KindBadge kind={q.kind} />
          <Badge tone="slate">{q.type}</Badge>
          {q.chapter_name && <Badge tone="indigo">{q.chapter_name}</Badge>}
          <Badge tone={DIFFICULTY_TONE[q.difficulty] || 'slate'}>{q.difficulty}</Badge>
          <Badge tone="sky">{q.lang}</Badge>
          <Badge tone="violet">{num(q.marks)} mk</Badge>
        </div>

        <div
          className={cn(
            'text-sm leading-relaxed text-slate-800',
            dir === 'rtl' ? 'rtl-text' : 'ltr-text'
          )}
        >
          {q.text || <span className="text-slate-400">(no text)</span>}
          {q.math && <span className="ml-1 math-tex text-slate-600">${q.math}$</span>}
        </div>

        {q.options && q.options.length > 0 && (
          <ol className="grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
            {q.options.map((opt, i) => (
              <li
                key={i}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1',
                  q.correct_option === i + 1
                    ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                    : 'bg-slate-50'
                )}
              >
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className={dir === 'rtl' ? 'rtl-text' : ''}>{opt}</span>
              </li>
            ))}
          </ol>
        )}

        {q.answer && q.kind !== 'mcq' && (
          <p className="text-xs text-emerald-700">
            <span className="font-semibold">Answer:</span> {q.answer}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button size="icon" variant="ghost" onClick={() => onEdit(q.id)} aria-label="Edit question">
          <Icon name="pencil" className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onDelete(q)}
          aria-label="Delete question"
        >
          <Icon name="trash" className="h-4 w-4 text-rose-600" />
        </Button>
      </div>
    </li>
  );
}
