import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { WorkspaceNotice } from './components/WorkspaceNotice';
import {
  describeVaultOpenProgress,
  formatVaultOpenElapsed,
  guardVaultOpenProgress,
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
    expect(describeVaultOpenProgress(undefined)).toBe(
      'Preparing vault source…',
    );
    expect(
      describeVaultOpenProgress({
        stage: 'acquiring-source',
        acquisition: {
          sourceDiscovery: 'complete',
          identityPreparation: 'pending',
          markdownFileCount: 1_203,
          nonMarkdownPathCount: 19,
        },
      }),
    ).toBe('Loading workspace identity…');
    expect(
      describeVaultOpenProgress({
        stage: 'acquiring-source',
        acquisition: {
          sourceDiscovery: 'pending',
          identityPreparation: 'complete',
        },
      }),
    ).toBe('Reading vault files…');
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

  it('rejects late source and identity completions from an old request', () => {
    let currentGeneration = 8;
    const accepted: string[] = [];
    const listener = guardVaultOpenProgress(
      8,
      () => currentGeneration,
      (progress) => accepted.push(describeVaultOpenProgress(progress)),
    );
    currentGeneration = 9;

    listener({
      stage: 'acquiring-source',
      acquisition: {
        sourceDiscovery: 'complete',
        identityPreparation: 'pending',
        markdownFileCount: 2,
        nonMarkdownPathCount: 1,
      },
    });
    listener({
      stage: 'acquiring-source',
      acquisition: {
        sourceDiscovery: 'pending',
        identityPreparation: 'complete',
      },
    });

    expect(accepted).toEqual([]);
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
        progressLabel="Opening vault"
        startedAt={0}
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
      'aria-hidden="true" class="workspace-notice__elapsed">Elapsed 00:00',
    );
  });
});
