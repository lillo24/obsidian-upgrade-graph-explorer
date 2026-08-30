import { describe, expect, it } from 'vitest';

import {
  assertWorkerChunkIsDomFree,
  WORKER_SAFE_NAMED_REFERENCE_MODULE,
} from '../../vite.config';

describe('Vite worker runtime boundary', () => {
  it('resolves named references to the package worker-safe implementation', () => {
    const normalized = WORKER_SAFE_NAMED_REFERENCE_MODULE.replaceAll('\\', '/');
    expect(normalized).toMatch(/decode-named-character-reference\/index\.js$/);
    expect(normalized).not.toContain('index.dom.js');
  });

  it('accepts worker-safe globals and rejects DOM construction', () => {
    expect(() =>
      assertWorkerChunkIsDomFree(
        'safe.worker.js',
        'self.onmessage = () => postMessage(1)',
      ),
    ).not.toThrow();
    expect(() =>
      assertWorkerChunkIsDomFree(
        'unsafe.worker.js',
        "const decoder = document.createElement('i')",
      ),
    ).toThrow(
      'Worker bundle unsafe.worker.js contains forbidden DOM runtime document.createElement.',
    );
  });
});
