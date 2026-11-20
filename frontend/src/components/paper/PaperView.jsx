import { bnNum, cn, dirOf, optionLetter, prettyDate } from '../../lib/utils.js';
import { Markdown } from '../markdown/Markdown.jsx';
import { MathTex } from '../markdown/MathTex.jsx';
import { Badge, Button, Card, KindBadge } from '../ui/index.js';

export function PaperView({ paper, onBack, backLabel = 'ফিরে যান' }) {
  if (!paper) return null;
  const inst = paper.institute || {};

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="secondary" icon="arrowLeft" onClick={onBack}>
          {backLabel}
        </Button>
        <div className="flex items-center gap-2">
          <Badge tone="indigo">{bnNum(paper.total_questions)}টি প্রশ্ন</Badge>
          <Badge tone="violet">{bnNum(paper.total_marks)} নম্বর</Badge>
          {paper.id && <Badge tone="emerald">সংরক্ষিত #{bnNum(paper.id)}</Badge>}
          <Button variant="secondary" size="sm" icon="printer" onClick={() => window.print()}>
            মুদ্রণ
          </Button>
        </div>
      </div>

      <Card className="p-6 sm:p-8">
        {/* Institute */}
        <div className="border-b border-slate-200 pb-5 text-center">
          {inst.logo_url && (
            <img
              src={inst.logo_url}
              alt="প্রতিষ্ঠানের লোগো"
              className="mx-auto mb-3 h-16 w-16 rounded object-contain"
            />
          )}
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            {inst.name || 'প্রতিষ্ঠান'}
          </h2>
          {inst.location && <p className="mt-0.5 text-sm text-slate-500">{inst.location}</p>}
        </div>

        {/* Title / meta */}
        <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{paper.title}</h3>
            {paper.generated_at && (
              <p className="text-xs text-slate-500">
                তৈরি হয়েছে {prettyDate(paper.generated_at)}
              </p>
            )}
          </div>
          <div className="text-right text-sm text-slate-600">
            <p>
              <span className="font-semibold text-slate-900">{bnNum(paper.total_questions)}</span>টি
              প্রশ্ন
            </p>
            <p>
              <span className="font-semibold text-slate-900">{bnNum(paper.total_marks)}</span> নম্বর
            </p>
            {paper.meta?.duration_minutes ? (
              <p>সময়কাল: {bnNum(paper.meta.duration_minutes)} মিনিট</p>
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
                  {bnNum(q.number)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <KindBadge kind={q.kind} />
                    <Badge tone="slate">{q.type}</Badge>
                    <Badge tone="violet">{bnNum(q.marks)} নম্বর</Badge>
                    {q.chapter_name && <Badge tone="indigo">{q.chapter_name}</Badge>}
                  </div>
                  {q.text && (
                    <Markdown
                      dir={dir}
                      className={cn(
                        'text-sm leading-relaxed text-slate-800',
                        dir === 'rtl' ? 'rtl-text' : 'ltr-text'
                      )}
                    >
                      {q.text}
                    </Markdown>
                  )}
                  {q.math && <MathTex tex={q.math} display className="mt-1 text-sm text-slate-700" />}
                  {q.image_url && (
                    <img
                      src={q.image_url}
                      alt="প্রশ্নের চিত্র"
                      className="mt-2 max-h-52 rounded border border-slate-200 object-contain"
                    />
                  )}
                  {q.options && q.options.length > 0 && (
                    <ol className="mt-2 grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
                      {q.options.map((opt, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="font-semibold text-slate-500">{optionLetter(i)})</span>
                          <Markdown inline dir={dir} className="text-sm text-slate-700">
                            {opt}
                          </Markdown>
                        </li>
                      ))}
                    </ol>
                  )}
                  {q.answer != null && q.kind !== 'mcq' && (
                    <div className="mt-1 text-xs font-medium text-emerald-700">
                      উত্তর:{' '}
                      <Markdown inline dir={dir} className="text-xs font-medium text-emerald-700">
                        {String(q.answer)}
                      </Markdown>
                    </div>
                  )}
                  {q.description && (
                    <Markdown dir={dir} className="mt-1 text-xs text-slate-500">
                      {q.description}
                    </Markdown>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {/* Answer key */}
        {Array.isArray(paper.answer_key) && paper.answer_key.length > 0 && (
          <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="mb-2 text-sm font-semibold text-slate-800">উত্তরমালা</h4>
            <div className="grid grid-cols-2 gap-1 text-sm text-slate-700 sm:grid-cols-4">
              {paper.answer_key.map((a) => (
                <p key={a.number}>
                  <span className="font-semibold">{bnNum(a.number)}.</span>{' '}
                  {a.answer != null && (
                    <Markdown inline className="text-sm text-slate-700">
                      {String(a.answer)}
                    </Markdown>
                  )}
                  {a.correct_option && (
                    <span className="text-xs text-slate-400"> ({optionLetter(a.correct_option - 1)})</span>
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
