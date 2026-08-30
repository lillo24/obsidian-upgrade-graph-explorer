import { readdir, stat } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateSyntheticWorkspace } from '@icarus-graph-explorer/diagnostics-obsidian';
import {
  buildGlobalGraph,
  createGlobalFixtureProjection,
  mapProjectionToGlobal,
  reconcileGlobalGraph,
  runForceAtlas2Synchronous,
  type GlobalFixtureProfile,
  type GlobalRendererInput,
} from '@icarus-graph-explorer/global-renderer-spike/core';
import { createStableIdentityCatalog } from '@icarus-graph-explorer/stable-identity';
import {
  createProjectionWorkspace,
  documentOnlyProjectionState,
  projectView,
  type ViewProjection,
} from '@icarus-graph-explorer/view-projection';

import {
  BENCHMARK_PROFILES,
  isBenchmarkProfile,
  type BenchmarkProfile,
} from './benchmark-config';
import { buildReportFromSources } from './pipeline';

interface BenchmarkOptions {
  readonly profile: BenchmarkProfile;
  readonly include25k: boolean;
}

interface Distribution {
  readonly valuesMs: readonly number[];
  readonly medianMs: number;
  readonly p95Ms: number;
  readonly maximumMs: number;
}

function selectedOptions(args: readonly string[]): BenchmarkOptions {
  const normalized = args[0] === '--' ? args.slice(1) : [...args];
  let profile: BenchmarkProfile = 'small';
  let include25k = false;
  for (let index = 0; index < normalized.length; index += 1) {
    const flag = normalized[index];
    if (flag === '--include-25k') {
      include25k = true;
      continue;
    }
    if (flag === '--profile') {
      const value = normalized[index + 1];
      if (value === undefined || !isBenchmarkProfile(value)) {
        throw new Error(
          `Unknown global renderer benchmark profile: ${value ?? 'missing'}.`,
        );
      }
      profile = value;
      index += 1;
      continue;
    }
    throw new Error(
      'Usage: pnpm benchmark:global-renderer -- --profile <smoke|small|medium|large> [--include-25k]',
    );
  }
  return { profile, include25k };
}

function distribution(values: readonly number[]): Distribution {
  if (values.length === 0)
    throw new Error('A timing distribution cannot be empty.');
  const sorted = [...values].sort((left, right) => left - right);
  const medianIndex = Math.floor((sorted.length - 1) / 2);
  const p95Index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return {
    valuesMs: values,
    medianMs: sorted[medianIndex]!,
    p95Ms: sorted[p95Index]!,
    maximumMs: sorted.at(-1)!,
  };
}

function measureRepeated(run: () => void, repeats: number): Distribution {
  run();
  const samples: number[] = [];
  for (let index = 0; index < repeats; index += 1) {
    const start = performance.now();
    run();
    samples.push(Number((performance.now() - start).toFixed(3)));
  }
  return distribution(samples);
}

function changedProjection(
  projection: ViewProjection,
  fraction: 0.01 | 0.1,
): ViewProjection {
  const count = Math.max(1, Math.floor(projection.nodes.length * fraction));
  return {
    ...projection,
    nodes: projection.nodes.map((node, index) =>
      index >= count || node.kind !== 'entity'
        ? node
        : {
            ...node,
            revealableDescendantCount: node.revealableDescendantCount + 1,
          },
    ),
  };
}

function updateEvidence(
  original: GlobalRendererInput,
  changed: GlobalRendererInput,
  repeats: number,
) {
  const incrementalSamples: number[] = [];
  for (let index = 0; index < repeats + 1; index += 1) {
    const graph = buildGlobalGraph(original);
    const start = performance.now();
    reconcileGlobalGraph(graph, changed);
    if (index > 0) {
      incrementalSamples.push(Number((performance.now() - start).toFixed(3)));
    }
  }
  return {
    fullReplacement: measureRepeated(() => {
      buildGlobalGraph(changed);
    }, repeats),
    incrementalMutation: distribution(incrementalSamples),
  };
}

function stressProfile(options: BenchmarkOptions): GlobalFixtureProfile {
  if (options.include25k) return 'stress-25000';
  switch (options.profile) {
    case 'smoke':
    case 'small':
      return 'stress-1000';
    case 'medium':
      return 'stress-5000';
    case 'large':
      return 'stress-10000';
  }
}

async function bundleEvidence() {
  const assetsDirectory = fileURLToPath(
    new URL('../../global-renderer-spike/dist/assets/', import.meta.url),
  );
  const files = await readdir(assetsDirectory);
  const assets = await Promise.all(
    files.sort().map(async (name) => ({
      kind: name.endsWith('.js')
        ? 'javascript'
        : name.endsWith('.css')
          ? 'css'
          : 'other',
      bytes: (await stat(join(assetsDirectory, name))).size,
    })),
  );
  return {
    javascriptBytes: assets
      .filter((asset) => asset.kind === 'javascript')
      .reduce((total, asset) => total + asset.bytes, 0),
    cssBytes: assets
      .filter((asset) => asset.kind === 'css')
      .reduce((total, asset) => total + asset.bytes, 0),
    chunkCount: assets.filter((asset) => asset.kind === 'javascript').length,
  };
}

