import {
  createGlobalFixtureProjection,
  mutateFixtureProjection,
  type GlobalFixtureProfile,
} from './fixtures';
import { createHarnessGlobalLayoutService } from './layout-worker';
import {
  composeGlobalSpatialOverrides,
  DEFAULT_GLOBAL_LAYOUT_SETTINGS,
  globalLayoutPositionsFromInput,
  GlobalRendererSession,
  mapProjectionToGlobal,
  reconcileGlobalAutomaticPositions,
  resetGlobalSeedPositions,
  warmGlobalRendererInput,
  type GlobalLayoutPosition,
  type GlobalNodeAttributes,
  type GlobalRendererInput,
  type GlobalRendererMeasurement,
} from '@icarus-graph-explorer/renderer-sigma';
import {
  clearFolderClusterAnchors,
  createEmptySpatialOverrideRegistry,
  folderClusterAnchorMap,
  removeFolderClusterAnchor,
  setFolderClusterAnchor,
  type SpatialCompositionResult,
} from '@icarus-graph-explorer/spatial-overrides';
import type { GlobalLayoutService } from '@icarus-graph-explorer/renderer-sigma/types';
import type { ViewProjection } from '@icarus-graph-explorer/view-projection';

import './styles.css';

interface SpikeSnapshot {
  readonly candidate: {
    readonly sigma: '3.0.3';
    readonly graphology: '0.26.0';
    readonly forceAtlas2: '0.10.1';
  };
  readonly buildMode: string;
  readonly profile: GlobalFixtureProfile;
  readonly nodes: number;
  readonly edges: number;
  readonly labelsShown: number;
  readonly edgeEvents: boolean;
  readonly measurements: readonly GlobalRendererMeasurement[];
  readonly viewport: ReturnType<GlobalRendererSession['semanticViewport']>;
  readonly spatial: {
    readonly anchorCount: number;
    readonly activeFolderCount: number;
    readonly inactiveFolderCount: number;
    readonly layoutRequests: number;
  };
}

declare global {
  interface Window {
    icarusGlobalRendererSpike: {
      snapshot(): SpikeSnapshot;
      runInteractionSample(): Promise<SpikeSnapshot>;
      compareUpdate(fraction: 0.01 | 0.1): Promise<SpikeSnapshot>;
    };
  }
}

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.querySelector<T>(`#${id}`);
  if (element === null) throw new Error(`Spike element #${id} was not found.`);
  return element;
}

const container = requiredElement<HTMLDivElement>('sigma-container');
const profileSelect = requiredElement<HTMLSelectElement>('profile');
const labelsInput = requiredElement<HTMLInputElement>('labels');
const edgeEventsInput = requiredElement<HTMLInputElement>('edge-events');
const layoutButton = requiredElement<HTMLButtonElement>('layout');
const resetButton = requiredElement<HTMLButtonElement>('reset');
const updateOneButton = requiredElement<HTMLButtonElement>('update-one');
const updateTenButton = requiredElement<HTMLButtonElement>('update-ten');
const recreateButton = requiredElement<HTMLButtonElement>('recreate');
const interactionsButton = requiredElement<HTMLButtonElement>('interactions');
const bookmarkButton = requiredElement<HTMLButtonElement>('bookmark');
const spatialForm = requiredElement<HTMLFormElement>('spatial-form');
const spatialFolderInput = requiredElement<HTMLInputElement>('spatial-folder');
const spatialXInput = requiredElement<HTMLInputElement>('spatial-x');
const spatialYInput = requiredElement<HTMLInputElement>('spatial-y');
const spatialResetFolderButton = requiredElement<HTMLButtonElement>(
  'spatial-reset-folder',
);
const spatialResetAllButton =
  requiredElement<HTMLButtonElement>('spatial-reset-all');
const spatialSummary = requiredElement<HTMLDListElement>('spatial-summary');
const searchInput = requiredElement<HTMLInputElement>('search');
const searchResults = requiredElement<HTMLUListElement>('search-results');
const inspector = requiredElement<HTMLDivElement>('inspector');
const metrics = requiredElement<HTMLElement>('metrics');
const status = requiredElement<HTMLParagraphElement>('status');
const measurementHistory = requiredElement<HTMLOListElement>(
  'measurement-history',
);

