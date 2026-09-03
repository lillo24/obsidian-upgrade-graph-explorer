import { mkdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

import {
  computeLocalLayout,
  createLocalLayoutRequest,
} from '@icarus-graph-explorer/renderer-sigma/core';

import { focusSpacingFixtures } from './focus-spacing-fixtures';
import {
  candidateRatios,
  geometryMetrics,
  maximumRelativeGeometryError,
  maximumScreenDelta,
  percentile,
  PRIMARY_VIEWPORT,
  sceneFromLayout,
  screenMetrics,
  screenPositions,
  SMALL_VIEWPORT,
  topologyMetrics,
  uniformlyScaleScene,
  type CandidateRatios,
  type Dimensions,
  type SpacingScene,
} from './focus-spacing-metrics';

interface CliOptions {
  readonly outputDirectory: string;
}

const BOUND_FAMILIES = {
  wide: [0.5, 1.5],
  moderate: [0.6, 1.4],
  conservative: [0.7, 1.3],
} as const satisfies Readonly<Record<string, readonly [number, number]>>;

function options(args: readonly string[]): CliOptions {
  const values = args[0] === '--' ? args.slice(1) : [...args];
  let outputDirectory = 'output/spacing1a';
  for (let index = 0; index < values.length; index += 2) {
    const flag = values[index];
    const value = values[index + 1];
    if (flag === undefined || value === undefined) {
      throw new Error('Every focus-spacing analysis flag requires a value.');
    }
    if (flag !== '--output-dir') {
      throw new Error(`Unknown focus-spacing analysis flag: ${flag}.`);
    }
    outputDirectory = value;
  }
  const caller = process.env.INIT_CWD ?? process.cwd();
  return {
    outputDirectory: isAbsolute(outputDirectory)
      ? outputDirectory
      : resolve(caller, outputDirectory),
  };
}

function iterations(nodeCount: number): number {
  return nodeCount <= 100 ? 160 : nodeCount <= 500 ? 100 : 60;
}

function layoutScene(
  fixture: ReturnType<typeof focusSpacingFixtures>[number],
  requestId: number,
): SpacingScene {
  const request = createLocalLayoutRequest(
    fixture.input,
    iterations(fixture.input.nodes.length),
  );
  const result = computeLocalLayout({ ...request, requestId }, () => 0);
  return sceneFromLayout(request, result.positions);
}

function candidateScreens(scene: SpacingScene, ratios: CandidateRatios) {
  const measure = (ratio: number) => ({
    ratio,
    primary: screenMetrics(scene, ratio, PRIMARY_VIEWPORT),
    small: screenMetrics(scene, ratio, SMALL_VIEWPORT),
    maximumRelativeGeometryError: maximumRelativeGeometryError(scene, ratio),
  });
  return {
    B0: measure(ratios.B0),
    B1: measure(ratios.B1),
    B2: measure(ratios.B2),
    B3: measure(ratios.B3),
    B4: measure(ratios.B4),
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function svgPanel(
  label: string,
  scene: SpacingScene,
  ratio: number,
  viewport: Dimensions,
): string {
  const points = screenPositions(scene, ratio, viewport, 16);
  const lines = scene.edges
    .map((edge) => {
      const source = points.get(edge.source)!;
      const target = points.get(edge.target)!;
      const color = edge.kind === 'hierarchy' ? '#708090' : '#93a9b1';
      return `<line x1="${source.x.toFixed(2)}" y1="${source.y.toFixed(2)}" x2="${target.x.toFixed(2)}" y2="${target.y.toFixed(2)}" stroke="${color}" stroke-width="1.1" />`;
    })
    .join('');
  const circles = scene.nodes
    .map((node) => {
      const point = points.get(node.key)!;
      const fill =
        node.key === scene.rootKey
          ? '#e38c4c'
          : node.kind === 'section'
            ? '#8a74c2'
            : node.kind === 'block'
              ? '#839196'
              : node.kind === 'diagnostic'
                ? '#cf655a'
                : '#2d7f96';
      const radius = Math.max(2.2, node.size / Math.sqrt(ratio));
      return `<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="${radius.toFixed(2)}" fill="${fill}" stroke="#eef6f7" stroke-width="1" />`;
    })
    .join('');
  return `<figure><figcaption>${escapeHtml(label)} · camera ${ratio.toFixed(2)}</figcaption><svg viewBox="0 0 ${viewport.width} ${viewport.height}" role="img" aria-label="${escapeHtml(label)}">${lines}${circles}</svg></figure>`;
}

function comparisonHtml(
  rows: readonly {
    readonly id: string;
    readonly description: string;
    readonly scene: SpacingScene;
    readonly bounds: Readonly<Record<keyof typeof BOUND_FAMILIES, number>>;
  }[],
): string {
  const selected = new Set([
    'three-star',
    'five-mixed-isolate',
    'ten-mixed',
    'fifty-mixed',
    'root-weak-and-isolated',
  ]);
  const panelViewport = { width: 420, height: 270 };
  const sections = rows
    .filter(({ id }) => selected.has(id))
    .map(
      ({ id, description, scene, bounds }) =>
        `<section><h2>${escapeHtml(id)}</h2><p>${escapeHtml(description)}</p><div class="pair">${svgPanel('B0 current Fit', scene, 1, panelViewport)}${svgPanel('B4 wide 0.5–1.5', scene, bounds.wide, panelViewport)}${svgPanel('B4 moderate 0.6–1.4', scene, bounds.moderate, panelViewport)}${svgPanel('B4 conservative 0.7–1.3', scene, bounds.conservative, panelViewport)}</div></section>`,
    )
    .join('\n');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>SPACING1A Focus density comparison</title>
<style>body{margin:0 auto;max-width:1040px;padding:32px;font:15px/1.5 system-ui,sans-serif;color:#203238;background:#f5f7f7}h1{margin-bottom:4px}h2{margin-bottom:0}section{margin:28px 0;padding:20px;background:#fff;border:1px solid #dce3e5;border-radius:12px}.pair{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px}figure{margin:0}figcaption{font-weight:650;margin-bottom:7px}svg{display:block;width:100%;height:auto;background:#14242b;border-radius:8px}</style></head>
<body><h1>SPACING1A Focus + Network density spike</h1><p>Deterministic synthetic evidence. B4 changes only the simulated camera ratio; ForceAtlas2 coordinates and relative geometry are identical.</p><p><strong>Legend:</strong> <span style="color:#e38c4c">● root</span> · <span style="color:#2d7f96">● document</span> · <span style="color:#8a74c2">● section</span> · <span style="color:#839196">● block</span> · <span style="color:#cf655a">● diagnostic</span>; gray edges are hierarchy and blue-gray edges are references.</p>${sections}</body></html>\n`;
}

function median(values: readonly number[]): number {
  return Number(percentile(values, 0.5).toFixed(4));
}

function main(): void {
  const cli = options(process.argv.slice(2));
  const visualRows: Array<{
    id: string;
    description: string;
    scene: SpacingScene;
    bounds: Record<keyof typeof BOUND_FAMILIES, number>;
  }> = [];
  const fixtures = focusSpacingFixtures().map((fixture, index) => {
    const scene = layoutScene(fixture, index + 1);
    const topology = topologyMetrics(scene);
    const graph = geometryMetrics(scene);
    const baseline = screenMetrics(scene, 1, PRIMARY_VIEWPORT);
    const ratios = candidateRatios(baseline, topology.nodes);
    const boundSensitivity = Object.fromEntries(
      Object.entries(BOUND_FAMILIES).map(([name, bounds]) => [
        name,
        candidateRatios(baseline, topology.nodes, bounds).B4,
      ]),
    ) as Record<keyof typeof BOUND_FAMILIES, number>;
    visualRows.push({
      id: fixture.id,
      description: fixture.description,
      scene,
      bounds: boundSensitivity,
    });
    return {
      id: fixture.id,
      description: fixture.description,
      layoutIterations: iterations(topology.nodes),
      topology,
      graph,
      baseline: {
        primary: baseline,
        small: screenMetrics(scene, 1, SMALL_VIEWPORT),
      },
      candidates: candidateScreens(scene, ratios),
      boundSensitivity,
    };
  });
  const scaleScene = visualRows.find(({ id }) => id === 'five-star')?.scene;
  if (scaleScene === undefined)
    throw new Error('Scale experiment fixture is missing.');
  const halfScale = uniformlyScaleScene(scaleScene, 0.5);
  const scaleExperiment = {
    coordinateFactor: 0.5,
    mountAndResetFitMaximumDeltaPx: maximumScreenDelta(
      scaleScene,
      halfScale,
      1,
    ),
    explicitCameraMaximumDeltaPx: maximumScreenDelta(
      scaleScene,
      halfScale,
      1.75,
    ),
    savedSemanticViewportMaximumDeltaPx: maximumScreenDelta(
      scaleScene,
      halfScale,
      0.82,
    ),
    fitCameraState: { x: 0.5, y: 0.5, ratio: 1, angle: 0 },
    nodeRadiusAtFitPx: screenMetrics(scaleScene, 1).medianNodeRadiusPx,
    halfScaleNodeRadiusAtFitPx: screenMetrics(halfScale, 1).medianNodeRadiusPx,
    conclusion:
      'Sigma autoRescale normalizes both extents to the same framed coordinates, so uniform raw-coordinate scaling changes none of these views or node sizes.',
  };
  const hybrid = fixtures.map(({ candidates }) => candidates.B4.primary);
  const result = {
    schemaVersion: 1,
    evidence: 'deterministic-synthetic-only',
    installedPipeline: {
      sigma: '3.0.3',
      graphologyForceAtlas2: '0.10.1',
      sigmaAutoRescale: true,
      sigmaAutoCenter: true,
      itemSizesReference: 'screen',
      zoomToSizeRatioFunction: 'sqrt(cameraRatio)',
      stagePadding: 24,
      forceAtlas2ProductionSettings: {
        scalingRatio: 1.35,
        gravity: 0.08,
        strongGravityMode: true,
        edgeWeightInfluence: 1,
        hierarchyWeight: 6,
        referenceWeight: 1,
      },
    },
    scaleExperiment,
    fixtures,
    aggregateHybrid: {
      medianCameraRatio: median(
        fixtures.map(({ candidates }) => candidates.B4.ratio),
      ),
      baselineMedianNearestNeighborPx: median(
        fixtures.map(
          ({ baseline }) => baseline.primary.medianNearestNeighborPx,
        ),
      ),
      hybridMedianNearestNeighborPx: median(
        hybrid.map(({ medianNearestNeighborPx }) => medianNearestNeighborPx),
      ),
      baselineMedianConnectedEdgePx: median(
        fixtures.map(({ baseline }) => baseline.primary.medianConnectedEdgePx),
      ),
      hybridMedianConnectedEdgePx: median(
        hybrid.map(({ medianConnectedEdgePx }) => medianConnectedEdgePx),
      ),
      maximumRelativeGeometryError: Math.max(
        ...fixtures.map(
          ({ candidates }) => candidates.B4.maximumRelativeGeometryError,
        ),
      ),
    },
    decision: {
      sufficientDirection: 'B-camera',
      preferredSignal:
        'bounded hybrid led by median nearest-neighbor screen distance, guarded by connected-edge and p90 root-radius signals',
      preferredInvestigativeBounds: [0.7, 1.4],
      coordinateNormalizationRejected:
        'Uniform coordinate scaling is canceled by Sigma autoRescale unless the product also changes autoRescale or supplies a stable custom bounding box.',
      adaptiveForceAtlas2Verdict:
        'Not justified by SPACING1A evidence; reserve option C for a later spike only if visual QA shows topology-specific overlap or geometry defects that a bounded camera policy cannot solve.',
      productionChanged: false,
    },
  };
  mkdirSync(cli.outputDirectory, { recursive: true });
  const jsonPath = resolve(cli.outputDirectory, 'focus-spacing-analysis.json');
  const htmlPath = resolve(
    cli.outputDirectory,
    'focus-spacing-comparison.html',
  );
  writeFileSync(jsonPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  writeFileSync(htmlPath, comparisonHtml(visualRows), 'utf8');
  process.stdout.write(
    `${JSON.stringify(
      {
        fixtures: fixtures.length,
        decision: result.decision.sufficientDirection,
        maximumRelativeGeometryError:
          result.aggregateHybrid.maximumRelativeGeometryError,
        jsonPath,
        htmlPath,
      },
      null,
      2,
    )}\n`,
  );
}

try {
  main();
} catch (error: unknown) {
  console.error(
    `Focus-spacing analysis failed: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
}
