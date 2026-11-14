import { useRef, useState } from 'react';
import { cn } from '../../lib/utils.js';
import { Button } from '../ui/index.js';
import { Markdown } from './Markdown.jsx';
import { MathEditor } from './MathEditor.jsx';

const TOOLBAR = [
  { key: 'bold', label: 'B', title: 'Bold', className: 'font-bold' },
  { key: 'italic', label: 'I', title: 'Italic', className: 'italic font-serif' },
  { key: 'heading', label: 'H', title: 'Heading' },
  { key: 'quote', label: '❝', title: 'Quote' },
  { key: 'code', label: '‹/›', title: 'Code block' },
  { key: 'link', label: 'Link', title: 'Link' },
  { key: 'bullet', label: '•', title: 'Bullet list' },
  { key: 'number', label: '1.', title: 'Numbered list' },
];

const clampSize = (value, min, max) => Math.min(max, Math.max(min, Number(value) || min));

function buildTableMarkdown(rows, cols) {
  const header = Array.from({ length: cols }, (_, i) => `Column ${i + 1}`);
  const divider = Array.from({ length: cols }, () => '---');
  const body = Array.from({ length: Math.max(0, rows - 1) }, () =>
    Array.from({ length: cols }, () => '  ')
  );
  return [header, divider, ...body]
    .map((cells) => `| ${cells.join(' | ')} |`)
    .join('\n');
}

function ToolbarButton({ title, className, onClick, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        'grid h-7 min-w-[1.75rem] place-items-center rounded-md px-1.5 text-xs text-slate-500 transition hover:bg-white hover:text-indigo-700 hover:shadow-sm',
        className
      )}
    >
      {children}
    </button>
  );
}

