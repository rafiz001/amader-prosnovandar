import { cn, dirOf, num, prettyDate } from '../../lib/utils.js';
import { Badge, Button, Card, KindBadge } from '../ui/index.js';

export function PaperView({ paper, onBack, backLabel = 'Back' }) {
  if (!paper) return null;
  const inst = paper.institute || {};

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="secondary" icon="arrowLeft" onClick={onBack}>
          {backLabel}
        </Button>
        <div className="flex items-center gap-2">
          <Badge tone="indigo">{num(paper.total_questions)} questions</Badge>
          <Badge tone="violet">{num(paper.total_marks)} marks</Badge>
          {paper.id && <Badge tone="emerald">Saved #{paper.id}</Badge>}
          <Button variant="secondary" size="sm" icon="printer" onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </div>

      <Card className="p-6 sm:p-8">
        {/* Institute */}
        <div className="border-b border-slate-200 pb-5 text-center">
          {inst.logo_url && (
            <img
              src={inst.logo_url}
              alt=""
              className="mx-auto mb-3 h-16 w-16 rounded object-contain"
            />
          )}
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            {inst.name || 'Institute'}
          </h2>
          {inst.location && <p className="mt-0.5 text-sm text-slate-500">{inst.location}</p>}
        </div>

        {/* Title / meta */}
        <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{paper.title}</h3>
            {paper.generated_at && (
              <p className="text-xs text-slate-500">
                Generated {prettyDate(paper.generated_at)}
              </p>
            )}
          </div>
          <div className="text-right text-sm text-slate-600">
            <p>
              <span className="font-semibold text-slate-900">{paper.total_questions}</span>{' '}
              questions
            </p>
            <p>
              <span className="font-semibold text-slate-900">{paper.total_marks}</span> marks
            </p>
            {paper.meta?.duration_minutes ? (
              <p>Duration: {paper.meta.duration_minutes} min</p>
            ) : null}
          </div>
        </div>

        {/* Questions */}
        <ol className="mt-6 space-y-5">
          {(paper.questions || []).map((q) => {
            const dir = q.dir || dirOf(q.lang);
            return (
              <li key={`${q.id}-${q.number}`} className="flex gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                  {q.number}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <KindBadge kind={q.kind} />
                    <Badge tone="slate">{q.type}</Badge>
                    <Badge tone="violet">{num(q.marks)} mk</Badge>
                    {q.chapter_name && <Badge tone="indigo">{q.chapter_name}</Badge>}
                  </div>
                  {q.text && (
                    <p
                      className={cn(
                        'text-sm leading-relaxed text-slate-800',
                        dir === 'rtl' ? 'rtl-text' : 'ltr-text'
                      )}
                    >
                      {q.text}
                    </p>
                  )}
                  {q.math && <p className="math-tex mt-1 text-sm text-slate-700">{q.math}</p>}
                  {q.image_url && (
                    <img
                      src={q.image_url}
                      alt=""
                      className="mt-2 max-h-52 rounded border border-slate-200 object-contain"
                    />
                  )}
                  {q.options && q.options.length > 0 && (
                    <ol className="mt-2 grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
                      {q.options.map((opt, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="font-semibold text-slate-500">
                            {String.fromCharCode(65 + i)})
                          </span>
                          <span className={dir === 'rtl' ? 'rtl-text' : ''}>{opt}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                  {q.answer != null && q.kind !== 'mcq' && (
                    <p className="mt-1 text-xs font-medium text-emerald-700">
                      Answer: {String(q.answer)}
                    </p>
                  )}
                  {q.description && (
                    <p className="mt-1 text-xs italic text-slate-500">{q.description}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {/* Answer key */}
        {Array.isArray(paper.answer_key) && paper.answer_key.length > 0 && (
          <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="mb-2 text-sm font-semibold text-slate-800">Answer key</h4>
            <div className="grid grid-cols-2 gap-1 text-sm text-slate-700 sm:grid-cols-4">
              {paper.answer_key.map((a) => (
                <p key={a.number}>
                  <span className="font-semibold">{a.number}.</span> {a.answer}
                  {a.correct_option && (
                    <span className="text-xs text-slate-400">
                      {' '}
                      ({String.fromCharCode(64 + a.correct_option)})
                    </span>
                  )}
                </p>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
