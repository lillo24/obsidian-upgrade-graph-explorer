import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { NetworkEditingControls } from './NetworkEditingControls';

const callbacks = {
  onDone: () => undefined,
  onEnter: () => undefined,
  onRetry: () => undefined,
  onToolChange: () => undefined,
};

describe('Network editing controls', () => {
  it('exposes one compact pencil while editing is off', () => {
    const markup = renderToStaticMarkup(
      <NetworkEditingControls
        {...callbacks}
        scope="all"
        state={{ phase: 'off' }}
      />,
    );

    expect(markup).toContain('aria-label="Edit Network layout"');
    expect(markup).toContain('>✎</span>');
    expect(markup).not.toContain('Move Files');
  });

  it('offers both All tools and makes temporary movement explicit', () => {
    const markup = renderToStaticMarkup(
      <NetworkEditingControls
        {...callbacks}
        scope="all"
        state={{ phase: 'editing', tool: 'move-file' }}
        status="Moving…"
      />,
    );

    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('>Move Files</button>');
    expect(markup).toContain('Arrange Folders');
    expect(markup).toContain('Temporary movement — positions are not saved.');
    expect(markup).toContain('aria-live="polite"');
  });

  it('omits Arrange Folders from Focus and exposes explicit retry', () => {
    const markup = renderToStaticMarkup(
      <NetworkEditingControls
        {...callbacks}
        failure="Move Files stopped: worker failed."
        scope="focus"
        state={{ phase: 'editing', tool: 'move-file' }}
      />,
    );

    expect(markup).not.toContain('Arrange Folders');
    expect(markup).toContain('Retry Move');
    expect(markup).toContain('role="alert"');
  });
});
