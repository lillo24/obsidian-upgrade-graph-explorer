import dagre from '@dagrejs/dagre';
import {
  compareFocusSchematicLayouts,
  validateFocusSchematicLayoutCandidate,
  type FocusSchematicLayoutCandidate,
} from '@icarus-graph-explorer/focus-schematic';
import {
  computeFocusSchematicUniformLayoutAttempt as computeFocusSchematicLayoutAttempt,
  FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
} from '@icarus-graph-explorer/focus-schematic-layout';

import { createLayoutInput } from './dimensions';
import { buildFixture, STABILITY_PAIRS } from './fixtures';

function macroGraph(
  attempt: Extract<
    ReturnType<typeof computeFocusSchematicLayoutAttempt>,
    { status: 'success' }
  >,
) {
  const graph = new dagre.graphlib.Graph({ multigraph: true });
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: 'LR',
    ranker: FOCUS_SCHEMATIC_LAYOUT_SETTINGS.ranker,
    nodesep: FOCUS_SCHEMATIC_LAYOUT_SETTINGS.macroNodeSeparation,
    ranksep: FOCUS_SCHEMATIC_LAYOUT_SETTINGS.macroRankSeparation,
  });
  for (const module of attempt.candidate.modules)
    graph.setNode(module.moduleId, {
      width: module.width,
      height: module.height,
    });
  for (const item of attempt.plan.modules) {
    if (item.parentModuleId === null || item.side === 'center') continue;
    const source = item.side === 'left' ? item.moduleId : item.parentModuleId;
    const target = item.side === 'left' ? item.parentModuleId : item.moduleId;
    graph.setEdge(source, target, { minlen: 1, weight: 10 }, item.moduleId);
  }
  return graph;
}

function mutateMacroGraph(
  graph: ReturnType<typeof macroGraph>,
  attempt: Extract<
    ReturnType<typeof computeFocusSchematicLayoutAttempt>,
    { status: 'success' }
  >,
) {
  for (const edge of graph.edges()) graph.removeEdge(edge);
  const afterIds = new Set(
    attempt.candidate.modules.map(({ moduleId }) => moduleId),
  );
  for (const nodeId of graph.nodes())
    if (!afterIds.has(nodeId)) graph.removeNode(nodeId);
  for (const module of attempt.candidate.modules)
    graph.setNode(module.moduleId, {
      width: module.width,
      height: module.height,
    });
  for (const item of attempt.plan.modules) {
    if (item.parentModuleId === null || item.side === 'center') continue;
    const source = item.side === 'left' ? item.moduleId : item.parentModuleId;
    const target = item.side === 'left' ? item.parentModuleId : item.moduleId;
    graph.setEdge(source, target, { minlen: 1, weight: 10 }, item.moduleId);
  }
}

function candidateFromMacro(
  graph: ReturnType<typeof macroGraph>,
  cold: Extract<
    ReturnType<typeof computeFocusSchematicLayoutAttempt>,
    { status: 'success' }
  >,
): FocusSchematicLayoutCandidate {
  const root = graph.node(cold.candidate.rootModuleId) as {
    x: number;
    y: number;
  };
  const coldModuleById = new Map(
    cold.candidate.modules.map((item) => [item.moduleId, item]),
  );
  const modules = cold.candidate.modules.map((module) => {
    const geometry = graph.node(module.moduleId) as { x: number; y: number };
    return {
      ...module,
      x: geometry.x - root.x - module.width / 2,
      y: geometry.y - root.y - module.height / 2,
    };
  });
  const dynamicById = new Map(modules.map((item) => [item.moduleId, item]));
  const nodes = cold.candidate.nodes.map((node) => {
    const oldOwner = coldModuleById.get(node.moduleId)!;
    const newOwner = dynamicById.get(node.moduleId)!;
    return {
      ...node,
      x: newOwner.x + (node.x - oldOwner.x),
      y: newOwner.y + (node.y - oldOwner.y),
    };
  });
  return { ...cold.candidate, modules, nodes };
}

export function dynamicExperiment() {
  return STABILITY_PAIRS.map((pair) => {
    const beforeFixture = buildFixture(pair.before);
    const afterFixture = buildFixture(pair.after);
    const before = computeFocusSchematicLayoutAttempt(
      createLayoutInput(beforeFixture),
    );
    const after = computeFocusSchematicLayoutAttempt(
      createLayoutInput(afterFixture),
    );
    if (before.status !== 'success' || after.status !== 'success')
      return {
        pairId: pair.id,
        status: 'failure' as const,
        reason: `Cold prerequisite failed: ${before.status}/${after.status}.`,
      };
    const graph = macroGraph(before);
    dagre.layout(graph, { useDynamic: false });
    mutateMacroGraph(graph, after);
    dagre.layout(graph, { useDynamic: true });
    const dynamicCandidate = candidateFromMacro(graph, after);
    const validation = validateFocusSchematicLayoutCandidate(
      afterFixture.model,
      dynamicCandidate,
    );
    const firstPositions = JSON.stringify(
      graph
        .nodes()
        .sort()
        .map((id) => ({ id, ...graph.node(id) })),
    );
    dagre.layout(graph, { useDynamic: true });
    const secondPositions = JSON.stringify(
      graph
        .nodes()
        .sort()
        .map((id) => ({ id, ...graph.node(id) })),
    );
    const afterIds = [...afterFixture.model.modules.map(({ id }) => id)].sort();
    return {
      pairId: pair.id,
      status: 'success' as const,
      candidateValid: validation.valid,
      staleNodesRemoved:
        JSON.stringify(graph.nodes().sort()) === JSON.stringify(afterIds),
      unchangedRerunDeterministic: firstPositions === secondPositions,
      stability: compareFocusSchematicLayouts({
        beforeModel: beforeFixture.model,
        beforeLayout: before.candidate,
        afterModel: afterFixture.model,
        afterLayout: dynamicCandidate,
      }),
    };
  });
}
