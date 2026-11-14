import { useRef } from 'react';
import { cn } from '../../lib/utils.js';
import { INPUT_CLASS } from '../ui/index.js';
import { MathTex } from './MathTex.jsx';

const SYMBOLS = [
  { label: 'a/b', tex: '\\frac{a}{b}', title: 'Fraction' },
  { label: '√', tex: '\\sqrt{x}', title: 'Square root' },
  { label: 'xⁿ', tex: 'x^{n}', title: 'Power' },
  { label: 'xₙ', tex: 'x_{n}', title: 'Subscript' },
  { label: 'π', tex: '\\pi', title: 'Pi' },
  { label: '×', tex: '\\times', title: 'Multiply' },
  { label: '÷', tex: '\\div', title: 'Divide' },
  { label: '±', tex: '\\pm', title: 'Plus/minus' },
  { label: '≤', tex: '\\leq', title: 'Less than or equal' },
  { label: '≥', tex: '\\geq', title: 'Greater than or equal' },
  { label: '≠', tex: '\\neq', title: 'Not equal' },
  { label: '∞', tex: '\\infty', title: 'Infinity' },
  { label: 'Σ', tex: '\\sum_{i=1}^{n}', title: 'Sum' },
  { label: '∫', tex: '\\int_{a}^{b}', title: 'Integral' },
  { label: 'lim', tex: '\\lim_{x \\to 0}', title: 'Limit' },
  { label: 'α', tex: '\\alpha', title: 'Alpha' },
  { label: 'β', tex: '\\beta', title: 'Beta' },
  { label: 'θ', tex: '\\theta', title: 'Theta' },
  { label: 'Δ', tex: '\\Delta', title: 'Delta' },
  { label: '∠', tex: '\\angle', title: 'Angle' },
  { label: '△', tex: '\\triangle', title: 'Triangle' },
  { label: '→', tex: '\\to', title: 'Arrow' },
  { label: 'x̄', tex: '\\overline{x}', title: 'Overline' },
  { label: 'sin', tex: '\\sin', title: 'Sine' },
  { label: 'cos', tex: '\\cos', title: 'Cosine' },
  { label: 'log', tex: '\\log', title: 'Logarithm' },
];

export function MathEditor({
  value,
  onChange,
  rows = 3,
  display = false,
  placeholder = 'e.g. \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}',
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
          <span className="text-xs text-slate-400">Live preview</span>
        )}
      </div>
    </div>
  );
}
