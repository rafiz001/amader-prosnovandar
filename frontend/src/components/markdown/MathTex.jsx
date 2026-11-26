import { useMemo } from 'react';
import katex from 'katex';
import { cn } from '../../lib/utils.js';

export function MathTex({ tex, display = false, className, style }) {
  const html = useMemo(() => {
    let source = String(tex ?? '').trim();
    if (source.startsWith('$$') && source.endsWith('$$')) {
      source = source.slice(2, -2).trim();
    } else if (source.startsWith('$') && source.endsWith('$')) {
      source = source.slice(1, -1).trim();
    }
    if (!source) return '';
    try {
      return katex.renderToString(source, {
        displayMode: display,
        throwOnError: false,
        strict: false,
        trust: false,
      });
    } catch {
      return '';
    }
  }, [tex, display]);

  if (!html) return null;

  return (
    <span
      style={style}
      className={cn(
        display ? 'block overflow-x-auto overflow-y-hidden py-1 text-center' : 'inline-block align-middle',
        className
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
