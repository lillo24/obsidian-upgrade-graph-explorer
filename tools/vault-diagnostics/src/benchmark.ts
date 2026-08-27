import { performance } from 'node:perf_hooks';

import {
  generateSyntheticWorkspace,
  type SyntheticWorkspaceConfig,
} from '@icarus-graph-explorer/diagnostics-obsidian';
import {
  createInspectionWorkspace,
  inspectEntity,
  inspectProjectedEdge,
  searchEntities,
} from '@icarus-graph-explorer/explorer-inspection';
import {
  createProjectionWorkspace,
  documentOnlyProjectionState,
  projectView,
  topLevelSectionProjectionState,
  type ViewProjection,
  type ViewProjectionState,
} from '@icarus-graph-explorer/view-projection';
import {
  layoutRendererGraph,
  mapProjectionToReactFlow,
} from '@icarus-graph-explorer/renderer-reactflow/prepare';

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
  const mappingStart = performance.now();
  const mapped = mapProjectionToReactFlow(projection, layoutMode, new Set());
  const mappingMs = elapsed(mappingStart);
  const layoutStart = performance.now();
  const graph = layoutRendererGraph(mapped.nodes, mapped.edges, layoutMode);
  return {
    layoutMode,
    mappingMs,
    layoutMs: elapsed(layoutStart),
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
      .filter(([name]) => ['documentsOnly', 'oneHopFocus'].includes(name))
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
  const inspectionIndexStart = performance.now();
  const inspectionWorkspace = createInspectionWorkspace(run.report.snapshot);
  const inspectionIndexConstructionMs = elapsed(inspectionIndexStart);
  const searchStart = performance.now();
  const searchResults = searchEntities(inspectionWorkspace, 'Section 2-0');
  const searchMs = elapsed(searchStart);
  const entityInspectionStart = performance.now();
  const inspectedEntity = inspectEntity(inspectionWorkspace, focusRoot.id);
  const entityInspectionMs = elapsed(entityInspectionStart);
  const documentsProjection = projectView(projectionWorkspace, documentsOnly);
  const aggregatedEdge = documentsProjection.edges
    .filter((edge) => edge.kind === 'reference')
    .sort(
      (left, right) =>
        right.referenceIds.length - left.referenceIds.length ||
        left.id.localeCompare(right.id),
    )[0];
  if (aggregatedEdge === undefined) {
    throw new Error(
      'Synthetic benchmark produced no projected reference edge to inspect.',
    );
  }
  const edgeInspectionStart = performance.now();
  const inspectedEdge = inspectProjectedEdge(
    inspectionWorkspace,
    documentsProjection,
    aggregatedEdge.id,
  );
  const edgeInspectionMs = elapsed(edgeInspectionStart);
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
        inspection: {
          canonicalEntities: inspectionWorkspace.entities().length,
          canonicalReferences: inspectionWorkspace.references().length,
          indexConstructionMs: inspectionIndexConstructionMs,
          search: {
            query: 'Section 2-0',
            timingMs: searchMs,
            resultCount: searchResults.length,
          },
          entitySubtree: {
            entityId: focusRoot.id,
            timingMs: entityInspectionMs,
            descendantCount: inspectedEntity.descendantCount,
            outgoingCount: inspectedEntity.outgoingReferences.length,
            backlinkCount: inspectedEntity.backlinks.length,
            candidateMentionCount:
              inspectedEntity.ambiguousCandidateMentions.length,
          },
          aggregatedEdge: {
            projectionEdgeId: aggregatedEdge.id,
            timingMs: edgeInspectionMs,
            occurrenceCount:
              inspectedEdge.kind === 'reference'
                ? inspectedEdge.occurrences.length
                : 0,
          },
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
