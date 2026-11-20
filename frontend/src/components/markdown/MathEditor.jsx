import { useRef } from 'react';
import { cn } from '../../lib/utils.js';
import { INPUT_CLASS } from '../ui/index.js';
import { MathTex } from './MathTex.jsx';

const SYMBOLS = [
  { label: 'a/b', tex: '\\frac{a}{b}', title: 'ভগ্নাংশ' },
  { label: '√', tex: '\\sqrt{x}', title: 'বর্গমূল' },
  { label: 'xⁿ', tex: 'x^{n}', title: 'ঘাত' },
  { label: 'xₙ', tex: 'x_{n}', title: 'অধোলিপি' },
  { label: 'π', tex: '\\pi', title: 'পাই' },
  { label: '×', tex: '\\times', title: 'গুণ' },
  { label: '÷', tex: '\\div', title: 'ভাগ' },
  { label: '±', tex: '\\pm', title: 'যোগ/বিয়োগ' },
  { label: '≤', tex: '\\leq', title: 'ছোট বা সমান' },
  { label: '≥', tex: '\\geq', title: 'বড় বা সমান' },
  { label: '≠', tex: '\\neq', title: 'সমান নয়' },
  { label: '∞', tex: '\\infty', title: 'অসীম' },
  { label: 'Σ', tex: '\\sum_{i=1}^{n}', title: 'সমষ্টি' },
  { label: '∫', tex: '\\int_{a}^{b}', title: 'সমাকলন' },
  { label: 'lim', tex: '\\lim_{x \\to 0}', title: 'সীমা' },
  { label: 'α', tex: '\\alpha', title: 'আলফা' },
  { label: 'β', tex: '\\beta', title: 'বিটা' },
  { label: 'θ', tex: '\\theta', title: 'থিটা' },
  { label: 'Δ', tex: '\\Delta', title: 'ডেল্টা' },
  { label: '∠', tex: '\\angle', title: 'কোণ' },
  { label: '△', tex: '\\triangle', title: 'ত্রিভুজ' },
  { label: '→', tex: '\\to', title: 'তীর' },
  { label: 'x̄', tex: '\\overline{x}', title: 'ঊর্ধ্বরেখা' },
  { label: 'sin', tex: '\\sin', title: 'সাইন' },
  { label: 'cos', tex: '\\cos', title: 'কোসাইন' },
  { label: 'log', tex: '\\log', title: 'লগারিদম' },
];

export function MathEditor({
  value,
  onChange,
  rows = 3,
  display = false,
  placeholder = 'যেমন: \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}',
  autoFocus = false,
  className,
}) {
  const ref = useRef(null);

  const insert = (snippet) => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + snippet + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const caret = start + snippet.length;
      el.setSelectionRange(caret, caret);
    });
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap gap-1">
        {SYMBOLS.map((s) => (
          <button
            key={s.title}
            type="button"
            title={s.title}
            onClick={() => insert(s.tex)}
            className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-xs font-medium text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
          >
            {s.label}
          </button>
        ))}
      </div>

      <textarea
        ref={ref}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        spellCheck={false}
        dir="ltr"
        className={cn(INPUT_CLASS, 'resize-y font-mono')}
      />

      <div className="min-h-[2.75rem] overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        {value.trim() ? (
          <MathTex tex={value} display={display} className="text-slate-800" />
        ) : (
          <span className="text-xs text-slate-400">তাৎক্ষণিক পূর্বরূপ</span>
        )}
      </div>
    </div>
  );
}
