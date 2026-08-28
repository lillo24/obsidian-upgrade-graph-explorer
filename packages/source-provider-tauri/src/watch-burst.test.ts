import { describe, expect, it } from 'vitest';

import { createWatchBurstCollector, type WatchScheduler } from './watch-burst';
import type { VaultWatchBatch } from './types';

class FakeScheduler implements WatchScheduler {
  private current = 0;
  private nextId = 0;
  private readonly tasks = new Map<
    number,
    { readonly at: number; readonly callback: () => void }
  >();

  now(): number {
    return this.current;
  }

  setTimeout(callback: () => void, delayMs: number): number {
    const id = (this.nextId += 1);
    this.tasks.set(id, { at: this.current + delayMs, callback });
    return id;
  }

  clearTimeout(handle: unknown): void {
    this.tasks.delete(handle as number);
  }

  advance(milliseconds: number): void {
    const target = this.current + milliseconds;
    while (true) {
      const next = [...this.tasks]
        .filter(([, task]) => task.at <= target)
        .sort(
          ([leftId, left], [rightId, right]) =>
            left.at - right.at || leftId - rightId,
        )[0];
      if (next === undefined) break;
      const [id, task] = next;
      this.tasks.delete(id);
      this.current = task.at;
      task.callback();
    }
    this.current = target;
  }
}

function signal(path: string) {
  return {
    paths: [path],
    category: 'modify' as const,
    requiresResync: false,
    reasons: [],
  };
}

describe('watch burst collector', () => {
  it('deduplicates and sorts one burst after the quiet window', () => {
    const scheduler = new FakeScheduler();
    const batches: VaultWatchBatch[] = [];
    const collector = createWatchBurstCollector(
      (batch) => {
        batches.push(batch);
      },
      { quietWindowMs: 250, maximumWaitMs: 1_000, scheduler },
    );

    collector.add(signal('B.md'));
    scheduler.advance(200);
    collector.add(signal('A.md'));
    collector.add(signal('B.md'));
    scheduler.advance(249);
    expect(batches).toEqual([]);
    scheduler.advance(1);

    expect(batches).toEqual([
      {
        paths: ['A.md', 'B.md'],
        categories: ['modify'],
        requiresResync: false,
        reasons: [],
      },
    ]);
  });

  it('flushes a sustained burst at the hard maximum wait', () => {
    const scheduler = new FakeScheduler();
    const batches: VaultWatchBatch[] = [];
    const collector = createWatchBurstCollector(
      (batch) => {
        batches.push(batch);
      },
      { quietWindowMs: 300, maximumWaitMs: 1_000, scheduler },
    );

    collector.add(signal('A.md'));
    for (const path of ['B.md', 'C.md', 'D.md', 'E.md']) {
      scheduler.advance(200);
      collector.add(signal(path));
    }
    scheduler.advance(199);
    expect(batches).toEqual([]);
    scheduler.advance(1);
    expect(batches).toHaveLength(1);
    expect(batches[0]?.paths).toEqual(['A.md', 'B.md', 'C.md', 'D.md', 'E.md']);
  });

  it('never overlaps listener calls and retains events received during a flush', async () => {
    const scheduler = new FakeScheduler();
    const batches: VaultWatchBatch[] = [];
    let releaseFirst: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const collector = createWatchBurstCollector(
      async (batch) => {
        batches.push(batch);
        if (batches.length === 1) await firstGate;
      },
      { quietWindowMs: 10, maximumWaitMs: 50, scheduler },
    );

    collector.add(signal('First.md'));
    scheduler.advance(10);
    collector.add(signal('Second.md'));
    scheduler.advance(10);
    expect(batches.map((batch) => batch.paths)).toEqual([['First.md']]);

    releaseFirst?.();
    await Promise.resolve();
    await Promise.resolve();
    scheduler.advance(0);
    expect(batches.map((batch) => batch.paths)).toEqual([
      ['First.md'],
      ['Second.md'],
    ]);
  });

  it('cancels pending delivery when disposed', async () => {
    const scheduler = new FakeScheduler();
    const batches: VaultWatchBatch[] = [];
    const collector = createWatchBurstCollector(
      (batch) => {
        batches.push(batch);
      },
      { quietWindowMs: 10, maximumWaitMs: 20, scheduler },
    );
    collector.add(signal('Never.md'));
    await collector.dispose();
    scheduler.advance(100);
    expect(batches).toEqual([]);
  });

  it('preserves resync evidence and is independent of equivalent event order', () => {
    const firstScheduler = new FakeScheduler();
    const secondScheduler = new FakeScheduler();
    const first: VaultWatchBatch[] = [];
    const second: VaultWatchBatch[] = [];
    const firstCollector = createWatchBurstCollector(
      (batch) => {
        first.push(batch);
      },
      { quietWindowMs: 10, maximumWaitMs: 20, scheduler: firstScheduler },
    );
    const secondCollector = createWatchBurstCollector(
      (batch) => {
        second.push(batch);
      },
      { quietWindowMs: 10, maximumWaitMs: 20, scheduler: secondScheduler },
    );
    firstCollector.add(signal('B.md'));
    firstCollector.add({
      paths: ['A.md'],
      category: 'other',
      requiresResync: true,
      reasons: ['Rescan requested.'],
    });
    secondCollector.add({
      paths: ['A.md'],
      category: 'other',
      requiresResync: true,
      reasons: ['Rescan requested.'],
    });
    secondCollector.add(signal('B.md'));
    firstScheduler.advance(10);
    secondScheduler.advance(10);
    expect(first).toEqual(second);
    expect(first[0]).toMatchObject({
      paths: ['A.md', 'B.md'],
      categories: ['modify', 'other'],
      requiresResync: true,
      reasons: ['Rescan requested.'],
    });
  });
});
