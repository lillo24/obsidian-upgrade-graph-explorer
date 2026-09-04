import { Worker } from 'node:worker_threads';
import dagre from '@dagrejs/dagre';
import {
  compareFocusSchematicLayouts,
  type FocusSchematicStabilityQuality,
} from '@icarus-graph-explorer/focus-schematic';
import {
  computeFocusSchematicUniformLayoutAttempt as computeFocusSchematicLayoutAttempt,
  FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
  type FocusSchematicLayoutAttempt,
  type FocusSchematicLayoutInput,
} from '@icarus-graph-explorer/focus-schematic-layout';

import { createLayoutInput } from './dimensions';
import { dynamicExperiment } from './dynamic';
import {
  buildFixture,
  generatedFixture,
  hubFixture,
  SEMANTIC_FIXTURES,
  STABILITY_PAIRS,
  type FixtureSpec,
} from './fixtures';
import {
  computeClassicBaselineAttempt,
  computeCompoundAttempt,
  evaluateHardGates,
} from './strategies';

type Strategy = 'D0' | 'A' | 'B';
type Profile = 'fixtures' | 'small' | 'medium' | 'hub' | 'stability';

interface RunSummary {
  readonly fixtureId: string;
  readonly set: 'calibration' | 'holdout' | 'generated' | 'profile';
  readonly strategy: Strategy;
  readonly status: FocusSchematicLayoutAttempt['status'];
  readonly configId: string;
  readonly hardGatePassed: boolean;
  readonly hardGateFailures: readonly string[];
  readonly deterministic: boolean | null;
  readonly routeCoverage: number | null;
  readonly quality: {
    readonly approximateCrossings: number | null;
    readonly alignmentMean: number | null;
    readonly alignmentP95: number | null;
    readonly area: number | null;
    readonly emptyAreaRatio: number | null;
    readonly folderAdjacency: number | null;
  };
  readonly timings: FocusSchematicLayoutAttempt['timings'];
  readonly reason: string | null;
}

function profileFromArgs(): Profile {
  const index = process.argv.indexOf('--profile');
  const value = index < 0 ? 'fixtures' : process.argv[index + 1];
  if (
    !['fixtures', 'small', 'medium', 'hub', 'stability'].includes(value ?? '')
  )
    throw new Error('Expected --profile fixtures|small|medium|hub|stability.');
  return value as Profile;
}

function runDirect(strategy: Strategy, input: FocusSchematicLayoutInput) {
  return strategy === 'D0'
    ? computeClassicBaselineAttempt(input)
    : strategy === 'A'
      ? computeFocusSchematicLayoutAttempt(input)
      : computeCompoundAttempt(input);
}

async function runIsolated(
  strategy: Strategy,
  input: FocusSchematicLayoutInput,
  timeoutMs: number,
): Promise<FocusSchematicLayoutAttempt> {
  return await new Promise((resolve) => {
    const worker = new Worker(new URL('./attempt-worker.ts', import.meta.url), {
      workerData: { strategy, input },
      execArgv: process.execArgv,
    });
    const timer = setTimeout(() => {
      void worker.terminate();
      resolve({
        status: 'timeout',
        strategyId: strategy,
        configId: 'isolated-hard-timeout',
        reason: `Attempt exceeded ${timeoutMs} ms.`,
        timings: {
          inputMs: 0,
          planningMs: 0,
          internalMs: 0,
          macroMs: 0,
          postMs: 0,
          validateMs: 0,
          qualityMs: 0,
          serializeMs: 0,
          totalMs: timeoutMs,
        },
      });
    }, timeoutMs);
    worker.once('message', (attempt: FocusSchematicLayoutAttempt) => {
      clearTimeout(timer);
      resolve(attempt);
    });
    worker.once('error', (error) => {
      clearTimeout(timer);
      resolve({
        status: 'failure',
        strategyId: strategy,
        configId: 'isolated-worker',
        reason: `Isolated attempt failed: ${error.message}`,
        timings: {
          inputMs: 0,
          planningMs: 0,
          internalMs: 0,
          macroMs: 0,
          postMs: 0,
          validateMs: 0,
          qualityMs: 0,
          serializeMs: 0,
          totalMs: 0,
        },
      });
    });
  });
}