export function MarkdownEditor({
  value,
  onChange,
  rows = 4,
  placeholder,
  dir,
  className,
}) {
  const taRef = useRef(null);
  const [mode, setMode] = useState('write');
  const [mathOpen, setMathOpen] = useState(false);
  const [mathDraft, setMathDraft] = useState('');
  const [mathDisplay, setMathDisplay] = useState(false);
  const [mathRange, setMathRange] = useState(null);
  const [tableOpen, setTableOpen] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [tableRange, setTableRange] = useState(null);

  const getSelection = () => {
    const el = taRef.current;
    return {
      start: el?.selectionStart ?? value.length,
      end: el?.selectionEnd ?? value.length,
    };
  };

  const apply = (next, selStart, selEnd = selStart) => {
    onChange(next);
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(selStart, selEnd);
    });
  };

  const wrap = (before, after, fallback) => {
    const { start, end } = getSelection();
    const selected = value.slice(start, end) || fallback;
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    apply(next, start + before.length, start + before.length + selected.length);
  };

  const prefixLines = (prefix, fallback) => {
    const { start, end } = getSelection();
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = value.indexOf('\n', end);
    if (lineEnd === -1) lineEnd = value.length;
    const block = value.slice(lineStart, lineEnd) || fallback;
    const prefixed = block
      .split('\n')
      .map((line, i) => (typeof prefix === 'function' ? prefix(i) : prefix) + line)
      .join('\n');
    const next = value.slice(0, lineStart) + prefixed + value.slice(lineEnd);
    apply(next, lineStart, lineStart + prefixed.length);
  };

  const run = (key) => {
    switch (key) {
      case 'bold':
        return wrap('**', '**', 'bold text');
      case 'italic':
        return wrap('_', '_', 'italic text');
      case 'heading':
        return prefixLines('## ', 'Heading');
      case 'quote':
        return prefixLines('> ', 'Quote');
      case 'code':
        return wrap('\n```\n', '\n```\n', 'code');
      case 'link':
        return wrap('[', '](https://)', 'link text');
      case 'bullet':
        return prefixLines('- ', 'List item');
      case 'number':
        return prefixLines((i) => `${i + 1}. `, 'List item');
      default:
        return undefined;
    }
  };

  const openMath = (display) => {
    const { start, end } = getSelection();
    setMathRange({ start, end });
    setMathDraft(value.slice(start, end).trim());
    setMathDisplay(display);
    setMathOpen(true);
    setTableOpen(false);
    setMode('write');
  };

  const closeMath = () => {
    setMathOpen(false);
    setMathDraft('');
    setMathRange(null);
  };

  const insertMath = () => {
    const { start, end } = mathRange ?? getSelection();
    const tex = mathDraft.trim();
    if (!tex) return;
    const before = mathDisplay ? '\n$$\n' : '$';
    const after = mathDisplay ? '\n$$\n' : '$';
    const next = value.slice(0, start) + before + tex + after + value.slice(end);
    apply(next, start + before.length + tex.length + after.length);
    closeMath();
  };

  const openTable = () => {
    const { start, end } = getSelection();
    setTableRange({ start, end });
    setTableRows(3);
    setTableCols(3);
    setTableOpen(true);
    setMathOpen(false);
    setMode('write');
  };

  const closeTable = () => {
    setTableOpen(false);
    setTableRange(null);
  };

  const insertTable = () => {
    const rows = clampSize(tableRows, 2, 20);
    const cols = clampSize(tableCols, 2, 10);
    const table = buildTableMarkdown(rows, cols);
    const { start, end } = tableRange ?? getSelection();
    let before = '';
    if (start > 0) {
      if (value[start - 1] !== '\n') before = '\n\n';
      else if (start < 2 || value[start - 2] !== '\n') before = '\n';
    }
    const after = '\n';
    const next = value.slice(0, start) + before + table + after + value.slice(end);
    apply(next, start + before.length + table.length + after.length);
    closeTable();
  };

  const tablePreview = buildTableMarkdown(
    clampSize(tableRows, 2, 20),
    clampSize(tableCols, 2, 10)
  );

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm transition focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100',
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-1.5 py-1">
        <div className="flex flex-wrap items-center gap-0.5">
          {TOOLBAR.map((item) => (
            <ToolbarButton
              key={item.key}
              title={item.title}
              className={item.className}
              onClick={() => run(item.key)}
            >
              {item.label}
            </ToolbarButton>
          ))}
          <span className="mx-0.5 h-4 w-px bg-slate-200" />
          <ToolbarButton title="Insert table" onClick={openTable}>
            ▦
          </ToolbarButton>
          <ToolbarButton title="Insert inline math" onClick={() => openMath(false)}>
            ∑
          </ToolbarButton>
          <ToolbarButton title="Insert display math" onClick={() => openMath(true)}>
            ∑<span className="ml-0.5 text-[9px] text-slate-400">▭</span>
          </ToolbarButton>
        </div>

        <div className="flex items-center rounded-md bg-slate-200/70 p-0.5 text-[11px] font-semibold text-slate-500">
          {['write', 'preview'].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'rounded px-2 py-0.5 capitalize transition',
                mode === m ? 'bg-white text-indigo-700 shadow-sm' : 'hover:text-slate-700'
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {tableOpen && (
        <div className="border-b border-slate-200 bg-slate-50/70 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Table editor
            </p>
            <button
              type="button"
              onClick={closeTable}
              className="text-xs font-medium text-indigo-600 hover:underline"
            >
              Close
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-medium text-slate-600">
              Rows (incl. header)
              <input
                type="number"
                min="2"
                max="20"
                value={tableRows}
                onChange={(e) => setTableRows(e.target.value)}
                className="ml-1.5 w-16 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Columns
              <input
                type="number"
                min="2"
                max="10"
                value={tableCols}
                onChange={(e) => setTableCols(e.target.value)}
                className="ml-1.5 w-16 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </label>
            <div className="ml-auto flex items-center gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={closeTable}>
                Cancel
              </Button>
              <Button type="button" size="sm" icon="check" onClick={insertTable}>
                Insert
              </Button>
            </div>
          </div>

          <div className="mt-2 max-h-40 overflow-auto rounded-lg border border-slate-200 bg-white p-2">
            <Markdown className="text-xs text-slate-700">{tablePreview}</Markdown>
          </div>
        </div>
      )}

      {mathOpen && (
        <div className="border-b border-indigo-100 bg-indigo-50/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
              Math editor · {mathDisplay ? 'display' : 'inline'}
            </p>
            <button
              type="button"
              onClick={closeMath}
              className="text-xs font-medium text-indigo-600 hover:underline"
            >
              Close
            </button>
          </div>
          <MathEditor
            value={mathDraft}
            onChange={setMathDraft}
            rows={2}
            display={mathDisplay}
            autoFocus
            placeholder="Type LaTeX, e.g. x^2 + y^2 = r^2"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={mathDisplay}
                onChange={(e) => setMathDisplay(e.target.checked)}
                className="h-3.5 w-3.5 rounded accent-indigo-600"
              />
              Display (block) equation
            </label>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={closeMath}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                icon="check"
                onClick={insertMath}
                disabled={!mathDraft.trim()}
              >
                Insert
              </Button>
            </div>
          </div>
        </div>
      )}

      {mode === 'preview' ? (
        <div dir={dir} className="min-h-[6rem] px-3 py-2">
          {value.trim() ? (
            <Markdown dir={dir} className="text-sm text-slate-800">
              {value}
            </Markdown>
          ) : (
            <p className="text-sm text-slate-400">{placeholder || 'Nothing to preview yet.'}</p>
          )}
        </div>
      ) : (
        <textarea
          ref={taRef}
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          dir={dir}
          className="w-full resize-y border-0 bg-white px-3 py-2 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-0"
        />
      )}

      <div className="border-t border-slate-100 bg-slate-50/70 px-2 py-1 text-[11px] text-slate-400">
        Markdown supported · inline math <code className="rounded bg-slate-100 px-1">$x^2$</code> ·
        use ▦ for tables and ∑ for the math editor
      </div>
    </div>
  );
}
