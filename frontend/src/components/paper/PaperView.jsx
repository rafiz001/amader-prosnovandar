import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useToast } from '../../context/ToastContext.jsx';
import { API } from '../../lib/api.js';
import {
  DEFAULT_LAYOUT,
  PAGE_SIZES,
  QUESTION_ALIGN_OPTIONS,
  formatNumber,
  optionMarker,
  pageDimensions,
  paginateQuestions,
  questionMarker,
  watermarkSettings,
} from '../../lib/paperLayout.js';
import { bnNum, cn, dirOf } from '../../lib/utils.js';
import { Markdown } from '../markdown/Markdown.jsx';
import { MathTex } from '../markdown/MathTex.jsx';
import { Badge, Button } from '../ui/index.js';
import { Icon } from '../Icon.jsx';
import { AddQuestionsModal } from './AddQuestionsModal.jsx';

const MM_TO_PX = 96 / 25.4;
const COLUMN_GAP_MM = 8;
const PAGE_SLACK_PX = 2;
const MAX_IMAGE = 5 * 1024 * 1024;

const PER_QUESTION_ALIGNS = [
  { value: '', label: 'অটো' },
  ...QUESTION_ALIGN_OPTIONS,
];

function clampScale(value) {
  return Math.min(3, Math.max(0.5, Math.round(value * 100) / 100));
}

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

function durationLabel(minutes, fmt) {
  const total = Number(minutes);
  if (!Number.isFinite(total) || total <= 0) return '';
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  const parts = [];
  if (hours > 0) parts.push(`${fmt(hours)} ঘণ্টা`);
  if (mins > 0) parts.push(`${fmt(mins)} মিনিট`);
  return parts.join(' ');
}