function summarize(
  fixtureId: string,
  set: RunSummary['set'],
  strategy: Strategy,
  attempt: FocusSchematicLayoutAttempt,
  deterministic: boolean | null,
): RunSummary {
  const gates = evaluateHardGates(attempt);
  return {
    fixtureId,
    set,
    strategy,
    status: attempt.status,
    configId: attempt.configId,
    hardGatePassed: gates.passed,
    hardGateFailures: gates.failures,
    deterministic,
    routeCoverage: attempt.status === 'success' ? attempt.routeCoverage : null,
    quality:
      attempt.status === 'success'
        ? {
            approximateCrossings: attempt.quality.approximateCrossingCount,
            alignmentMean: attempt.quality.meanAttachmentAlignmentError,
            alignmentP95: attempt.quality.p95AttachmentAlignmentError,
            area: attempt.quality.totalBoundsArea,
            emptyAreaRatio: attempt.quality.emptyAreaRatio,
            folderAdjacency: attempt.quality.sameFolderAdjacencyRatio,
          }
        : {
            approximateCrossings: null,
            alignmentMean: null,
            alignmentP95: null,
            area: null,
            emptyAreaRatio: null,
            folderAdjacency: null,
          },
    timings: attempt.timings,
    reason: attempt.status === 'success' ? null : attempt.reason,
  };
}

const settingsGrid = [
  { ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS, ranker: 'network-simplex' as const },
  { ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS, ranker: 'tight-tree' as const },
  { ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS, ranker: 'longest-path' as const },
  {
    ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
    ranker: 'network-simplex' as const,
    internalNodeSeparation: 32,
    internalRankSeparation: 56,
    macroNodeSeparation: 48,
    macroRankSeparation: 96,
  },
  {
    ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
    ranker: 'tight-tree' as const,
    internalNodeSeparation: 32,
    internalRankSeparation: 56,
    macroNodeSeparation: 48,
    macroRankSeparation: 96,
  },
  {
    ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
    ranker: 'longest-path' as const,
    internalNodeSeparation: 32,
    internalRankSeparation: 56,
    macroNodeSeparation: 48,
    macroRankSeparation: 96,
  },
] as const;

function calibration() {
  return (['A', 'B'] as const).flatMap((strategy) =>
    settingsGrid.map((settings) => {
      const rows = SEMANTIC_FIXTURES.slice(0, 10).map((spec) => {
        const attempt = runDirect(
          strategy,
          createLayoutInput(buildFixture(spec), settings),
        );
        return summarize(spec.id, 'calibration', strategy, attempt, null);
      });
      return {
        strategy,
        configId: rows[0]?.configId ?? 'unknown',
        passed: rows.filter(({ hardGatePassed }) => hardGatePassed).length,
        total: rows.length,
        totalArea: rows.reduce((sum, row) => sum + (row.quality.area ?? 0), 0),
      };
    }),
  );
}

function sourceOrderExperiment() {
  const run = (reverseInsertion: boolean, constraints: boolean) => {
    const graph = new dagre.graphlib.Graph({ multigraph: true });
    graph.setDefaultEdgeLabel(() => ({}));
    graph.setGraph({
      rankdir: 'LR',
      ranker: 'network-simplex',
      nodesep: 24,
      ranksep: 48,
    });
    graph.setNode('document', { width: 200, height: 80 });
    const siblings = ['section-1', 'section-2', 'section-3', 'section-4'];
    for (const id of reverseInsertion ? [...siblings].reverse() : siblings) {
      graph.setNode(id, { width: 184, height: 72 });
      graph.setEdge('document', id, { minlen: 1, weight: 8 }, id);
    }
    dagre.layout(
      graph,
      constraints
        ? {
            useDynamic: false,
            constraints: siblings.slice(1).map((right, index) => ({
              left: siblings[index]!,
              right,
            })),
          }
        : { useDynamic: false },
    );
    return siblings
      .map((id) => ({ id, y: (graph.node(id) as { y: number }).y }))
      .sort((left, right) => left.y - right.y)
      .map(({ id }) => id);
  };
  return {
    publicApisVerified: ['constraints', 'customOrder'],
    canonicalInsertionDefault: run(false, false),
    reverseInsertionDefault: run(true, false),
    reverseInsertionWithConstraints: run(true, true),
    selectedPolicy:
      'canonical source-line insertion plus public adjacent-sibling constraints; customOrder and private rank/order mutation are not used',
  };
}

