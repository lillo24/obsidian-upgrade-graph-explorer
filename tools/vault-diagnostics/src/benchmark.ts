import { performance } from 'node:perf_hooks';

import {
  generateSyntheticWorkspace,
  type SyntheticWorkspaceConfig,
} from '@icarus-graph-explorer/diagnostics-obsidian';
import {
  createProjectionWorkspace,
  documentOnlyProjectionState,
  projectView,
  topLevelSectionProjectionState,
  type ViewProjection,
  type ViewProjectionState,
} from '@icarus-graph-explorer/view-projection';
import { prepareRendererGraph } from '@icarus-graph-explorer/renderer-reactflow/prepare';

import {
  BENCHMARK_PROFILES,
  isBenchmarkProfile,
  type BenchmarkProfile,
} from './benchmark-config';
import { buildReportFromSources } from './pipeline';

function selectedProfile(args: readonly string[]): BenchmarkProfile {
  const normalizedArgs = args[0] === '--' ? args.slice(1) : args;
  if (normalizedArgs.length === 0) return 'small';
  if (
    normalizedArgs.length !== 2 ||
    normalizedArgs[0] !== '--profile' ||
    normalizedArgs[1] === undefined
  ) {
    throw new Error(
      'Usage: pnpm benchmark:pipeline -- --profile <smoke|small|medium|large>',
    );
  }
  if (!isBenchmarkProfile(normalizedArgs[1])) {
    throw new Error(`Unknown benchmark profile: ${normalizedArgs[1]}`);
  }
  return normalizedArgs[1];
}

function expectedCounts(config: SyntheticWorkspaceConfig) {
  const sections = config.documentCount * config.sectionsPerDocument;
  const referencesPerSection =
    config.resolvedReferencesPerSection +
    config.unresolvedReferencesPerSection +
    config.ambiguousReferencesPerSection;
  return {
    documents: config.documentCount,
    sections,
    blocks: sections,
    references: sections * referencesPerSection,
  };
}

function elapsed(start: number): number {
  return Number((performance.now() - start).toFixed(3));
}

function projectionCounts(projection: ViewProjection) {
  return {
    nodes: projection.nodes.length,
    edges: projection.edges.length,
    referenceGroups: projection.edges.filter(
      (edge) => edge.kind === 'reference',
    ).length,
    syntheticTargets: projection.nodes.filter(
      (node) => node.kind === 'reference-target',
    ).length,
  };
}

function measureProjection(
  workspace: ReturnType<typeof createProjectionWorkspace>,
  state: ViewProjectionState,
) {
  const start = performance.now();
  const projection = projectView(workspace, state);
  return { timingMs: elapsed(start), ...projectionCounts(projection) };
}

function measureRenderer(
  projection: ViewProjection,
  layoutMode: 'structure' | 'focus',
) {
  const start = performance.now();
  const graph = prepareRendererGraph(projection, { layoutMode });
  return {
    timingMs: elapsed(start),
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    layoutWarning: graph.layoutWarning,
  };
}

function main(): void {
  const profile = selectedProfile(process.argv.slice(2));
  const config = BENCHMARK_PROFILES[profile];
  const run = buildReportFromSources({
    workspaceId: `synthetic-${profile}`,
    markdownDocuments: generateSyntheticWorkspace(config),
    nonMarkdownPaths: [],
    discoveryReadMs: 0,
  });
  const indexStart = performance.now();
  const projectionWorkspace = createProjectionWorkspace(run.report.snapshot);
  const indexConstructionMs = elapsed(indexStart);
  const expandableEntityIds = projectionWorkspace
    .entities()
    .filter((entity) => entity.kind !== 'block')
    .map((entity) => entity.id);
  const focusRoot = projectionWorkspace
    .entities()
    .find((entity) => entity.kind === 'document');
  if (focusRoot === undefined) {
    throw new Error('Synthetic benchmark produced no focus-root document.');
  }
  const documentsOnly = documentOnlyProjectionState();
  const topLevelSections = topLevelSectionProjectionState();
  const scenarioStates = {
    documentsOnly,
    topLevelSections,
    expandedHierarchy: {
      disclosure: {
        defaultDepth: 1,
        expandedEntityIds: expandableEntityIds,
        collapsedEntityIds: [],
        includeBlocks: true,
      },
    } satisfies ViewProjectionState,
    oneHopFocus: {
      ...documentsOnly,
      focus: {
        rootEntityId: focusRoot.id,
        hops: 1,
        direction: 'both',
        hierarchyContext: 'ancestors',
      },
    } satisfies ViewProjectionState,
    resolutionFilter: {
      ...topLevelSections,
      filters: {
        referenceStatuses: ['unresolved', 'ambiguous', 'invalid'],
      },
    } satisfies ViewProjectionState,
  };
  const measuredProjections = Object.fromEntries(
    Object.entries(scenarioStates).map(([name, state]) => [
      name,
      measureProjection(projectionWorkspace, state),
    ]),
  );
  const rendererScenarios = Object.fromEntries(
    Object.entries(scenarioStates)
      .filter(([name]) =>
        ['documentsOnly', 'expandedHierarchy', 'oneHopFocus'].includes(name),
      )
      .map(([name, state]) => {
        const projection = projectView(projectionWorkspace, state);
        return [
          name,
          measureRenderer(
            projection,
            name === 'oneHopFocus' ? 'focus' : 'structure',
          ),
        ];
      }),
  );
  console.log(
    JSON.stringify(
      {
        profile,
        config,
        workload: expectedCounts(config),
        observed: {
          documents: run.summary.documents,
          sections: run.summary.sections,
          blocks: run.summary.blocks,
          references: run.summary.references,
        },
        timingsMs: {
          parseAdapt: run.timings.parseAdaptMs,
          resolution: run.timings.resolutionMs,
          reportConstruction: run.timings.reportConstructionMs,
        },
        projection: {
          canonicalEntities: run.report.snapshot.entities.length,
          canonicalReferences: run.report.snapshot.references.length,
          indexConstructionMs,
          scenarios: measuredProjections,
        },
        renderer: {
          library: '@xyflow/react',
          layout: '@dagrejs/dagre',
          scenarios: rendererScenarios,
        },
        note: 'Diagnostic evidence only; no performance budget is enforced.',
      },
      null,
      2,
    ),
  );
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Pipeline benchmark failed: ${message}`);
  process.exitCode = 1;
}
