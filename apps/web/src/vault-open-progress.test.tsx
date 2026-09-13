import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { WorkspaceNotice } from './components/WorkspaceNotice';
import {
  describeVaultOpenProgress,
  formatVaultOpenElapsed,
  isCurrentVaultOpenRequest,
  isLiveVaultProgressPhase,
} from './vault-open-progress';

describe('vault open progress presentation', () => {
  it.each([
    [0, '00:00'],
    [7_000, '00:07'],
    [67_000, '01:07'],
  ])(
    'formats %i milliseconds as %s from elapsed duration',
    (elapsed, value) => {
      expect(formatVaultOpenElapsed(elapsed)).toBe(value);
    },
  );

  it('describes typed stages and uses only the real building-stage count', () => {
    expect(describeVaultOpenProgress(undefined)).toBe('Reading vault files…');
    expect(
      describeVaultOpenProgress({
        stage: 'building-workspace',
        markdownFileCount: 1_203,
        nonMarkdownPathCount: 19,
      }),
    ).toBe('Building workspace… 1,203 Markdown files');
    expect(
      describeVaultOpenProgress({
        stage: 'persisting-identity',
        markdownFileCount: 1_203,
      }),
    ).toBe('Saving workspace identity…');
  });

  it('accepts progress only from the active source request generation', () => {
    expect(isCurrentVaultOpenRequest(8, 8)).toBe(true);
    expect(isCurrentVaultOpenRequest(9, 8)).toBe(false);
  });

  it.each([
    ['catching-up', true],
    ['updating', true],
    ['resyncing', true],
    ['live', false],
    ['paused', false],
  ] as const)(
    'maps live phase %s to progress visibility %s',
    (phase, visible) => {
      expect(isLiveVaultProgressPhase(phase)).toBe(visible);
    },
  );

  it('renders an accessible indeterminate bar without announcing elapsed ticks', () => {
    const markup = renderToStaticMarkup(
      <WorkspaceNotice
        elapsed="01:07"
        progressLabel="Opening vault"
        tone="progress"
      >
        Building workspace… 1,203 Markdown files
      </WorkspaceNotice>,
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain(
      'aria-label="Opening vault" class="workspace-notice__progress" role="progressbar"',
    );
    expect(markup).not.toContain('aria-valuenow');
    expect(markup).toContain(
      'aria-hidden="true" class="workspace-notice__elapsed">Elapsed 01:07',
    );
  });
});