function filteredPolicyExperiment() {
  const cases: readonly FixtureSpec[] = [
    SEMANTIC_FIXTURES.find(({ id }) => id === 'F14')!,
    {
      id: 'F14-multihop',
      label: 'two filtered intermediaries',
      root: 'Root',
      documents: ['Root', 'Hidden-1', 'Hidden-2', 'Visible'],
      references: [
        { source: 'Root', target: 'Hidden-1' },
        { source: 'Hidden-1', target: 'Hidden-2' },
        { source: 'Hidden-2', target: 'Visible' },
      ],
      direction: 'outgoing',
      filters: { text: 'Visible' },
      withStructure: true,
    },
  ];
  return cases.flatMap((spec) =>
    (['compact-bridge', 'context-card'] as const).flatMap(
      (filteredModulePolicy) =>
        (['A', 'B'] as const).map((strategy) => {
          const attempt = runDirect(
            strategy,
            createLayoutInput(buildFixture(spec), {
              ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
              filteredModulePolicy,
            }),
          );
          return {
            fixtureId: spec.id,
            filteredModulePolicy,
            strategy,
            status: attempt.status,
            hardGates: evaluateHardGates(attempt),
            area:
              attempt.status === 'success'
                ? attempt.quality.totalBoundsArea
                : null,
          };
        }),
    ),
  );
}

function fixtureSet(
  profile: Exclude<Profile, 'fixtures' | 'stability'>,
): readonly FixtureSpec[] {
  if (profile === 'small')
    return Array.from({ length: 8 }, (_, index) =>
      generatedFixture(100 + index, 24),
    );
  if (profile === 'medium')
    return Array.from({ length: 5 }, (_, index) =>
      generatedFixture(200 + index, 120),
    );
  return [hubFixture(500)];
}

async function benchmarkFixtures(profile: Exclude<Profile, 'stability'>) {
  const specs =
    profile === 'fixtures'
      ? [
          ...SEMANTIC_FIXTURES,
          ...Array.from({ length: 24 }, (_, index) =>
            generatedFixture(index + 1),
          ),
        ]
      : [...fixtureSet(profile)];
  const rows: RunSummary[] = [];
  for (const spec of specs) {
    const built = buildFixture(spec);
    const input = createLayoutInput(built);
    for (const strategy of ['D0', 'A', 'B'] as const) {
      const heavy = profile === 'medium' || profile === 'hub';
      const attempt = heavy
        ? await runIsolated(strategy, input, profile === 'hub' ? 15_000 : 8_000)
        : runDirect(strategy, input);
      const second = heavy ? null : runDirect(strategy, input);
      const deterministic =
        second === null
          ? null
          : attempt.status === 'success' && second.status === 'success'
            ? JSON.stringify(attempt.candidate) ===
              JSON.stringify(second.candidate)
            : attempt.status === second.status;
      const set: RunSummary['set'] = /^F(?:[1-9]|10)$/.test(spec.id)
        ? 'calibration'
        : spec.id.startsWith('F')
          ? 'holdout'
          : profile === 'fixtures'
            ? 'generated'
            : 'profile';
      rows.push(summarize(spec.id, set, strategy, attempt, deterministic));
    }
  }
  return rows;
}

function benchmarkStability() {
  const rows: {
    readonly pairId: string;
    readonly label: string;
    readonly strategy: 'A' | 'B';
    readonly beforeStatus: string;
    readonly afterStatus: string;
    readonly quality: FocusSchematicStabilityQuality | null;
  }[] = [];
  for (const pair of STABILITY_PAIRS) {
    const beforeFixture = buildFixture(pair.before);
    const afterFixture = buildFixture(pair.after);
    for (const strategy of ['A', 'B'] as const) {
      const before = runDirect(strategy, createLayoutInput(beforeFixture));
      const after = runDirect(strategy, createLayoutInput(afterFixture));
      rows.push({
        pairId: pair.id,
        label: pair.label,
        strategy,
        beforeStatus: before.status,
        afterStatus: after.status,
        quality:
          before.status === 'success' && after.status === 'success'
            ? compareFocusSchematicLayouts({
                beforeModel: beforeFixture.model,
                beforeLayout: before.candidate,
                afterModel: afterFixture.model,
                afterLayout: after.candidate,
              })
            : null,
      });
    }
  }
  return rows;
}

const profile = profileFromArgs();
const report =
  profile === 'stability'
    ? {
        schemaVersion: 1,
        profile,
        dagreVersion: '3.1.1',
        coldStateless: true,
        rows: benchmarkStability(),
        dynamic: {
          installedPublicOptionsVerified: ['useDynamic', 'corePath'],
          useDynamic: true,
          corePathUsed: false,
          rows: dynamicExperiment(),
        },
      }
    : {
        schemaVersion: 1,
        profile,
        dagreVersion: '3.1.1',
        coldStateless: true,
        timeoutIsolation: profile === 'medium' || profile === 'hub',
        calibration: profile === 'fixtures' ? calibration() : undefined,
        sourceOrderExperiment:
          profile === 'fixtures' ? sourceOrderExperiment() : undefined,
        filteredPolicyExperiment:
          profile === 'fixtures' ? filteredPolicyExperiment() : undefined,
        rows: await benchmarkFixtures(profile),
      };
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