let profile: GlobalFixtureProfile = 'product-small';
let projection: ViewProjection = createGlobalFixtureProjection(profile);
let input: GlobalRendererInput = mapProjectionToGlobal(projection);
let automaticPositions: readonly GlobalLayoutPosition[] =
  globalLayoutPositionsFromInput(input);
let spatialRegistry = createEmptySpatialOverrideRegistry('synthetic-spike');
let spatialComposition: SpatialCompositionResult =
  composeGlobalSpatialOverrides(
    automaticPositions,
    input,
    folderClusterAnchorMap(spatialRegistry),
  );
let layoutRequests = 0;
let session: GlobalRendererSession | undefined;
const layoutService: GlobalLayoutService = createHarnessGlobalLayoutService();
const measurements: GlobalRendererMeasurement[] = [];
const numberFormatter = new Intl.NumberFormat();

function record(measurement: GlobalRendererMeasurement): void {
  measurements.push(measurement);
  if (measurements.length > 40) measurements.shift();
  renderMetrics();
}

function selectionInspector(
  key: string,
  attributes: GlobalNodeAttributes,
): void {
  const heading = document.createElement('h3');
  heading.textContent = attributes.label;
  const facts = document.createElement('dl');
  const rows: readonly (readonly [string, string])[] = [
    ['Type', attributes.nodeKind],
    ['Stable renderer key', key],
    ['Canonical entity', attributes.entityId ?? 'Diagnostic target'],
    ['Location', attributes.sourcePath ?? 'Unresolved reference target'],
    ['Revealable descendants', String(attributes.revealableDescendantCount)],
    ['Resolution', attributes.status ?? 'Resolved/content'],
  ];
  for (const [label, value] of rows) {
    const term = document.createElement('dt');
    term.textContent = label;
    const description = document.createElement('dd');
    description.textContent = value;
    facts.append(term, description);
  }
  const handoff = document.createElement('button');
  handoff.type = 'button';
  handoff.textContent = 'Open in Structure (Feasibility Only)';
  handoff.addEventListener('click', () => {
    status.textContent =
      attributes.entityId === null
        ? 'Diagnostic targets do not hand off to Structure.'
        : `A future KG13B handoff could reveal canonical entity ${attributes.entityId}; no production mode changed.`;
  });
  inspector.replaceChildren(heading, facts, handoff);
}

function createSession(): GlobalRendererSession {
  spatialComposition = composeGlobalSpatialOverrides(
    automaticPositions,
    input,
    folderClusterAnchorMap(spatialRegistry),
  );
  const created = new GlobalRendererSession(
    container,
    warmGlobalRendererInput(input, spatialComposition.displayedPositions),
    {
      settings: DEFAULT_GLOBAL_LAYOUT_SETTINGS,
      trackpadZoomMode: 'scroll-zoom',
      labels: labelsInput.checked,
      edgeEvents: edgeEventsInput.checked,
      onNodeSelected: (key, attributes) => {
        if (key !== undefined && attributes !== undefined) {
          selectionInspector(key, attributes);
        }
      },
    },
  );
  void created.ready
    .then((ready) => {
      record({ operation: 'sigma-mount', durationMs: ready.mountMs });
      record({
        operation: 'first-after-render',
        durationMs: ready.firstRenderMs,
      });
      status.textContent = `Rendered ${numberFormatter.format(created.counts().nodes)} nodes and ${numberFormatter.format(created.counts().edges)} edges.`;
      renderSpatialSummary();
    })
    .catch(showFailure);
  return created;
}

function pointText(point: { readonly x: number; readonly y: number }): string {
  return `${point.x.toFixed(2)}, ${point.y.toFixed(2)}`;
}

function renderSpatialSummary(): void {
  const folderKey = spatialFolderInput.value.trim();
  const active = spatialComposition.activeFolders.find(
    (folder) => folder.folderKey === folderKey,
  );
  const rows: readonly (readonly [string, string])[] = [
    [
      'Automatic frame',
      `center ${spatialComposition.automaticFrame.centerX.toFixed(2)}, ${spatialComposition.automaticFrame.centerY.toFixed(2)} · half ${spatialComposition.automaticFrame.halfWidth.toFixed(2)} × ${spatialComposition.automaticFrame.halfHeight.toFixed(2)}`,
    ],
    [
      'Automatic folder center',
      active === undefined ? 'Inactive' : pointText(active.automaticCenter),
    ],
    [
      'Target anchor',
      active === undefined ? 'Automatic' : pointText(active.target),
    ],
    [
      'Displayed translation',
      active === undefined ? '0.00, 0.00' : pointText(active.translation),
    ],
    ['Automatic layout requests', String(layoutRequests)],
  ];
  const fragment = document.createDocumentFragment();
  for (const [label, value] of rows) {
    const term = document.createElement('dt');
    term.textContent = label;
    const description = document.createElement('dd');
    description.textContent = value;
    fragment.append(term, description);
  }
  spatialSummary.replaceChildren(fragment);
}

