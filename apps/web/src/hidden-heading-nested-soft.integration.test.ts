import { createFocusSchematicModel } from '@icarus-graph-explorer/focus-schematic';
import {
  FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
  FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
  type FocusSchematicLayoutInput,
  type FocusSchematicLayoutWorkerRequest,
  type FocusSchematicProductLayoutPolicies,
} from '@icarus-graph-explorer/focus-schematic-layout';
import { handleFocusSchematicLayoutWorkerRequest } from '@icarus-graph-explorer/focus-schematic-layout/worker-runtime';
import { focusSchematicNodeDimensions } from '@icarus-graph-explorer/renderer-reactflow/focus-schematic';
import {
  createProjectionWorkspace,
  projectLocalView,
  type ViewProjectionState,
} from '@icarus-graph-explorer/view-projection';
import { initializeObsidianWorkspaceEngine } from '@icarus-graph-explorer/workspace-engine-obsidian';
import { describe, expect, it } from 'vitest';

import {
  exactFocusSchematicLayoutCacheKey,
  FocusSchematicLayoutCache,
} from './focus-schematic-layout-cache';
import {
  createFocusSchematicLayoutWorkerClient,
  type FocusSchematicLayoutWorkerTransport,
} from './workers/focus-schematic-layout-worker-client';

const documentSources = [
  {
    path: 'PatternTheory/ResponseBehaviour/Focus.md',
    source: `# Focus
[[PatternTheory/PatternInstances/GeneralPattern/God]]
[[PatternTheory/PatternInstances/GeneralPattern/Philosophy/Relativity]]
[[PatternTheory/PatternInstances/Underlying/Foundational]]
[[PatternTheory/Language/Language]]
[[PatternTheory/Language/Symbols]]
[[PatternTheory/ResponseBehaviour/Emotions]]
[[PatternTheory/ResponseBehaviour/BodyState]]
[[PatternTheory/ResponseBehaviour/Rationale]]`,
  },
  {
    path: 'PatternTheory/ResponseBehaviour/Rationale.md',
    source: `# Rationale
## Geometry significant
### Premise one
#### Detail one
### Premise two
#### Detail two
### Premise three
#### Detail three
## Retained sibling`,
  },
  { path: 'PatternTheory/ResponseBehaviour/Emotions.md', source: '# Emotions' },
  { path: 'PatternTheory/ResponseBehaviour/BodyState.md', source: '# Body' },
  { path: 'PatternTheory/Language/Language.md', source: '# Language' },
  { path: 'PatternTheory/Language/Symbols.md', source: '# Symbols' },
  {
    path: 'PatternTheory/PatternInstances/GeneralPattern/God.md',
    source: '# God',
  },
  {
    path: 'PatternTheory/PatternInstances/GeneralPattern/Philosophy/Relativity.md',
    source: '# Relativity',
  },
  {
    path: 'PatternTheory/PatternInstances/Underlying/Foundational.md',
    source: '# Foundational',
  },
] as const;

const resolved = initializeObsidianWorkspaceEngine({
  workspaceId: 'hidden-heading-nested-soft',
  documents: documentSources,
});
if (!resolved.ok) throw new Error(JSON.stringify(resolved.failure));
const workspace = createProjectionWorkspace(resolved.snapshot);
const root = workspace
  .entities()
  .find(
    (entity) =>
      entity.kind === 'document' &&
      entity.source.path === 'PatternTheory/ResponseBehaviour/Focus.md',
  );
const significantHeading = workspace
  .entities()
  .find(
    (entity) =>
      entity.kind === 'section' &&
      entity.source.path === 'PatternTheory/ResponseBehaviour/Rationale.md' &&
      entity.title === 'Geometry significant',
  );
const rationale = workspace
  .entities()
  .find(
    (entity) =>
      entity.kind === 'document' &&
      entity.source.path === 'PatternTheory/ResponseBehaviour/Rationale.md',
  );
if (root?.kind !== 'document') throw new Error('Missing synthetic Focus File.');
if (significantHeading?.kind !== 'section')
  throw new Error('Missing geometry-significant Heading.');
if (rationale?.kind !== 'document')
  throw new Error('Missing synthetic Rationale File.');
const rootId = root.id;
const rationaleId = rationale.id;

const policies = {
  macroLayout: 'soft-folder-clusters',
  softFolderStrength: 100,
  softFolderScopeMode: 'nested',
  softAncestorDecayBase: 4,
  softFolderDisplayIntent: {
    fileParentOverrides: [],
    flattenedFolderKeys: [],
  },
  endpointOrderPolicy: 'crossing-optimized',
  internalLayoutVariant: 'adaptive-compass',
} as const satisfies FocusSchematicProductLayoutPolicies;

