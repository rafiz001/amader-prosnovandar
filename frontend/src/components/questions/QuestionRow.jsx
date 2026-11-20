import { DIFFICULTY_LABEL, DIFFICULTY_TONE, langLabel } from '../../lib/constants.js';
import { bnNum, cn, dirOf, optionLetter } from '../../lib/utils.js';
import { Icon } from '../Icon.jsx';
import { Markdown } from '../markdown/Markdown.jsx';
import { MathTex } from '../markdown/MathTex.jsx';
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
          <Badge tone={DIFFICULTY_TONE[q.difficulty] || 'slate'}>
            {DIFFICULTY_LABEL[q.difficulty] || q.difficulty}
          </Badge>
          <Badge tone="sky">{langLabel(q.lang)}</Badge>
          <Badge tone="violet">{bnNum(q.marks)} নম্বর</Badge>
        </div>

        <div className={dir === 'rtl' ? 'rtl-text' : 'ltr-text'}>
          {q.text ? (
            <Markdown dir={dir} className="text-sm leading-relaxed text-slate-800">
              {q.text}
            </Markdown>
          ) : (
            <span className="text-sm text-slate-400">(কোনো লেখা নেই)</span>
          )}
          {q.math && <MathTex tex={q.math} display className="mt-1 text-sm text-slate-700" />}
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
                  {optionLetter(i)}
                </span>
                <Markdown inline dir={dir} className="text-xs text-slate-600">
                  {opt}
                </Markdown>
              </li>
            ))}
          </ol>
        )}

        {q.answer && q.kind !== 'mcq' && (
          <div className="text-xs text-emerald-700">
            <span className="font-semibold">উত্তর:</span>{' '}
            <Markdown inline dir={dir} className="text-xs text-emerald-800">
              {q.answer}
            </Markdown>
          </div>
        )}

        {q.description && (
          <div className="rounded-md bg-slate-50 px-2 py-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              সমাধান
            </p>
            <Markdown dir={dir} className="text-xs text-slate-700">
              {q.description}
            </Markdown>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button size="icon" variant="ghost" onClick={() => onEdit(q.id)} aria-label="প্রশ্ন সম্পাদনা">
          <Icon name="pencil" className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onDelete(q)}
          aria-label="প্রশ্ন মুছুন"
        >
          <Icon name="trash" className="h-4 w-4 text-rose-600" />
        </Button>
      </div>
    </li>
  );
}