async function applySpatialDisplay(operation: string): Promise<void> {
  const started = performance.now();
  spatialComposition = composeGlobalSpatialOverrides(
    automaticPositions,
    input,
    folderClusterAnchorMap(spatialRegistry),
  );
  await activeSession().applyPositions(spatialComposition.displayedPositions);
  record({
    operation,
    durationMs: Number((performance.now() - started).toFixed(3)),
  });
  renderSpatialSummary();
}

function renderMetrics(): void {
  const counts = session?.counts() ?? {
    nodes: input.nodes.length,
    edges: input.edges.length,
  };
  const latest = measurements.at(-1);
  const items: readonly (readonly [string, string])[] = [
    ['Nodes', numberFormatter.format(counts.nodes)],
    ['Edges', numberFormatter.format(counts.edges)],
    ['Labels now', String(session?.displayedLabelCount() ?? 0)],
    ['Last operation', latest?.operation ?? 'Starting'],
    [
      'Last duration',
      latest === undefined ? '—' : `${latest.durationMs.toFixed(1)} ms`,
    ],
    [
      'High RAF gap',
      latest?.highRafGapMs === undefined
        ? '—'
        : `${latest.highRafGapMs.toFixed(1)} ms`,
    ],
  ];
  const fragment = document.createDocumentFragment();
  for (const [label, value] of items) {
    const wrapper = document.createElement('div');
    const term = document.createElement('dt');
    term.textContent = label;
    const description = document.createElement('dd');
    description.textContent = value;
    wrapper.append(term, description);
    fragment.append(wrapper);
  }
  metrics.replaceChildren(fragment);
  const historyFragment = document.createDocumentFragment();
  for (const measurement of measurements.slice(-20)) {
    const item = document.createElement('li');
    item.textContent = `${measurement.operation}: ${measurement.durationMs.toFixed(1)} ms${
      measurement.highRafGapMs === undefined
        ? ''
        : ` · high RAF gap ${measurement.highRafGapMs.toFixed(1)} ms`
    }`;
    historyFragment.append(item);
  }
  measurementHistory.replaceChildren(historyFragment);
}

function showFailure(error: unknown): void {
  status.classList.add('status--error');
  status.textContent = `Global renderer failed: ${error instanceof Error ? error.message : String(error)}`;
}

function activeSession(): GlobalRendererSession {
  if (session === undefined) {
    throw new Error(
      'The WebGL renderer is unavailable. Keep using the DOM search and Inspector evidence only; do not treat this run as a successful renderer result.',
    );
  }
  return session;
}

function installSession(): void {
  try {
    session = createSession();
  } catch (error: unknown) {
    session = undefined;
    showFailure(error);
    container.textContent =
      'WebGL initialization failed. This environment cannot pass the KG13A renderer gate.';
    for (const control of document.querySelectorAll<
      HTMLButtonElement | HTMLInputElement | HTMLSelectElement
    >('.control-panel button, .control-panel input, .control-panel select')) {
      control.disabled = true;
    }
  }
}

function setBusy(button: HTMLButtonElement, busy: boolean): void {
  button.disabled = busy;
  button.setAttribute('aria-busy', String(busy));
}

function renderSearchResults(): void {
  const query = searchInput.value.trim().toLocaleLowerCase();
  if (query === '') {
    searchResults.replaceChildren();
    return;
  }
  const currentSession = activeSession();
  const results = currentSession
    .nodes()
    .map((key) => ({ key, attributes: currentSession.nodeAttributes(key) }))
    .filter(
      (result): result is { key: string; attributes: GlobalNodeAttributes } =>
        result.attributes !== undefined &&
        result.attributes.entityId !== null &&
        (result.attributes.label.toLocaleLowerCase().includes(query) ||
          result.attributes.entityId.toLocaleLowerCase().includes(query)),
    )
    .slice(0, 20);
  const fragment = document.createDocumentFragment();
  for (const result of results) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = result.attributes.label;
    button.addEventListener('click', () => {
      currentSession.selectNode(result.key);
      void currentSession
        .centerNode(result.key)
        .then(record)
        .catch(showFailure);
    });
    item.append(button);
    fragment.append(item);
  }
  if (results.length === 0) {
    const item = document.createElement('li');
    item.textContent = 'No matching files.';
    fragment.append(item);
  }
  searchResults.replaceChildren(fragment);
}

