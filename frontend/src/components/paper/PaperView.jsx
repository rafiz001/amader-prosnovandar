import { useLayoutEffect, useRef, useState } from 'react';
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

function PaperHeader({ paper, layout, fmt }) {
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
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            {inst.name || 'প্রতিষ্ঠান'}
          </h2>
          {inst.location && <p className="mt-0.5 text-sm text-slate-500">{inst.location}</p>}
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
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{paper.title}</h3>
              {paper.generated_at && (
                <p className="text-xs text-slate-500">তৈরি হয়েছে {prettyDate(paper.generated_at)}</p>
              )}
            </div>
          )}
          {summary && (
            <div className="ml-auto text-right text-sm text-slate-600">
              <p>
                <span className="font-semibold text-slate-900">{fmt(paper.total_questions)}</span>টি
                প্রশ্ন
              </p>
              <p>
                <span className="font-semibold text-slate-900">{fmt(paper.total_marks)}</span> নম্বর
              </p>
              {paper.meta?.duration_minutes ? (
                <p>সময়কাল: {fmt(paper.meta.duration_minutes)} মিনিট</p>
              ) : null}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function QuestionBlock({ q, index, layout }) {
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
        {q.math && <MathTex tex={q.math} display className="mt-1 text-sm text-slate-700" />}
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
                <OptionMarker marker={optionMarker(i, layout.markerStyle, layout.numberFormat)} />
                <Markdown inline dir={dir} className="text-[13px] text-slate-700">
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
            ? optionMarker(a.correct_option - 1, layout.markerStyle, layout.numberFormat)
            : null;
          return (
            <p key={a.number}>
              <span className="font-semibold">{fmt(a.number)}.</span>{' '}
              {a.answer != null && (
                <Markdown inline className="text-[13px] text-slate-700">
                  {String(a.answer)}
                </Markdown>
              )}
              {marker && <span className="ml-1 text-xs text-slate-500">({marker.label})</span>}
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

function PaperContent({ paper, onBack, backLabel = 'ফিরে যান', layout = DEFAULT_LAYOUT }) {
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
  const answerShown =
    l.headings.answerKey && Array.isArray(paper.answer_key) && paper.answer_key.length > 0;
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
  }, [paper, layout, dims.width, dims.height, margin, twoCols, headerShown, answerShown]);

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
            <PaperHeader paper={paper} layout={l} fmt={fmt} />
          </div>
        )}
        {questions.map((q, index) => (
          <div
            key={`m-${q.id ?? index}`}
            data-measure="q"
            className="pb-4"
            style={{ width: `${colWidth}mm` }}
          >
            <QuestionBlock q={q} index={index} layout={l} />
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
          <Button variant="secondary" size="sm" icon="printer" onClick={() => window.print()}>
            মুদ্রণ
          </Button>
        </div>
      </div>

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
                  <PaperHeader paper={paper} layout={l} fmt={fmt} />
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
                            <QuestionBlock q={q} index={questionIndex} layout={l} />
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
                        <QuestionBlock q={q} index={questionIndex} layout={l} />
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
