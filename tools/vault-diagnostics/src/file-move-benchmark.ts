import { performance } from 'node:perf_hooks';

import {
  dynamicTargetFromDisplayedTarget,
  indexAppliedFixedTranslations,
  type AppliedFolderTranslation,
} from '@icarus-graph-explorer/spatial-overrides';
import {
  RecordingTemporaryNodeConstraintPort,
  TemporaryFileMoveCoordinator,
} from '@icarus-graph-explorer/renderer-sigma/core';

interface Distribution {
  readonly medianMs: number;
  readonly p95Ms: number;
  readonly maximumMs: number;
}

function distribution(samples: readonly number[]): Distribution {
  const sorted = [...samples].sort((left, right) => left - right);
  const at = (fraction: number) =>
    sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
  return {
    medianMs: Number(at(0.5).toFixed(4)),
    p95Ms: Number(at(0.95).toFixed(4)),
    maximumMs: Number((sorted.at(-1) ?? 0).toFixed(4)),
  };
}

function repeat(repeats: number, run: () => void): Distribution {
  run();
  const samples: number[] = [];
  for (let index = 0; index < repeats; index += 1) {
    const started = performance.now();
    run();
    samples.push(performance.now() - started);
  }
  return distribution(samples);
}

function appliedFolders(
  nodeCount: number,
  groupSize: number,
): readonly AppliedFolderTranslation[] {
  const groups: AppliedFolderTranslation[] = [];
  for (let start = 0; start < nodeCount; start += groupSize) {
    const memberNodeKeys = Array.from(
      { length: Math.min(groupSize, nodeCount - start) },
      (_, offset) => `node-${start + offset}`,
    );
    groups.push({
      folderKey: `folder-${start / groupSize}`,
      memberNodeKeys,
      automaticCenter: { x: start, y: -start },
      target: { x: start + 12, y: -start - 7 },
      translation: { x: 12, y: -7 },
    });
  }
  return groups;
}

function conversionCase(
  label: string,
  fixedTranslationByNodeKey: ReadonlyMap<string, { x: number; y: number }>,
  sampleNodeCount: number,
) {
  let checksum = 0;
  const timing = repeat(20, () => {
    for (let index = 0; index < sampleNodeCount; index += 1) {
      const result = dynamicTargetFromDisplayedTarget({
        nodeKey: `node-${index}`,
        displayedTarget: { x: index + 0.5, y: -index - 0.25 },
        fixedTranslationByNodeKey,
      });
      checksum += result.x + result.y;
    }
  });
  return { label, sampleNodeCount, timing, checksum };
}

function coalescedDragCase() {
  const port = new RecordingTemporaryNodeConstraintPort();
  let frame: (() => void) | undefined;
  const coordinator = new TemporaryFileMoveCoordinator({
    context: {
      active: true,
      capability: { status: 'available' },
      port,
      sessionGeneration: 'benchmark-session',
      simulationGeneration: 'benchmark-simulation',
      coordinateGeneration: 'benchmark-coordinates',
      fixedTranslationByNodeKey: new Map([['node-0', { x: 12, y: -7 }]]),
    },
    frameScheduler: {
      request: (callback) => {
        frame = callback;
        return 1;
      },
      cancel: () => {
        frame = undefined;
      },
    },
  });
  const started = performance.now();
  coordinator.prime({
    gestureId: 'benchmark-gesture',
    nodeKey: 'node-0',
    startViewportPoint: { x: 0, y: 0 },
    startGraphPoint: { x: 0, y: 0 },
    displayedNodePoint: { x: 0, y: 0 },
  });
  for (let index = 1; index <= 10_000; index += 1) {
    coordinator.move({ x: index + 3, y: index }, { x: index + 3, y: index });
  }
  frame?.();
  coordinator.release();
  return {
    rawPointerSamples: 10_000,
    emittedCommands: port.commands.length,
    durationMs: Number((performance.now() - started).toFixed(4)),
  };
}

const largeFolders = appliedFolders(20_000, 100);
const largeIndexStarted = performance.now();
const largeIndex = indexAppliedFixedTranslations(largeFolders);
const largeIndexMs = performance.now() - largeIndexStarted;
const placeIndex = indexAppliedFixedTranslations(appliedFolders(1_000, 100));

process.stdout.write(
  `${JSON.stringify(
    {
      schemaVersion: 1,
      benchmark: 'move1a-temporary-file-drag',
      note: 'Aggregate synthetic evidence only; timings are investigative and not CI gates.',
      cases: [
        conversionCase('no-place', new Map(), 1_000),
        conversionCase('place', placeIndex, 1_000),
        {
          label: 'large-place-index',
          nodeCount: largeIndex.size,
          groupCount: largeFolders.length,
          indexBuildMs: Number(largeIndexMs.toFixed(4)),
          conversion: conversionCase(
            'large-place-conversion',
            largeIndex,
            20_000,
          ).timing,
        },
      ],
      coalescedDrag: coalescedDragCase(),
    },
    null,
    2,
  )}\n`,
);
