import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useToast } from '../../context/ToastContext.jsx';
import { API } from '../../lib/api.js';
import {
  DEFAULT_LAYOUT,
  PAGE_SIZES,
  formatNumber,
  optionMarker,
  pageDimensions,
  paginateQuestions,
  questionMarker,
} from '../../lib/paperLayout.js';
import { cn, dirOf, prettyDate } from '../../lib/utils.js';
import { Markdown } from '../markdown/Markdown.jsx';
import { MathTex } from '../markdown/MathTex.jsx';
import { Badge, Button } from '../ui/index.js';

const MM_TO_PX = 96 / 25.4;
const COLUMN_GAP_MM = 8;
const PAGE_SLACK_PX = 2;
const MAX_IMAGE = 5 * 1024 * 1024;

const EDIT_INPUT =
  'w-full rounded-md border border-indigo-200 bg-white px-2 py-1 text-[13px] leading-relaxed text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100';
const EDIT_LABEL =
  'mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-indigo-500';

function EditField({ label, children, className }) {
  return (
    <div className={className}>
      <span className={EDIT_LABEL}>{label}</span>
      {children}
    </div>
  );
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

/**
 * Keeps derived paper data consistent after editing: question numbers, the answer
 * key and the totals all follow the questions.
 */
function withTotals(paper) {
  const questions = (paper.questions || []).map((q, index) => ({
    ...q,
    number: index + 1,
  }));
  const total_marks = questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
  const answer_key = questions
    .filter((q) => q.kind === 'mcq' || q.kind === 'true_false')
    .map((q) => ({
      number: q.number,
      type: q.type,
      kind: q.kind,
      ...(q.correct_option != null ? { correct_option: q.correct_option } : {}),
      answer: q.answer == null ? '' : String(q.answer),
    }));
  return {
    ...paper,
    questions,
    total_questions: questions.length,
    total_marks,
    answer_key,
  };
}

function OptionMarker({ marker }) {
  if (marker.circle) {
    return (
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-slate-500 text-[10px] font-semibold leading-none text-slate-700">
        {marker.label}
      </span>
    );
  }
  return <span className="shrink-0 font-semibold text-slate-500">{marker.label}</span>;
}

function QuestionMarker({ marker }) {
  if (marker.circle) {
    return (
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-slate-500 bg-transparent text-[11px] font-semibold leading-none text-slate-700">
        {marker.label}
      </span>
    );
  }
  return <span className="shrink-0 text-[13px] font-semibold text-slate-600">{marker.label}</span>;
}

function PaperHeader({
  paper,
  layout,
  fmt,
  editing,
  onTitle,
  onInstitute,
  onMeta,
}) {
  const inst = paper.institute || {};
  const { institute, title, summary } = layout.headings;
  if (!institute && !title && !summary) return null;

  return (
    <>
      {institute && (
        <div className="border-b border-slate-300 pb-4 text-center">
          {inst.logo_url && (
            <img
              src={inst.logo_url}
              alt="প্রতিষ্ঠানের লোগো"
              className="mx-auto mb-2 h-14 w-14 rounded object-contain"
            />
          )}
          {editing ? (
            <div className="mx-auto max-w-xl space-y-1">
              <input
                className={cn(EDIT_INPUT, 'text-center text-lg font-bold')}
                value={inst.name || ''}
                onChange={(e) => onInstitute({ name: e.target.value })}
                placeholder="প্রতিষ্ঠানের নাম"
              />
              <input
                className={cn(EDIT_INPUT, 'text-center text-sm')}
                value={inst.location || ''}
                onChange={(e) => onInstitute({ location: e.target.value })}
                placeholder="অবস্থান"
              />
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                {inst.name || 'প্রতিষ্ঠান'}
              </h2>
              {inst.location && (
                <p className="mt-0.5 text-sm text-slate-500">{inst.location}</p>
              )}
            </>
          )}
        </div>
      )}

      {(title || summary) && (
        <div
          className={cn(
            'flex flex-wrap items-start justify-between gap-3',
            institute && 'pt-4'
          )}
        >
          {title && (
            <div className="min-w-0 flex-1">
              {editing ? (
                <input
                  className={cn(EDIT_INPUT, 'text-lg font-semibold')}
                  value={paper.title || ''}
                  onChange={(e) => onTitle(e.target.value)}
                  onBlur={(e) => {
                    if (!e.target.value.trim()) onTitle('প্রশ্নপত্র');
                  }}
                  placeholder="প্রশ্নপত্রের শিরোনাম"
                />
              ) : (
                <h3 className="text-lg font-semibold text-slate-900">{paper.title}</h3>
              )}
              {paper.generated_at && (
                <p className="text-xs text-slate-500">
                  তৈরি হয়েছে {prettyDate(paper.generated_at)}
                </p>
              )}
            </div>
          )}
          {summary && (
            <div className="ml-auto text-right text-sm text-slate-600">
              <p>
                <span className="font-semibold text-slate-900">
                  {fmt(paper.total_questions)}
                </span>
                টি প্রশ্ন
              </p>
              <p>
                <span className="font-semibold text-slate-900">{fmt(paper.total_marks)}</span>{' '}
                নম্বর
              </p>
              {editing ? (
                <p className="mt-1 flex items-center justify-end gap-1">
                  <span>সময়কাল:</span>
                  <input
                    type="number"
                    min="1"
                    className={cn(EDIT_INPUT, 'w-20 text-right')}
                    value={paper.meta?.duration_minutes ?? ''}
                    onChange={(e) =>
                      onMeta({
                        duration_minutes:
                          e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                  />
                  <span>মিনিট</span>
                </p>
              ) : paper.meta?.duration_minutes ? (
                <p>সময়কাল: {fmt(paper.meta.duration_minutes)} মিনিট</p>
              ) : null}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function QuestionBlock({
  q,
  index,
  layout,
  editing,
  showAnswers,
  onChange,
  onImage,
}) {
  const dir = q.dir || dirOf(q.lang);
  const narrow = layout.columns === 2 || layout.pageSize === 'A5';

  return (
    <div className="flex gap-2">
      <QuestionMarker
        marker={questionMarker(
          q.number ?? index + 1,
          layout.questionMarkerStyle,
          layout.numberFormat
        )}
      />
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="space-y-2 rounded-lg border border-indigo-100 bg-indigo-50/30 p-2">
            <EditField label="প্রশ্নের লেখা · মার্কডাউন">
              <textarea
                rows={3}
                dir={dir}
                className={EDIT_INPUT}
                value={q.text || ''}
                onChange={(e) => onChange({ text: e.target.value })}
                placeholder="প্রশ্নের লেখা"
              />
            </EditField>

            <div className="grid gap-2 sm:grid-cols-[1fr_6rem]">
              <EditField label="গণিত · LaTeX">
                <input
                  dir="ltr"
                  className={EDIT_INPUT}
                  value={q.math || ''}
                  onChange={(e) => onChange({ math: e.target.value })}
                  placeholder="ঐচ্ছিক"
                />
              </EditField>
              <EditField label="নম্বর">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  className={EDIT_INPUT}
                  value={q.marks ?? 1}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    onChange({
                      marks: Number.isFinite(value) && value >= 0 ? value : 0,
                    });
                  }}
                />
              </EditField>
            </div>

            <div>
              <span className={EDIT_LABEL}>চিত্র</span>
              {q.image_url ? (
                <div className="flex flex-wrap items-start gap-2">
                  <img
                    src={q.image_url}
                    alt="প্রশ্নের চিত্র"
                    className="max-h-28 rounded border border-slate-200 bg-white object-contain p-1"
                  />
                  <div className="flex flex-wrap gap-1">
                    <label className="cursor-pointer rounded-md border border-indigo-200 bg-white px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50">
                      চিত্র বদলান
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/gif,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (file) onImage(file);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => onChange({ image_url: null })}
                      className="rounded-md border border-rose-200 bg-white px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                    >
                      চিত্র সরান
                    </button>
                  </div>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed border-indigo-200 bg-white px-3 py-2 text-xs text-indigo-600 hover:bg-indigo-50">
                  চিত্র যোগ করুন
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) onImage(file);
                    }}
                  />
                </label>
              )}
            </div>

            {q.kind === 'mcq' && Array.isArray(q.options) && (
              <div className="space-y-1">
                <span className={EDIT_LABEL}>বিকল্প · সঠিকটি বাছুন</span>
                {q.options.map((option, i) => {
                  const correct = Number(q.correct_option) === i + 1;
                  return (
                    <label
                      key={i}
                      className={cn(
                        'flex items-center gap-2 rounded-md border bg-white px-2 py-1',
                        correct
                          ? 'border-emerald-300 ring-1 ring-emerald-100'
                          : 'border-slate-200'
                      )}
                    >
                      <input
                        type="radio"
                        checked={correct}
                        onChange={() => onChange({ correct_option: i + 1 })}
                        className="h-3.5 w-3.5 accent-emerald-600"
                      />
                      <span className="w-5 shrink-0 text-center text-xs font-semibold text-slate-500">
                        {optionMarker(i, layout.markerStyle, layout.numberFormat).label}
                      </span>
                      <input
                        dir={dir}
                        className={cn(EDIT_INPUT, 'border-0 px-1 py-0.5 focus:ring-0')}
                        value={option}
                        onChange={(e) => {
                          const options = [...q.options];
                          options[i] = e.target.value;
                          onChange({ options });
                        }}
                      />
                    </label>
                  );
                })}
              </div>
            )}

            {q.kind === 'true_false' && (
              <EditField label="সঠিক উত্তর">
                <select
                  className={EDIT_INPUT}
                  value={String(q.answer) === 'false' ? 'false' : 'true'}
                  onChange={(e) => onChange({ answer: e.target.value })}
                >
                  <option value="true">সত্য</option>
                  <option value="false">মিথ্যা</option>
                </select>
              </EditField>
            )}

            {q.kind !== 'mcq' && q.kind !== 'true_false' && (
              <EditField label="আদর্শ উত্তর">
                <textarea
                  rows={2}
                  dir={dir}
                  className={EDIT_INPUT}
                  value={q.answer ?? ''}
                  onChange={(e) => onChange({ answer: e.target.value })}
                  placeholder="ঐচ্ছিক"
                />
              </EditField>
            )}

            <EditField label="ব্যাখ্যা / সমাধান">
              <textarea
                rows={2}
                dir={dir}
                className={EDIT_INPUT}
                value={q.description ?? ''}
                onChange={(e) => onChange({ description: e.target.value })}
                placeholder="ঐচ্ছিক"
              />
            </EditField>
          </div>
        ) : (
          <>
            {q.text && (
              <Markdown
                dir={dir}
                className={cn(
                  'text-[13px] leading-relaxed text-slate-800',
                  dir === 'rtl' ? 'rtl-text' : 'ltr-text'
                )}
              >
                {q.text}
              </Markdown>
            )}
            {q.math && (
              <MathTex tex={q.math} display className="mt-1 text-sm text-slate-700" />
            )}
            {q.image_url && (
              <img
                src={q.image_url}
                alt="প্রশ্নের চিত্র"
                className="mt-2 max-h-52 rounded border border-slate-200 object-contain"
              />
            )}

            {q.options && q.options.length > 0 && (
              <ol
                className={cn(
                  'mt-1.5 grid gap-1 text-[13px] text-slate-700',
                  narrow ? 'grid-cols-1' : 'grid-cols-2'
                )}
              >
                {q.options.map((opt, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <OptionMarker
                      marker={optionMarker(i, layout.markerStyle, layout.numberFormat)}
                    />
                    <Markdown inline dir={dir} className="text-[13px] text-slate-700">
                      {opt}
                    </Markdown>
                  </li>
                ))}
              </ol>
            )}

            {showAnswers && q.answer != null && q.kind !== 'mcq' && (
              <div className="mt-1 text-xs font-medium text-emerald-700">
                উত্তর:{' '}
                <Markdown inline dir={dir} className="text-xs font-medium text-emerald-700">
                  {String(q.answer)}
                </Markdown>
              </div>
            )}
            {showAnswers && q.description && (
              <Markdown dir={dir} className="mt-1 text-xs text-slate-500">
                {q.description}
              </Markdown>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function AnswerKeyBlock({ paper, layout, fmt }) {
  const entries = paper.answer_key || [];
  if (!entries.length) return null;

  return (
    <div className="rounded-lg border border-slate-300 p-3">
      <h4 className="mb-1.5 text-sm font-semibold text-slate-800">উত্তরমালা</h4>
      <div
        className={cn(
          'grid gap-1 text-[13px] text-slate-700',
          layout.pageSize === 'A5' ? 'grid-cols-2' : 'grid-cols-4'
        )}
      >
        {entries.map((a) => {
          const marker = a.correct_option
            ? optionMarker(
                a.correct_option - 1,
                layout.markerStyle,
                layout.numberFormat
              )
            : null;
          return (
            <p key={a.number}>
              <span className="font-semibold">{fmt(a.number)}.</span>{' '}
              {a.answer != null && (
                <Markdown inline className="text-[13px] text-slate-700">
                  {String(a.answer)}
                </Markdown>
              )}
              {marker && (
                <span className="ml-1 text-xs text-slate-500">({marker.label})</span>
              )}
            </p>
          );
        })}
      </div>
    </div>
  );
}

export function PaperView({ paper, ...props }) {
  if (!paper) return null;
  return <PaperContent paper={paper} {...props} />;
}

function PaperContent({
  paper: initialPaper,
  onBack,
  backLabel = 'ফিরে যান',
  layout = DEFAULT_LAYOUT,
  onChange,
}) {
  const toast = useToast();
  const [paper, setPaper] = useState(initialPaper);
  const [editing, setEditing] = useState(false);
  const [saveState, setSaveState] = useState('idle');
  const latestRef = useRef(initialPaper);
  const dirtyRef = useRef(false);
  const timerRef = useRef(null);

  useEffect(() => {
    setPaper(initialPaper);
    latestRef.current = initialPaper;
    dirtyRef.current = false;
    setSaveState('idle');
    // Only reload when a different paper arrives.
  }, [initialPaper?.id, initialPaper?.generated_at]);

  const saveNow = async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const current = latestRef.current;
    if (!dirtyRef.current || !current) return;
    if (!current.id) {
      dirtyRef.current = false;
      return;
    }
    dirtyRef.current = false;
    setSaveState('saving');
    try {
      await API.papers.update(current.id, current);
      setSaveState('saved');
    } catch (error) {
      dirtyRef.current = true;
      setSaveState('error');
      toast.error(error.message);
    }
  };

  useEffect(() => {
    if (!dirtyRef.current || !paper?.id) return undefined;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      saveNow();
    }, 700);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [paper]);

  useEffect(
    () => () => {
      if (dirtyRef.current && latestRef.current?.id) {
        API.papers.update(latestRef.current.id, latestRef.current).catch(() => {});
      }
    },
    []
  );

  const apply = (next) => {
    latestRef.current = next;
    dirtyRef.current = true;
    if (next?.id) setSaveState('saving');
    setPaper(next);
    onChange?.(next);
  };

  const patch = (updater) => apply(updater(latestRef.current));
  const patchInstitute = (changes) =>
    patch((prev) => ({
      ...prev,
      institute: { ...(prev.institute || {}), ...changes },
    }));
  const patchMeta = (changes) =>
    patch((prev) => ({ ...prev, meta: { ...(prev.meta || {}), ...changes } }));
  const patchQuestion = (index, changes) =>
    patch((prev) => {
      const questions = (prev.questions || []).map((q, i) => {
        if (i !== index) return q;
        const next = { ...q, ...changes };
        if (next.kind === 'mcq') {
          const correct = Number(next.correct_option);
          if (
            Array.isArray(next.options) &&
            correct >= 1 &&
            correct <= next.options.length
          ) {
            next.answer = next.options[correct - 1];
          }
        }
        return next;
      });
      return withTotals({ ...prev, questions });
    });

  const patchImage = async (index, file) => {
    if (file.size > MAX_IMAGE) {
      toast.error('ছবিটি ৫ মেগাবাইট বা তার কম হতে হবে');
      return;
    }
    try {
      const image_url = await readAsDataUrl(file);
      patchQuestion(index, { image_url });
    } catch {
      toast.error('ছবি পড়া যায়নি');
    }
  };

  const finishEditing = async () => {
    await saveNow();
    setEditing(false);
  };

  const printPaper = async () => {
    await saveNow();
    setEditing(false);
    setTimeout(() => window.print(), 60);
  };

  const l = {
    ...DEFAULT_LAYOUT,
    ...layout,
    headings: { ...DEFAULT_LAYOUT.headings, ...(layout?.headings || {}) },
  };
  const questions = paper.questions || [];
  const dims = pageDimensions(l);
  const margin = Math.min(40, Math.max(5, Number(l.margin) || 14));
  const contentWidth = dims.width - margin * 2;
  const twoCols = l.columns === 2;
  const colWidth = twoCols ? (contentWidth - COLUMN_GAP_MM) / 2 : contentWidth;
  const pageName = PAGE_SIZES[l.pageSize]?.label || 'A4';
  const orientationName = l.orientation === 'landscape' ? 'আড়াআড়ি' : 'খাড়া';
  const headerShown = l.headings.institute || l.headings.title || l.headings.summary;
  const answersVisible =
    typeof paper.include_answers === 'boolean'
      ? paper.include_answers
      : Array.isArray(paper.answer_key) && paper.answer_key.length > 0;
  const answerShown =
    answersVisible &&
    l.headings.answerKey &&
    Array.isArray(paper.answer_key) &&
    paper.answer_key.length > 0;
  const fmt = (value) => formatNumber(value, l.numberFormat);

  const measureRef = useRef(null);
  const pagesKeyRef = useRef('');
  const [pages, setPages] = useState([]);

  useLayoutEffect(() => {
    const root = measureRef.current;
    if (!root) return;
    let alive = true;

    const compute = () => {
      if (!alive) return;
      const headerEl = root.querySelector('[data-measure="header"]');
      const answerEl = root.querySelector('[data-measure="answer"]');
      const questionEls = Array.from(root.querySelectorAll('[data-measure="q"]'));
      const headerHeight = headerEl ? headerEl.getBoundingClientRect().height : 0;
      const answerHeight = answerEl ? answerEl.getBoundingClientRect().height : 0;
      const heights = questionEls.map((el) => el.getBoundingClientRect().height);
      const contentHeight = (dims.height - margin * 2) * MM_TO_PX - PAGE_SLACK_PX;
      const next = paginateQuestions(heights, {
        contentHeight,
        headerHeight,
        hasHeader: headerShown,
        columns: twoCols ? 2 : 1,
        answerKey: answerShown && answerHeight > 0,
      });

      const key = JSON.stringify(next);
      if (key !== pagesKeyRef.current) {
        pagesKeyRef.current = key;
        setPages(next);
      }
    };

    compute();
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(compute) : null;
    observer?.observe(root);
    if (document.fonts?.ready) document.fonts.ready.then(compute).catch(() => {});
    window.addEventListener('load', compute);

    return () => {
      alive = false;
      observer?.disconnect();
      window.removeEventListener('load', compute);
    };
  }, [
    paper,
    layout,
    dims.width,
    dims.height,
    margin,
    twoCols,
    headerShown,
    answerShown,
    editing,
  ]);

  const headerProps = {
    paper,
    layout: l,
    fmt,
    editing,
    onTitle: (title) => patch((prev) => ({ ...prev, title })),
    onInstitute: patchInstitute,
    onMeta: patchMeta,
  };
  const questionProps = (q, index) => ({
    q,
    index,
    layout: l,
    editing,
    showAnswers: answersVisible,
    onChange: (changes) => patchQuestion(index, changes),
    onImage: (file) => patchImage(index, file),
  });

  return (
    <div className="space-y-4 print:space-y-0">
      <style>{`@page { size: ${dims.width}mm ${dims.height}mm; margin: 0; }`}</style>

      <div
        ref={measureRef}
        aria-hidden="true"
        className="print:hidden"
        style={{
          position: 'fixed',
          left: '-10000px',
          top: 0,
          width: `${contentWidth}mm`,
          visibility: 'hidden',
          pointerEvents: 'none',
        }}
      >
        {headerShown && (
          <div data-measure="header" className="pb-4">
            <PaperHeader {...headerProps} />
          </div>
        )}
        {questions.map((q, index) => (
          <div
            key={`m-${q.id ?? index}`}
            data-measure="q"
            className="pb-4"
            style={{ width: `${colWidth}mm` }}
          >
            <QuestionBlock {...questionProps(q, index)} />
          </div>
        ))}
        {answerShown && (
          <div data-measure="answer" className="pt-2">
            <AnswerKeyBlock paper={paper} layout={l} fmt={fmt} />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button variant="secondary" icon="arrowLeft" onClick={onBack}>
          {backLabel}
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="slate">
            {pageName} · {orientationName} · {fmt(l.columns)} কলাম
            {pages.length > 0 ? ` · ${fmt(pages.length)} পৃষ্ঠা` : ''}
          </Badge>
          <Badge tone="indigo">{fmt(paper.total_questions)}টি প্রশ্ন</Badge>
          <Badge tone="violet">{fmt(paper.total_marks)} নম্বর</Badge>
          {paper.id && <Badge tone="emerald">সংরক্ষিত #{fmt(paper.id)}</Badge>}
          {paper.id && saveState === 'saving' && (
            <Badge tone="amber">সংরক্ষণ হচ্ছে…</Badge>
          )}
          {paper.id && saveState === 'saved' && (
            <Badge tone="emerald">পরিবর্তন সংরক্ষিত</Badge>
          )}
          {paper.id && saveState === 'error' && (
            <Badge tone="rose">সংরক্ষণ ব্যর্থ</Badge>
          )}

          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              checked={answersVisible}
              onChange={(e) =>
                patch((prev) => ({ ...prev, include_answers: e.target.checked }))
              }
              className="h-3.5 w-3.5 accent-indigo-600"
            />
            উত্তর দেখান
          </label>

          <Button
            variant={editing ? 'primary' : 'secondary'}
            size="sm"
            icon={editing ? 'check' : 'pencil'}
            onClick={editing ? finishEditing : () => setEditing(true)}
          >
            {editing ? 'সম্পাদনা শেষ' : 'সম্পাদনা'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon="printer"
            onClick={printPaper}
          >
            মুদ্রণ
          </Button>
        </div>
      </div>

      {editing && (
        <p className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700 print:hidden">
          প্রিভিউতে সরাসরি সম্পাদনা করুন — পরিবর্তনগুলো স্বয়ংক্রিয়ভাবে সংরক্ষিত হয়।
        </p>
      )}

      <div className="overflow-x-auto pb-2 print:overflow-visible print:pb-0">
        <div className="space-y-6 print:space-y-0">
          {pages.map((page, pageIndex) => (
            <section
              key={pageIndex}
              className={cn(
                'paper-sheet paper-page relative mx-auto flex flex-col overflow-hidden bg-white text-slate-900 shadow-xl ring-1 ring-slate-200 print:mx-0 print:shadow-none print:ring-0',
                pageIndex < pages.length - 1 && 'break-after-page'
              )}
              style={{
                width: `${dims.width}mm`,
                height: `${dims.height}mm`,
                padding: `${margin}mm`,
              }}
            >
              {page.header && (
                <div className="shrink-0 pb-4">
                  <PaperHeader {...headerProps} />
                </div>
              )}

              {page.answerKey ? (
                <div className="min-h-0 flex-1">
                  <AnswerKeyBlock paper={paper} layout={l} fmt={fmt} />
                </div>
              ) : twoCols ? (
                <div
                  className="grid min-h-0 flex-1"
                  style={{
                    gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
                    columnGap: `${COLUMN_GAP_MM}mm`,
                  }}
                >
                  {(page.columns || []).map((column, columnIndex) => (
                    <div key={columnIndex} className="min-w-0">
                      {column.map((questionIndex) => {
                        const q = questions[questionIndex];
                        if (!q) return null;
                        return (
                          <div key={questionIndex} className="pb-4">
                            <QuestionBlock {...questionProps(q, questionIndex)} />
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="min-h-0 flex-1">
                  {(page.questions || []).map((questionIndex) => {
                    const q = questions[questionIndex];
                    if (!q) return null;
                    return (
                      <div key={questionIndex} className="pb-4">
                        <QuestionBlock {...questionProps(q, questionIndex)} />
                      </div>
                    );
                  })}
                </div>
              )}

              <span
                className="absolute left-0 right-0 text-center text-[10px] text-slate-400"
                style={{ bottom: '2mm' }}
              >
                {fmt(pageIndex + 1)} / {fmt(pages.length)}
              </span>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
