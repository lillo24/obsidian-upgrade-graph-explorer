import { describe, expect, it, vi } from 'vitest';

import { OpenAiSessionCredentials } from './openai-session-credentials';

describe('OpenAiSessionCredentials', () => {
  it('keeps only private session state and rejects empty values', () => {
    const credentials = new OpenAiSessionCredentials();
    expect(credentials.snapshot()).toEqual({
      configured: false,
      activeExecutionCount: 0,
    });
    expect(() => credentials.set('   ')).toThrow('non-empty');

    credentials.set('  sk-test-DO-NOT-PERSIST-123  ');
    const publicSnapshot = credentials.snapshot();
    expect(publicSnapshot).toEqual({
      configured: true,
      activeExecutionCount: 0,
    });
    expect(JSON.stringify(publicSnapshot)).not.toContain('sk-test');
    expect(credentials.readForExecution()).toBe('sk-test-DO-NOT-PERSIST-123');
  });

  it('cancels isolated active executions before replacing or clearing a key', () => {
    const credentials = new OpenAiSessionCredentials();
    const first = vi.fn();
    const second = vi.fn();
    credentials.set('first-key');
    const unregisterFirst = credentials.registerExecution(first);
    credentials.set('second-key');
    expect(first).toHaveBeenCalledWith('OpenAI session API key was replaced.');
    expect(credentials.readForExecution()).toBe('second-key');

    unregisterFirst();
    credentials.registerExecution(second);
    credentials.clear();
    expect(second).toHaveBeenCalledWith('OpenAI session API key was cleared.');
    expect(credentials.snapshot()).toEqual({
      configured: false,
      activeExecutionCount: 1,
    });
    expect(credentials.readForExecution()).toBeUndefined();
  });
});
