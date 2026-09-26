import {
  Children,
  Component,
  memo,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

import 'katex/dist/katex.min.css';
import './safe-markdown.css';
import { safeMarkdownUrlTransform, safeMarkdownExternalUrl } from './security';

function textContent(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textContent).join('');
  if (node !== null && typeof node === 'object' && 'props' in node) {
    return textContent(
      (node as { props: { children?: ReactNode } }).props.children,
    );
  }
  return '';
}

function CodeBlock({ children, ...props }: ComponentProps<'pre'>) {
  const [copied, setCopied] = useState(false);
  const raw = textContent(children).replace(/\n$/u, '');
  return (
    <div className="safe-markdown__code-block">
      <button
        aria-label="Copy code"
        className="safe-markdown__code-copy"
        onClick={() => {
          void navigator.clipboard.writeText(raw).then(() => {
            setCopied(true);
            globalThis.setTimeout(() => setCopied(false), 1_500);
          });
        }}
        type="button"
      >
        {copied ? 'Copied' : 'Copy Code'}
      </button>
      <pre {...props}>{children}</pre>
    </div>
  );
}

const COMPONENTS: Components = {
  a({ href, children, ...props }) {
    const safe = href === undefined ? '' : safeMarkdownExternalUrl(href);
    if (safe === '') {
      return (
        <span
          className="safe-markdown__inert-link"
          title="Blocked or unresolved link"
        >
          {children}
        </span>
      );
    }
    return (
      <a {...props} href={safe} rel="noreferrer noopener" target="_blank">
        {children}
      </a>
    );
  },
  img({ alt, src }) {
    return (
      <span className="safe-markdown__blocked-image">
        Remote image blocked{alt ? `: ${alt}` : ''}
        {src ? <code translate="no"> {src}</code> : null}
      </span>
    );
  },
  pre: CodeBlock,
  table({ children, ...props }) {
    return (
      <div className="safe-markdown__table-scroll">
        <table {...props}>{children}</table>
      </div>
    );
  },
};

class MarkdownErrorBoundary extends Component<
  { readonly markdown: string; readonly children: ReactNode },
  { readonly error: string | undefined }
> {
  public override state: { readonly error: string | undefined } = {
    error: undefined,
  };

  public static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }

  public override componentDidCatch(): void {
    // The visible fallback retains the exact raw source for inspection/copy.
  }

  public override componentDidUpdate(previous: {
    readonly markdown: string;
  }): void {
    if (
      previous.markdown !== this.props.markdown &&
      this.state.error !== undefined
    ) {
      this.setState({ error: undefined });
    }
  }

  public override render() {
    if (this.state.error !== undefined) {
      return (
        <div className="safe-markdown__error" role="status">
          <p>Formatted rendering failed: {this.state.error}</p>
          <pre>{this.props.markdown}</pre>
        </div>
      );
    }
    return Children.only(this.props.children);
  }
}

export const SafeMarkdown = memo(function SafeMarkdown({
  markdown,
}: {
  readonly markdown: string;
}) {
  return (
    <MarkdownErrorBoundary markdown={markdown}>
      <div className="safe-markdown">
        <ReactMarkdown
          components={COMPONENTS}
          rehypePlugins={[
            [
              rehypeKatex,
              {
                trust: false,
                strict: 'error',
                throwOnError: true,
                maxExpand: 100,
                maxSize: 20,
              },
            ],
          ]}
          remarkPlugins={[remarkGfm, remarkMath]}
          skipHtml
          urlTransform={safeMarkdownUrlTransform}
        >
          {markdown}
        </ReactMarkdown>
      </div>
    </MarkdownErrorBoundary>
  );
});