function textOr(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

function headerValues(paper, layout, fmt) {
  const meta = paper.meta || {};
  const first = (paper.questions || [])[0] || {};
  const headings = layout.headings || {};
  const values = {
    institute: headings.institute ? textOr(paper.institute?.name) : '',
    class: headings.class
      ? textOr(meta.class_name, textOr(first.class_name))
      : '',
    subject: headings.subject
      ? textOr(meta.subject_name, textOr(first.subject_name))
      : '',
    introduction: headings.introduction ? textOr(meta.introduction) : '',
    time: headings.time ? textOr(meta.time, durationLabel(meta.duration_minutes, fmt)) : '',
    fullMarks: headings.fullMarks ? textOr(meta.full_marks, fmt(paper.total_marks)) : '',
  };
  return { ...values, hasAny: Object.values(values).some(Boolean) };
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

function PaperHeader({ paper, layout, fmt, values, editing, onInstitute, onMeta }) {
  const inst = paper.institute || {};
  const meta = paper.meta || {};
  const h = layout.headings || {};
  if (!values.hasAny && !editing) return null;

  const classValue = textOr(meta.class_name, values.class);
  const subjectValue = textOr(meta.subject_name, values.subject);
  const introValue = textOr(meta.introduction);
  const timeValue = textOr(meta.time, values.time);
  const fullMarksValue = textOr(meta.full_marks, values.fullMarks);
  const showMarksRow =
    (h.time || h.fullMarks) && (editing || values.time || values.fullMarks);
  const headerScale = Number(layout.fontScale) || 1;
  const titlePx = Math.round(20 * headerScale * 100) / 100;
  const bodyPx = Math.round(14 * headerScale * 100) / 100;

  return (
    <div className="border-b border-slate-400 pb-3 text-center">
      {h.institute &&
        (editing ? (
          <input
            className={cn(EDIT_INPUT, 'text-center text-xl font-bold')}
            value={inst.name || ''}
            onChange={(e) => onInstitute({ name: e.target.value })}
            placeholder="প্রতিষ্ঠানের নাম"
          />
        ) : values.institute ? (
          <h2
            className="text-xl font-bold tracking-tight text-slate-900"
            style={{ fontSize: titlePx }}
          >
            {values.institute}
          </h2>
        ) : null)}

      {h.introduction &&
        (editing ? (
          <div className="mt-1 flex w-full items-center gap-1 text-left text-sm text-slate-700">
            <span className="shrink-0 font-semibold">পরিচিতি:</span>
            <input
              className={cn(EDIT_INPUT, 'min-w-0 flex-1 text-left')}
              value={introValue}
              onChange={(e) => onMeta({ introduction: e.target.value })}
              placeholder="পরীক্ষা বা সাজেশন লিখুন"
            />
          </div>
        ) : values.introduction ? (
          <p
            className="mt-0.5 w-full whitespace-pre-wrap text-left text-slate-700"
            style={{ fontSize: bodyPx }}
          >
            <span className="font-semibold">পরিচিতি:</span> {values.introduction}
          </p>
        ) : null)}

      {h.class &&
        (editing ? (
          <label className="mt-1 flex items-center justify-center gap-1 text-sm font-medium text-slate-700">
            <span className="shrink-0">শ্রেণি:</span>
            <input
              className={cn(EDIT_INPUT, 'max-w-[16rem] text-center text-sm font-medium')}
              value={classValue}
              onChange={(e) => onMeta({ class_name: e.target.value })}
              placeholder="দশম"
            />
          </label>
        ) : values.class ? (
          <p className="mt-0.5 font-medium text-slate-700" style={{ fontSize: bodyPx }}>
            <span className="font-semibold">শ্রেণি:</span> {values.class}
          </p>
        ) : null)}

      {h.subject &&
        (editing ? (
          <label className="mt-1 flex items-center justify-center gap-1 text-sm font-medium text-slate-700">
            <span className="shrink-0">বিষয়:</span>
            <input
              className={cn(EDIT_INPUT, 'max-w-[16rem] text-center text-sm font-medium')}
              value={subjectValue}
              onChange={(e) => onMeta({ subject_name: e.target.value })}
              placeholder="গণিত"
            />
          </label>
        ) : values.subject ? (
          <p className="mt-0.5 font-medium text-slate-700" style={{ fontSize: bodyPx }}>
            <span className="font-semibold">বিষয়:</span> {values.subject}
          </p>
        ) : null)}

      {showMarksRow && (
        <div
          className="mt-1 flex items-baseline justify-between gap-4 font-semibold text-slate-800"
          style={{ fontSize: bodyPx }}
        >
          {h.time &&
            (editing ? (
              <label className="flex items-center gap-1">
                <span>সময়:</span>
                <input
                  className={cn(EDIT_INPUT, 'w-24')}
                  value={timeValue}
                  onChange={(e) => onMeta({ time: e.target.value })}
                  placeholder="১ ঘণ্টা"
                />
              </label>
            ) : values.time ? (
              <span>সময়: {values.time}</span>
            ) : null)}
          {h.fullMarks &&
            (editing ? (
              <label className="ml-auto flex items-center gap-1">
                <span>পূর্ণমান:</span>
                <input
                  className={cn(EDIT_INPUT, 'w-20 text-right')}
                  value={fullMarksValue}
                  onChange={(e) => onMeta({ full_marks: e.target.value })}
                  placeholder={fmt(paper.total_marks)}
                />
              </label>
            ) : values.fullMarks ? (
              <span className={cn(h.time && values.time ? '' : 'ml-auto')}>
                পূর্ণমান: {values.fullMarks}
              </span>
            ) : null)}
        </div>
      )}
    </div>
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
  onRemove,
}) {
  const dir = q.dir || dirOf(q.lang);
  const narrow = layout.columns === 2 || layout.pageSize === 'A5';
  const scale = (Number(layout.fontScale) || 1) * (Number(q.font_scale) || 1);
  const fontPx = Math.round(13 * scale * 100) / 100;
  const optionPx = Math.round(fontPx * 0.95 * 100) / 100;
  const smallPx = Math.round(fontPx * 0.86 * 100) / 100;
  const align = q.align || layout.align || '';
  const textAlign = align || undefined;
  const questionScale = Number(q.font_scale) || 1;
  const [confirmRemove, setConfirmRemove] = useState(false);

  return (
    <div className="flex gap-2">
      <QuestionMarker
        marker={questionMarker(
          q.number ?? index + 1,
          layout.questionMarkerStyle,
          layout.numberFormat
        )}
      />
      <div className="min-w-0 flex-1" style={{ textAlign }}>
        {editing ? (
          <div className="space-y-2 rounded-lg border border-indigo-100 bg-indigo-50/30 p-2">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white/70 px-2 py-1.5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className={EDIT_LABEL}>আকার</span>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({ font_scale: clampScale(questionScale - 0.05) })
                    }
                    className="grid h-6 w-6 place-items-center rounded border border-indigo-200 bg-white text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
                    aria-label="এই প্রশ্নের লেখা ছোট করুন"
                  >
                    −
                  </button>
                  <span className="w-11 text-center text-xs font-semibold text-slate-700">
                    {bnNum(Math.round(questionScale * 100))}%
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({ font_scale: clampScale(questionScale + 0.05) })
                    }
                    className="grid h-6 w-6 place-items-center rounded border border-indigo-200 bg-white text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
                    aria-label="এই প্রশ্নের লেখা বড় করুন"
                  >
                    +
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <span className={EDIT_LABEL}>সাজানো</span>
                  {PER_QUESTION_ALIGNS.map((option) => (
                    <button
                      key={option.value || 'auto'}
                      type="button"
                      onClick={() => onChange({ align: option.value })}
                      className={cn(
                        'rounded border px-1.5 py-0.5 text-[10px] font-medium transition',
                        (q.align || '') === option.value
                          ? 'border-indigo-400 bg-indigo-100 text-indigo-800'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              {onRemove &&
                (confirmRemove ? (
                  <span className="inline-flex items-center gap-1">
                    <span className="text-[10px] font-medium text-rose-600">
                      সরিয়ে ফেলবেন?
                    </span>
                    <button
                      type="button"
                      onClick={onRemove}
                      className="rounded-md border border-rose-300 bg-rose-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-rose-700"
                    >
                      হ্যাঁ
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRemove(false)}
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
                    >
                      বাতিল
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmRemove(true)}
                    className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-2 py-1 text-[10px] font-medium text-rose-600 hover:bg-rose-50"
                  >
                    <Icon name="trash" className="h-3.5 w-3.5" />
                    প্রশ্ন সরান
                  </button>
                ))}
            </div>

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
                style={{ fontSize: fontPx, textAlign }}
                className={cn(
                  'leading-relaxed text-slate-800',
                  dir === 'rtl' ? 'rtl-text' : 'ltr-text'
                )}
              >
                {q.text}
              </Markdown>
            )}
            {q.math && (
              <MathTex
                tex={q.math}
                display
                style={{ fontSize: fontPx }}
                className="mt-1 text-slate-700"
              />
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
                  'mt-1.5 grid gap-1 text-slate-700',
                  narrow ? 'grid-cols-1' : 'grid-cols-2'
                )}
                style={{ fontSize: optionPx }}
              >
                {q.options.map((opt, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <OptionMarker
                      marker={optionMarker(i, layout.markerStyle, layout.numberFormat)}
                    />
                    <Markdown
                      inline
                      dir={dir}
                      style={{ fontSize: optionPx, textAlign }}
                      className="text-slate-700"
                    >
                      {opt}
                    </Markdown>
                  </li>
                ))}
              </ol>
            )}

            {showAnswers && q.answer != null && q.kind !== 'mcq' && (
              <div className="mt-1 font-medium text-emerald-700" style={{ fontSize: smallPx }}>
                উত্তর:{' '}
                <Markdown
                  inline
                  dir={dir}
                  style={{ fontSize: smallPx, textAlign }}
                  className="font-medium text-emerald-700"
                >
                  {String(q.answer)}
                </Markdown>
              </div>
            )}
            {showAnswers && q.description && (
              <Markdown
                dir={dir}
                style={{ fontSize: smallPx, textAlign }}
                className="mt-1 text-slate-500"
              >
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
  const fontPx = Math.round(13 * (Number(layout.fontScale) || 1) * 100) / 100;

  return (
    <div className="rounded-lg border border-slate-300 p-3">
      <h4 className="mb-1.5 text-sm font-semibold text-slate-800">উত্তরমালা</h4>
      <div
        className={cn(
          'grid gap-1 text-slate-700',
          layout.pageSize === 'A5' ? 'grid-cols-2' : 'grid-cols-4'
        )}
        style={{ fontSize: fontPx }}
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
                <Markdown inline style={{ fontSize: fontPx }} className="text-slate-700">
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
  const syncToBankRef = useRef(false);
  const editedFieldsRef = useRef(new Map());
  const [syncToBank, setSyncToBank] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    setPaper(initialPaper);
    latestRef.current = initialPaper;
    dirtyRef.current = false;
    editedFieldsRef.current = new Map();
    setSaveState('idle');
    // Only reload when a different paper arrives.
  }, [initialPaper?.id, initialPaper?.generated_at]);

  const syncQuestionsToBank = async (current) => {
    const entries = [...editedFieldsRef.current.entries()];
    if (!entries.length) return;
    editedFieldsRef.current = new Map();
    const byId = new Map(
      (current?.questions || []).map((question) => [question.id, question])
    );
    for (const [id, fields] of entries) {
      const question = byId.get(id);
      if (!question || question.id == null) continue;
      const payload = {};
      for (const key of fields) {
        if (['image_url', 'number', 'id', 'kind', 'type', 'dir'].includes(key)) continue;
        if (key === 'text' || key === 'math') payload[key] = question[key] || '';
        else if (key === 'description') payload[key] = question.description ?? '';
        else if (key === 'answer') {
          payload.answer = question.answer == null ? '' : String(question.answer);
        } else if (key === 'marks') payload.marks = Number(question.marks) || 0;
        else payload[key] = question[key];
      }
      if (question.kind === 'mcq' && (fields.has('options') || fields.has('correct_option'))) {
        if (!Array.isArray(question.options) || question.options.length !== 4) continue;
        if (!question.correct_option) continue;
        payload.options = question.options;
        payload.correct_option = question.correct_option;
      }
      if (fields.has('image_url')) {
        if (question.image_url && question.image_url.startsWith('data:')) {
          payload.image = {
            data_base64: question.image_url.slice(question.image_url.indexOf(',') + 1),
            filename: '',
          };
        } else if (question.image_url == null) {
          payload.remove_image = true;
        }
      }
      if (Object.keys(payload).length === 0) continue;
      try {
        await API.questions.update(id, payload);
      } catch (error) {
        toast.error(error.message);
      }
    }
  };

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
      if (syncToBankRef.current) {
        await syncQuestionsToBank(current);
      }
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
      const target = (prev.questions || [])[index];
      if (target?.id != null) {
        const fields = editedFieldsRef.current.get(target.id) || new Set();
        Object.keys(changes).forEach((key) => fields.add(key));
        editedFieldsRef.current.set(target.id, fields);
      }
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

  const insertQuestions = (items) => {
    if (!items || !items.length) {
      setAddOpen(false);
      return;
    }
    patch((prev) => {
      const existing = new Set((prev.questions || []).map((question) => question.id));
      const fresh = items.filter((question) => !existing.has(question.id));
      if (!fresh.length) return prev;
      return withTotals({
        ...prev,
        questions: [...(prev.questions || []), ...fresh],
      });
    });
    setAddOpen(false);
  };

  const removeQuestion = (index) =>
    patch((prev) => {
      const questions = (prev.questions || []).filter((_, i) => i !== index);
      return withTotals({ ...prev, questions });
    });

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
    watermark: watermarkSettings(layout?.watermark),
  };
  const questions = paper.questions || [];
  const dims = pageDimensions(l);
  const margin = Math.min(40, Math.max(5, Number(l.margin) || 14));
  const contentWidth = dims.width - margin * 2;
  const twoCols = l.columns === 2;
  const colWidth = twoCols ? (contentWidth - COLUMN_GAP_MM) / 2 : contentWidth;
  const pageName = PAGE_SIZES[l.pageSize]?.label || 'A4';
  const orientationName = l.orientation === 'landscape' ? 'আড়াআড়ি' : 'খাড়া';
  const fmt = (value) => formatNumber(value, l.numberFormat);
  const header = headerValues(paper, l, fmt);
  const headerTogglesOn = [
    'institute',
    'class',
    'subject',
    'introduction',
    'time',
    'fullMarks',
  ].some((key) => l.headings[key]);
  const headerShown = editing ? headerTogglesOn : header.hasAny;
  const answersVisible =
    typeof paper.include_answers === 'boolean'
      ? paper.include_answers
      : Array.isArray(paper.answer_key) && paper.answer_key.length > 0;
  const answerShown =
    answersVisible &&
    l.headings.answerKey &&
    Array.isArray(paper.answer_key) &&
    paper.answer_key.length > 0;
  const watermarkLogo = paper.institute?.logo_url || '';
  const watermarkImage = l.watermark.image || '';
  const watermarkMode = l.watermark.mode;
  const watermarkWidth = Math.min(100, Math.max(5, Number(l.watermark.size) || 55));
  const watermarkOpacity =
    Math.min(100, Math.max(0, Number(l.watermark.opacity) || 0)) / 100;
  const questionGapMm = Math.min(20, Math.max(0, Number(l.questionGap) || 0));
  const questionGapStyle = { paddingBottom: `${questionGapMm}mm` };
  const subjectId = paper.meta?.subject_id ?? questions[0]?.subject_id ?? '';
  const lockedIds = new Set(
    questions.map((question) => question.id).filter((id) => id != null)
  );

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
    values: header,
    editing,
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
    onRemove: () => removeQuestion(index),
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
            style={{ width: `${colWidth}mm`, ...questionGapStyle }}
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
            variant="secondary"
            size="sm"
            icon="plus"
            onClick={() => setAddOpen(true)}
            disabled={!subjectId}
            title={subjectId ? 'আরও প্রশ্ন যোগ করুন' : 'এই প্রশ্নপত্রের বিষয় পাওয়া যায়নি'}
          >
            প্রশ্ন যোগ করুন
          </Button>

          {editing && paper.id && (
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-800">
              <input
                type="checkbox"
                checked={syncToBank}
                onChange={(e) => {
                  setSyncToBank(e.target.checked);
                  syncToBankRef.current = e.target.checked;
                }}
                className="h-3.5 w-3.5 accent-emerald-600"
              />
              প্রশ্নব্যাংকেও হালনাগাদ করুন
            </label>
          )}

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
          “প্রশ্নব্যাংকেও হালনাগাদ করুন” চালু থাকলে সম্পাদিত প্রশ্ন মূল প্রশ্নব্যাংকেও
          সংরক্ষিত হবে; বন্ধ থাকলে শুধু এই প্রশ্নপত্রে পরিবর্তন থাকবে।
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
              {watermarkMode !== 'none' && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden"
                >
                  {watermarkMode === 'logo' && watermarkLogo && (
                    <img
                      src={watermarkLogo}
                      alt=""
                      className="pointer-events-none select-none object-contain"
                      style={{
                        width: `${watermarkWidth}%`,
                        maxHeight: '80%',
                        opacity: watermarkOpacity,
                        filter: l.watermark.grayscale ? 'grayscale(1)' : 'none',
                      }}
                    />
                  )}
                  {watermarkMode === 'image' && watermarkImage && (
                    <img
                      src={watermarkImage}
                      alt=""
                      className="pointer-events-none select-none object-contain"
                      style={{
                        width: `${watermarkWidth}%`,
                        maxHeight: '80%',
                        opacity: watermarkOpacity,
                        filter: l.watermark.grayscale ? 'grayscale(1)' : 'none',
                      }}
                    />
                  )}
                  {watermarkMode === 'text' && l.watermark.text && (
                    <span
                      className="pointer-events-none select-none whitespace-nowrap font-bold"
                      style={{
                        transform: `rotate(${Number(l.watermark.angle) || 0}deg)`,
                        fontSize: `${Number(l.watermark.textSize) || 96}px`,
                        color: l.watermark.color,
                        opacity: watermarkOpacity,
                        lineHeight: 1.15,
                      }}
                    >
                      {l.watermark.text}
                    </span>
                  )}
                </div>
              )}

              {page.header && (
                <div className="relative z-10 shrink-0 pb-4">
                  <PaperHeader {...headerProps} />
                </div>
              )}

              {page.answerKey ? (
                <div className="relative z-10 min-h-0 flex-1">
                  <AnswerKeyBlock paper={paper} layout={l} fmt={fmt} />
                </div>
              ) : twoCols ? (
                <div
                  className="relative z-10 grid min-h-0 flex-1"
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
                          <div key={q.id ?? questionIndex} style={questionGapStyle}>
                            <QuestionBlock {...questionProps(q, questionIndex)} />
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="relative z-10 min-h-0 flex-1">
                  {(page.questions || []).map((questionIndex) => {
                    const q = questions[questionIndex];
                    if (!q) return null;
                    return (
                      <div key={q.id ?? questionIndex} style={questionGapStyle}>
                        <QuestionBlock {...questionProps(q, questionIndex)} />
                      </div>
                    );
                  })}
                </div>
              )}

              <span
                className="absolute left-0 right-0 z-10 text-center text-[10px] text-slate-400"
                style={{ bottom: '2mm' }}
              >
                {fmt(pageIndex + 1)} / {fmt(pages.length)}
              </span>
            </section>
          ))}
        </div>
      </div>

      {addOpen && (
        <AddQuestionsModal
          subjectId={subjectId}
          lockedIds={lockedIds}
          onClose={() => setAddOpen(false)}
          onAdd={insertQuestions}
        />
      )}
    </div>
  );
}