async function main(): Promise<void> {
  const options = selectedOptions(process.argv.slice(2));
  const markdownDocuments = generateSyntheticWorkspace(
    BENCHMARK_PROFILES[options.profile],
  );
  const workspaceId = `synthetic-global-${options.profile}`;
  const report = buildReportFromSources({
    workspaceId,
    markdownDocuments,
    nonMarkdownPaths: [],
    discoveryReadMs: 0,
    identityCatalog: createStableIdentityCatalog(workspaceId),
  }).report;
  const projectionWorkspace = createProjectionWorkspace(report.snapshot);
  const projection = projectView(
    projectionWorkspace,
    documentOnlyProjectionState(),
  );
  const repeats = options.profile === 'large' ? 3 : 5;
  let mapped: GlobalRendererInput | undefined;
  const mapping = measureRepeated(() => {
    mapped = mapProjectionToGlobal(projection);
  }, repeats);
  if (mapped === undefined)
    throw new Error('Global mapping benchmark produced no input.');
  const productInput: GlobalRendererInput = mapped;
  const graphBuild = measureRepeated(() => {
    buildGlobalGraph(productInput);
  }, repeats);
  const onePercentInput = mapProjectionToGlobal(
    changedProjection(projection, 0.01),
  );
  const tenPercentInput = mapProjectionToGlobal(
    changedProjection(projection, 0.1),
  );

  const stressName = stressProfile(options);
  const stressProjection = createGlobalFixtureProjection(stressName);
  let stressInput: GlobalRendererInput | undefined;
  const stressMapping = measureRepeated(() => {
    stressInput = mapProjectionToGlobal(stressProjection);
  }, repeats);
  if (stressInput === undefined)
    throw new Error('Stress mapping produced no input.');
  const measuredStressInput: GlobalRendererInput = stressInput;
  const stressBuild = measureRepeated(() => {
    buildGlobalGraph(measuredStressInput);
  }, repeats);

  const layoutGraph = buildGlobalGraph(productInput);
  const layoutIterations =
    layoutGraph.order <= 1_000 ? 100 : layoutGraph.order <= 5_000 ? 20 : 0;
  let layout:
    | { readonly omitted: true; readonly reason: string }
    | {
        readonly omitted: false;
        readonly iterations: number;
        readonly barnesHut: boolean;
        readonly durationMs: number;
      };
  if (layoutIterations === 0) {
    layout = {
      omitted: true,
      reason: `Product projection has ${layoutGraph.order} nodes; fixed-iteration synchronous layout is intentionally capped at 5,000. Use the browser/Tauri worker harness.`,
    };
  } else {
    const start = performance.now();
    runForceAtlas2Synchronous(layoutGraph, layoutIterations);
    layout = {
      omitted: false,
      iterations: layoutIterations,
      barnesHut: layoutGraph.order >= 1_000,
      durationMs: Number((performance.now() - start).toFixed(3)),
    };
  }

  console.log(
    JSON.stringify(
      {
        schemaVersion: 1,
        candidate: {
          sigma: { version: '3.0.3', license: 'MIT', channel: 'stable-v3' },
          graphology: { version: '0.26.0', license: 'MIT' },
          forceAtlas2: { version: '0.10.1', license: 'MIT' },
        },
        profile: options.profile,
        buildMode: 'production',
        productProjection: {
          mode: 'KG6 documents-only',
          nodes: productInput.nodes.length,
          edges: productInput.edges.length,
          diagnosticTargets: projection.nodes.filter(
            (node) => node.kind === 'reference-target',
          ).length,
          mapping,
          graphologyBuild: graphBuild,
          updates: {
            onePercent: updateEvidence(productInput, onePercentInput, repeats),
            tenPercent: updateEvidence(productInput, tenPercentInput, repeats),
          },
        },
        stressProjection: {
          profile: stressName,
          nodes: measuredStressInput.nodes.length,
          edges: measuredStressInput.edges.length,
          mapping: stressMapping,
          graphologyBuild: stressBuild,
        },
        forceAtlas2: layout,
        bundle: await bundleEvidence(),
        rendererRuntime: {
          measuredBy: 'production browser/Tauri harness',
          api: 'window.icarusGlobalRendererSpike',
          requiredPhases: [
            'sigma-mount',
            'first-after-render',
            'camera-pan-zoom',
            'hover-reducer',
            'selection',
            'search-center',
            '1%-full-replace',
            '1%-incremental',
            '10%-full-replace',
            '10%-incremental',
            'edge-events-off',
            'edge-events-on',
            'destroy-recreate',
            'forceatlas2-worker',
          ],
        },
        privacy:
          'Synthetic aggregate-only evidence; no paths, names, content, workspace IDs, queries, or private output files.',
        note: 'Wall-clock values are local evidence and never CI thresholds.',
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Global renderer benchmark failed: ${message}`);
  process.exitCode = 1;
});
