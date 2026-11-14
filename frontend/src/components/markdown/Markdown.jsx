import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkBreaks from 'remark-breaks';
import rehypeKatex from 'rehype-katex';
import { cn } from '../../lib/utils.js';

const REMARK_PLUGINS = [remarkGfm, remarkBreaks, remarkMath];
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

export function Markdown({ children, className, inline = false, dir }) {
  const value = String(children ?? '');
  if (!value.trim()) return null;

  const Wrapper = inline ? 'span' : 'div';

  return (
    <Wrapper
      dir={dir}
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