function productInput(hiddenEntityIds: readonly string[]) {
  const state: ViewProjectionState = {
    disclosure: {
      defaultDepth: 3,
      expandedEntityIds: workspace
        .entities()
        .filter(({ kind }) => kind === 'document' || kind === 'section')
        .map(({ id }) => id),
      hiddenEntityIds,
      collapsedEntityIds: [],
      includeBlocks: true,
    },
    focus: {
      rootEntityId: rootId,
      hops: 2,
      direction: 'outgoing',
      hierarchyContext: 'ancestors-and-children',
    },
  };
  const projection = projectLocalView(workspace, state);
  const model = createFocusSchematicModel({ workspace, state, projection });
  const input: FocusSchematicLayoutInput = {
    model,
    projection,
    nodeDimensions: focusSchematicNodeDimensions(projection, model),
    settings: {
      ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
      directionalFolderBandsEnabled: false,
    },
  };
  return { input, model, projection, state };
}

function compute(input: FocusSchematicLayoutInput, requestId: number) {
  const response = handleFocusSchematicLayoutWorkerRequest(
    {
      protocolVersion: FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
      requestId,
      kind: 'layout',
      input,
      policies,
    },
    () => 0,
  );
  if (response.kind !== 'success') throw new Error(response.message);
  return response;
}

class DeferredWorker implements FocusSchematicLayoutWorkerTransport {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null;
  request?: FocusSchematicLayoutWorkerRequest;

  postMessage(request: FocusSchematicLayoutWorkerRequest): void {
    this.request = request;
  }

  terminate(): void {}

  succeed(): void {
    if (this.request === undefined) throw new Error('Missing worker request.');
    this.onmessage?.({
      data: handleFocusSchematicLayoutWorkerRequest(this.request, () => 0),
    } as MessageEvent<unknown>);
  }
}

describe('HIERDISC1 hidden-Heading Nested Soft product path', () => {
  it('adopts Hide, Restore, and rapid latest-wins geometry without changing folder semantics', async () => {
    const visible = productInput([]);
    const hidden = productInput([significantHeading.id]);
    const restored = productInput([]);
    expect(
      hidden.projection.nodes.some(
        (node) =>
          node.kind === 'entity' && node.entityId === significantHeading.id,
      ),
    ).toBe(false);
    expect(
      hidden.model.modules.map(({ id, folderKey }) => ({ id, folderKey })),
    ).toEqual(
      visible.model.modules.map(({ id, folderKey }) => ({ id, folderKey })),
    );
    const visibleDimensions = visible.input.nodeDimensions.filter((dimension) =>
      visible.model.modules
        .find(({ id }) => id === rationaleId)!
        .visibleEntityNodeIds.includes(dimension.projectionNodeId),
    );
    const hiddenDimensions = hidden.input.nodeDimensions.filter((dimension) =>
      hidden.model.modules
        .find(({ id }) => id === rationaleId)!
        .visibleEntityNodeIds.includes(dimension.projectionNodeId),
    );
    expect(hiddenDimensions.length).toBeLessThan(visibleDimensions.length);

    const visibleResponse = compute(visible.input, 1);
    const hiddenResponse = compute(hidden.input, 2);
    const visibleModule = visibleResponse.result.candidate.modules.find(
      ({ moduleId }) => moduleId === rationaleId,
    )!;
    const hiddenModule = hiddenResponse.result.candidate.modules.find(
      ({ moduleId }) => moduleId === rationaleId,
    )!;
    expect(hiddenModule.height).toBeLessThan(visibleModule.height);
    for (const response of [visibleResponse, hiddenResponse])
      expect(response.softClusterEvidence?.nestedHierarchy).toMatchObject({
        postNestedNestedParentContainmentViolationCount: 0,
        postNestedNestedFolderSplitViolationCount: 0,
        postNestedNestedGuideBlockerViolationCount: 0,
        postGroupNestedParentContainmentViolationCount: 0,
        postGroupNestedFolderSplitViolationCount: 0,
        postGroupNestedGuideBlockerViolationCount: 0,
      });

    const visibleKey = exactFocusSchematicLayoutCacheKey(
      visible.input,
      policies,
    );
    const hiddenKey = exactFocusSchematicLayoutCacheKey(hidden.input, policies);
    expect(hiddenKey).not.toBe(visibleKey);
    expect(exactFocusSchematicLayoutCacheKey(restored.input, policies)).toBe(
      visibleKey,
    );
    const cache = new FocusSchematicLayoutCache();
    cache.set(visible.input, policies, visibleResponse.result);
    expect(cache.get(restored.input, policies).status).toBe('hit');

    const workers: DeferredWorker[] = [];
    const service = createFocusSchematicLayoutWorkerClient({
      createWorker: () => {
        const worker = new DeferredWorker();
        workers.push(worker);
        return worker;
      },
    });
    const hide = service.layoutLatest(hidden.input, policies);
    const restore = service.layoutLatest(restored.input, policies);
    const hideAgain = service.layoutLatest(hidden.input, policies);
    expect(await hide).toEqual({ status: 'superseded' });
    expect(await restore).toEqual({ status: 'superseded' });
    workers[2]!.succeed();
    expect(await hideAgain).toMatchObject({
      status: 'success',
      metrics: {
        softClusterEvidence: {
          nestedHierarchy: {
            postGroupNestedFolderSplitViolationCount: 0,
            postGroupNestedGuideBlockerViolationCount: 0,
          },
        },
      },
    });
  }, 30_000);
});