async function compareUpdate(fraction: 0.01 | 0.1): Promise<SpikeSnapshot> {
  const currentSession = activeSession();
  const changedProjection = mutateFixtureProjection(projection, fraction);
  const changedInput = mapProjectionToGlobal(changedProjection);
  let started = performance.now();
  currentSession.replace(changedInput);
  const replaceMs = performance.now() - started;
  record({
    operation: `${fraction * 100}%-full-replace`,
    durationMs: replaceMs,
  });
  currentSession.replace(input);
  started = performance.now();
  currentSession.update(changedInput);
  const incrementalMs = performance.now() - started;
  record({
    operation: `${fraction * 100}%-incremental`,
    durationMs: incrementalMs,
  });
  projection = changedProjection;
  input = changedInput;
  automaticPositions = reconcileGlobalAutomaticPositions(
    changedInput,
    automaticPositions,
  );
  await applySpatialDisplay(`${fraction * 100}%-spatial-compose`);
  status.textContent = `${fraction * 100}% update: full replacement ${replaceMs.toFixed(1)} ms; incremental mutation ${incrementalMs.toFixed(1)} ms. Stable keys retained.`;
  return snapshot();
}

async function runInteractionSample(): Promise<SpikeSnapshot> {
  const currentSession = activeSession();
  const key = currentSession
    .nodes()
    .find(
      (candidate) =>
        currentSession.nodeAttributes(candidate)?.entityId !== null,
    );
  if (key === undefined)
    throw new Error('Interaction sample found no entity node.');
  const hover = await currentSession.simulateHover(key);
  record(hover);
  record(await currentSession.simulateSelection(key));
  record(await currentSession.centerNode(key));
  record(await currentSession.exerciseCamera());
  record(await currentSession.simulateHover(undefined));
  return snapshot();
}

function snapshot(): SpikeSnapshot {
  const currentSession = activeSession();
  const counts = currentSession.counts();
  return {
    candidate: { sigma: '3.0.3', graphology: '0.26.0', forceAtlas2: '0.10.1' },
    buildMode: import.meta.env.MODE,
    profile,
    nodes: counts.nodes,
    edges: counts.edges,
    labelsShown: currentSession.displayedLabelCount(),
    edgeEvents: edgeEventsInput.checked,
    measurements: [...measurements],
    viewport: currentSession.semanticViewport(),
    spatial: {
      anchorCount: spatialRegistry.allNetwork.folderAnchors.length,
      activeFolderCount: spatialComposition.activeFolders.length,
      inactiveFolderCount: spatialComposition.inactiveFolderKeys.length,
      layoutRequests,
    },
  };
}

profileSelect.addEventListener('change', () => {
  activeSession().destroy();
  profile = profileSelect.value as GlobalFixtureProfile;
  projection = createGlobalFixtureProjection(profile);
  input = mapProjectionToGlobal(projection);
  automaticPositions = globalLayoutPositionsFromInput(input);
  spatialComposition = composeGlobalSpatialOverrides(
    automaticPositions,
    input,
    folderClusterAnchorMap(spatialRegistry),
  );
  measurements.length = 0;
  inspector.textContent = 'Select a file in the graph or search results.';
  searchInput.value = '';
  searchResults.replaceChildren();
  installSession();
  renderMetrics();
});

labelsInput.addEventListener('change', () => {
  void activeSession()
    .setLabels(labelsInput.checked)
    .then(record)
    .catch(showFailure);
});

edgeEventsInput.addEventListener('change', () => {
  void activeSession()
    .setEdgeEvents(edgeEventsInput.checked)
    .then(record)
    .catch(showFailure);
});

