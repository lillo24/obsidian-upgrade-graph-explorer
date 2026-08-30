import {
  createGlobalFixtureProjection,
  mutateFixtureProjection,
  type GlobalFixtureProfile,
} from './fixtures';
import { mapProjectionToGlobal, resetDeterministicPositions } from './mapping';
import { GlobalRendererSession } from './session';
import type {
  GlobalNodeAttributes,
  GlobalRendererInput,
  GlobalRendererMeasurement,
} from './types';
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
let session: GlobalRendererSession | undefined;
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
  const created = new GlobalRendererSession(container, input, {
    labels: labelsInput.checked,
    edgeEvents: edgeEventsInput.checked,
    onNodeSelected: selectionInspector,
  });
  void created.ready
    .then((ready) => {
      record({ operation: 'sigma-mount', durationMs: ready.mountMs });
      record({
        operation: 'first-after-render',
        durationMs: ready.firstRenderMs,
      });
      status.textContent = `Rendered ${numberFormatter.format(created.counts().nodes)} nodes and ${numberFormatter.format(created.counts().edges)} edges.`;
    })
    .catch(showFailure);
  return created;
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
  const replace = currentSession.update(changedInput, 'replace');
  record({
    operation: `${fraction * 100}%-full-replace`,
    durationMs: replace.durationMs,
  });
  currentSession.update(input, 'replace');
  const incremental = currentSession.update(changedInput, 'incremental');
  record({
    operation: `${fraction * 100}%-incremental`,
    durationMs: incremental.durationMs,
  });
  projection = changedProjection;
  input = changedInput;
  status.textContent = `${fraction * 100}% update: full replacement ${replace.durationMs.toFixed(1)} ms; incremental mutation ${incremental.durationMs.toFixed(1)} ms. Stable keys retained.`;
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
  };
}

profileSelect.addEventListener('change', () => {
  activeSession().destroy();
  profile = profileSelect.value as GlobalFixtureProfile;
  projection = createGlobalFixtureProjection(profile);
  input = mapProjectionToGlobal(projection);
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
  void currentSession
    .runLayout(iterations)
    .then((measurement) => {
      record(measurement);
      status.textContent = `Worker layout completed ${iterations} iterations in ${measurement.durationMs.toFixed(1)} ms; high UI RAF gap ${measurement.highRafGapMs?.toFixed(1) ?? 'unknown'} ms.`;
    })
    .catch(showFailure)
    .finally(() => setBusy(layoutButton, false));
});

resetButton.addEventListener('click', () => {
  input = resetDeterministicPositions(input);
  activeSession().resetPositions(input);
  status.textContent =
    'Restored deterministic stable-ID seed positions. No coordinates were persisted.';
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

searchInput.addEventListener('input', renderSearchResults);

installSession();
renderMetrics();

window.icarusGlobalRendererSpike = {
  snapshot,
  runInteractionSample,
  compareUpdate,
};
