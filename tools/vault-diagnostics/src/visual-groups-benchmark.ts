import { performance } from 'node:perf_hooks';

import type { AddressableEntity } from '@icarus-graph-explorer/core';
import {
  assignPrimaryVisualGroupPresentations,
  compileVisualGroups,
  type VisualGroupDefinition,
  type VisualGroupPresentationMap,
} from '@icarus-graph-explorer/visual-groups';

interface Distribution {
  readonly medianMs: number;
  readonly p95Ms: number;
  readonly maximumMs: number;
}

interface BenchmarkCase {
  readonly label: string;
  readonly entityCount: number;
  readonly groupCount: 4 | 8;
  readonly repeats: number;
}

const CASES: readonly BenchmarkCase[] = [
  { label: 'small-4', entityCount: 300, groupCount: 4, repeats: 40 },
  { label: 'small-8', entityCount: 300, groupCount: 8, repeats: 40 },
  { label: 'medium-4', entityCount: 3_000, groupCount: 4, repeats: 20 },
  { label: 'medium-8', entityCount: 3_000, groupCount: 8, repeats: 20 },
];

function distribution(values: readonly number[]): Distribution {
  if (values.length === 0) throw new Error('Benchmark distribution is empty.');
  const sorted = [...values].sort((left, right) => left - right);
  return {
    medianMs: sorted[Math.floor((sorted.length - 1) / 2)]!,
    p95Ms: sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)]!,
    maximumMs: sorted.at(-1)!,
  };
}

function measureRepeated<Value>(
  repeats: number,
  run: () => Value,
): { readonly timing: Distribution; readonly value: Value } {
  run();
  const samples: number[] = [];
  let value!: Value;
  for (let index = 0; index < repeats; index += 1) {
    const started = performance.now();
    value = run();
    samples.push(Number((performance.now() - started).toFixed(4)));
  }
  return { timing: distribution(samples), value };
}

function definitions(groupCount: 4 | 8): readonly VisualGroupDefinition[] {
  const colors = [
    'teal',
    'blue',
    'violet',
    'magenta',
    'red',
    'orange',
    'amber',
    'green',
  ] as const;
  return Array.from({ length: groupCount }, (_, index) => ({
    name: `Bucket ${index}`,
    query: `path:"bucket-${index}/"`,
    color: colors[index]!,
    enabled: true,
  }));
}

function entities(
  entityCount: number,
  groupCount: 4 | 8,
): readonly AddressableEntity[] {
  return Array.from({ length: entityCount }, (_, index) => ({
    id: `entity-${index}`,
    kind: 'document' as const,
    source: {
      path: `bucket-${index % groupCount}/Note-${index}.md`,
      span: {
        start: { line: 1, column: 1 },
        end: { line: 2, column: 1 },
      },
    },
  }));
}

function applyRendererStyles(
  entityIds: readonly string[],
  presentations: VisualGroupPresentationMap,
): number {
  let checksum = 0;
  for (const entityId of entityIds) {
    const accent = presentations.get(entityId)?.accent;
    if (accent !== undefined) checksum ^= accent.charCodeAt(accent.length - 1);
  }
  return checksum;
}

function benchmark(benchmarkCase: BenchmarkCase) {
  const groupDefinitions = definitions(benchmarkCase.groupCount);
  const visibleEntities = entities(
    benchmarkCase.entityCount,
    benchmarkCase.groupCount,
  );
  const compile = measureRepeated(benchmarkCase.repeats, () => {
    const result = compileVisualGroups(groupDefinitions);
    if (!result.ok) throw new Error(result.issues[0]?.message);
    return result.value;
  });
  const assignment = measureRepeated(benchmarkCase.repeats, () =>
    assignPrimaryVisualGroupPresentations(visibleEntities, compile.value),
  );
  const entityIds = visibleEntities.map(({ id }) => id);
  const rendererStyleUpdate = measureRepeated(benchmarkCase.repeats, () =>
    applyRendererStyles(entityIds, assignment.value),
  );
  if (assignment.value.size !== visibleEntities.length) {
    throw new Error(
      `${benchmarkCase.label} assigned ${assignment.value.size} of ${visibleEntities.length} visible entities.`,
    );
  }

  return {
    label: benchmarkCase.label,
    visibleEntityCount: visibleEntities.length,
    enabledGroupCount: compile.value.activeGroupCount,
    compileDefinitions: compile.timing,
    derivePrimaryPresentationMap: assignment.timing,
    rendererStyleUpdate: rendererStyleUpdate.timing,
    rendererChecksum: rendererStyleUpdate.value,
    operationCounts: {
      projectView: 0,
      topologyMapping: 0,
      layoutRequests: 0,
      styleUpdates: 1,
    },
  };
}

console.log(
  JSON.stringify(
    {
      schemaVersion: 1,
      note: 'Aggregate synthetic GROUP1A evidence; projection is excluded and timings are not CI gates.',
      cases: CASES.map(benchmark),
    },
    null,
    2,
  ),
);
