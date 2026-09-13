import { describe, expect, it } from 'vitest';

import { importReviewRunJson } from '@icarus-graph-explorer/ai-review';

import { createSyntheticReviewFixtureJson } from './synthetic-qa-fixture';

describe('explicit synthetic UI fixture', () => {
  it('is a complete canonical run with prominent synthetic labels', async () => {
    const json = await createSyntheticReviewFixtureJson();
    const run = importReviewRunJson(json, '2030-01-01T00:00:00.000Z');
    expect(run.state).toBe('completed');
    expect(run.attempts.map(({ stage }) => stage)).toEqual([
      'negative',
      'positive',
      'integrator',
      'post-check',
    ]);
    expect(json).toContain('SYNTHETIC REVIEW OUTPUT — NOT AN AI CONCLUSION');
  });
});
