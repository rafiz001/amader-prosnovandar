import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkBreaks from 'remark-breaks';
import rehypeKatex from 'rehype-katex';
import { cn } from '../../lib/utils.js';

const FONT_SIZE_RE =
  /\[\[\s*s\s*=\s*(\d+(?:\.\d+)?)\s*\]\]([\s\S]*?)\[\[\s*\/\s*s\s*\]\]/g;

/**
 * Turns `[[s=14]]some text[[/s]]` into a span with an inline font size in points.
 * The inner text is treated as plain text (not further markdown).
 */
function replaceFontSizes(value) {
  const nodes = [];
  let last = 0;
  let found = false;
  FONT_SIZE_RE.lastIndex = 0;
  let match = FONT_SIZE_RE.exec(value);
  while (match) {
    found = true;
    if (match.index > last) {
      nodes.push({ type: 'text', value: value.slice(last, match.index) });
    }
    const pt = Math.min(48, Math.max(4, Number(match[1]) || 12));
    nodes.push({
      type: 'emphasis',
      data: {
        hName: 'span',
        hProperties: { style: `font-size:${pt}pt` },
      },
      children: [{ type: 'text', value: match[2] }],
    });
    last = match.index + match[0].length;
    match = FONT_SIZE_RE.exec(value);
  }
  if (!found) return null;
  if (last < value.length) nodes.push({ type: 'text', value: value.slice(last) });
  return nodes;
}

function transformFontSizes(node) {
  if (!node || !Array.isArray(node.children)) return;
  for (let i = 0; i < node.children.length; i += 1) {
    const child = node.children[i];
    if (child.type === 'text') {
      const replacement = replaceFontSizes(child.value);
      if (replacement) {
        node.children.splice(i, 1, ...replacement);
        i += replacement.length - 1;
      }
    } else {
      transformFontSizes(child);
    }
  }
}

function remarkFontSize() {
  return (tree) => transformFontSizes(tree);
}

const REMARK_PLUGINS = [remarkGfm, remarkBreaks, remarkMath, remarkFontSize];
const REHYPE_PLUGINS = [[rehypeKatex, { throwOnError: false, strict: false, trust: false }]];

const baseComponents = {
  a: ({ node, ...props }) => <a {...props} target="_blank" rel="noreferrer noopener" />,
  img: ({ node, ...props }) => <img {...props} loading="lazy" />,
};

const inlineComponents = {
  ...baseComponents,
  p: ({ children }) => <span>{children}</span>,
  h1: ({ children }) => <strong>{children}</strong>,
  h2: ({ children }) => <strong>{children}</strong>,
  h3: ({ children }) => <strong>{children}</strong>,
  h4: ({ children }) => <strong>{children}</strong>,
  h5: ({ children }) => <strong>{children}</strong>,
  h6: ({ children }) => <strong>{children}</strong>,
};

export function Markdown({ children, className, inline = false, dir, style }) {
  const value = String(children ?? '');
  if (!value.trim()) return null;

  const Wrapper = inline ? 'span' : 'div';

  return (
    <Wrapper
      dir={dir}
      style={style}
      className={cn('md-content', inline && 'md-content--inline', className)}
    >
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        components={inline ? inlineComponents : baseComponents}
      >
        {value}
      </ReactMarkdown>
    </Wrapper>
  );
}
