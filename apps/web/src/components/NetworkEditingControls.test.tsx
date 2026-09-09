import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { NetworkEditingControls } from './NetworkEditingControls';

const callbacks = {
  onDone: () => undefined,
  onArrange: () => undefined,
  onRetry: () => undefined,
};

describe('Network editing controls', () => {
  it('exposes Arrange Folders directly while File dragging stays mode-free', () => {
    const markup = renderToStaticMarkup(
      <NetworkEditingControls
        {...callbacks}
        scope="all"
        state={{ phase: 'off' }}
      />,
    );

    expect(markup).toContain('>Arrange Folders</button>');
    expect(markup).not.toContain('Edit Network layout');
    expect(markup).not.toContain('Move Files');
  });

  it('shows only the explicit saved-rule editor while it owns input', () => {
    const markup = renderToStaticMarkup(
      <NetworkEditingControls
        {...callbacks}
        scope="all"
        state={{ phase: 'editing', tool: 'arrange-folder' }}
      />,
    );

    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('Arrange Folders');
    expect(markup).toContain('Edits saved Pull and Place folder rules.');
    expect(markup).toContain('>Done</button>');
  });

  it('omits Arrange Folders from Focus and exposes explicit retry', () => {
    const markup = renderToStaticMarkup(
      <NetworkEditingControls
        {...callbacks}
        failure="File movement stopped: worker failed."
        scope="focus"
        state={{ phase: 'off' }}
      />,
    );

    expect(markup).not.toContain('Arrange Folders');
    expect(markup).toContain('Retry Move');
    expect(markup).toContain('role="alert"');
  });
});