layoutButton.addEventListener('click', () => {
  setBusy(layoutButton, true);
  status.classList.remove('status--error');
  status.textContent =
    'ForceAtlas2 is running in a dedicated worker; the canvas should remain interactive.';
  const currentSession = activeSession();
  const iterations = currentSession.counts().nodes >= 5_000 ? 30 : 100;
  layoutRequests += 1;
  renderSpatialSummary();
  void currentSession
    .runLayout(
      layoutService,
      input,
      DEFAULT_GLOBAL_LAYOUT_SETTINGS,
      iterations,
      automaticPositions,
    )
    .then(async (measurement) => {
      automaticPositions = currentSession.nodes().map((key) => {
        const attributes = currentSession.nodeAttributes(key);
        if (attributes === undefined)
          throw new Error(`Missing synthetic node ${key}.`);
        return { key, x: attributes.x, y: attributes.y };
      });
      await applySpatialDisplay('spatial-compose-apply');
      record(measurement);
      status.textContent = `Worker layout completed ${iterations} iterations in ${measurement.durationMs.toFixed(1)} ms; high UI RAF gap ${measurement.highRafGapMs?.toFixed(1) ?? 'unknown'} ms.`;
    })
    .catch(showFailure)
    .finally(() => setBusy(layoutButton, false));
});

resetButton.addEventListener('click', () => {
  input = resetGlobalSeedPositions(input);
  automaticPositions = globalLayoutPositionsFromInput(input);
  activeSession().resetPositions(input);
  void applySpatialDisplay('spatial-reset-seed')
    .then(() => {
      status.textContent =
        'Restored deterministic automatic seeds and reapplied normalized anchors. No coordinates were persisted.';
    })
    .catch(showFailure);
});

updateOneButton.addEventListener('click', () => {
  void compareUpdate(0.01).catch(showFailure);
});

updateTenButton.addEventListener('click', () => {
  void compareUpdate(0.1).catch(showFailure);
});

recreateButton.addEventListener('click', () => {
  const start = performance.now();
  activeSession().destroy();
  installSession();
  record({
    operation: 'destroy-recreate',
    durationMs: Number((performance.now() - start).toFixed(3)),
  });
});

interactionsButton.addEventListener('click', () => {
  setBusy(interactionsButton, true);
  void runInteractionSample()
    .then(() => {
      status.textContent =
        'Interaction sample completed: hover reducer, selection, search center, and camera pan/zoom all ran without rebuilding the graph.';
    })
    .catch(showFailure)
    .finally(() => setBusy(interactionsButton, false));
});

bookmarkButton.addEventListener('click', () => {
  const viewport = activeSession().semanticViewport();
  status.textContent =
    viewport === undefined
      ? 'No visible canonical entity is available for a semantic bookmark.'
      : `Semantic bookmark captured stable entity ${viewport.anchorEntityId} at Sigma ratio ${viewport.ratio.toFixed(3)}. Raw camera coordinates were not retained.`;
});

spatialForm.addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    spatialRegistry = setFolderClusterAnchor(
      spatialRegistry,
      spatialFolderInput.value.trim(),
      { x: spatialXInput.valueAsNumber, y: spatialYInput.valueAsNumber },
    );
    const before = layoutRequests;
    void applySpatialDisplay('spatial-anchor-edit')
      .then(() => {
        status.textContent = `Applied a normalized synthetic folder anchor with ${layoutRequests - before} automatic layout requests.`;
      })
      .catch(showFailure);
  } catch (error: unknown) {
    showFailure(error);
  }
});

spatialResetFolderButton.addEventListener('click', () => {
  try {
    spatialRegistry = removeFolderClusterAnchor(
      spatialRegistry,
      spatialFolderInput.value.trim(),
    );
    void applySpatialDisplay('spatial-reset-folder')
      .then(() => {
        status.textContent = 'Reset the selected synthetic folder anchor.';
      })
      .catch(showFailure);
  } catch (error: unknown) {
    showFailure(error);
  }
});

spatialResetAllButton.addEventListener('click', () => {
  spatialRegistry = clearFolderClusterAnchors(spatialRegistry);
  void applySpatialDisplay('spatial-reset-all')
    .then(() => {
      status.textContent = 'Reset all synthetic folder anchors.';
    })
    .catch(showFailure);
});

spatialFolderInput.addEventListener('input', renderSpatialSummary);

searchInput.addEventListener('input', renderSearchResults);

installSession();
renderMetrics();

window.icarusGlobalRendererSpike = {
  snapshot,
  runInteractionSample,
  compareUpdate,
};
