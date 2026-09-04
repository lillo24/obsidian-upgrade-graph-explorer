import {
  buildEndpointFixture,
  CENTER_SPINE_FIXTURES,
  computeFocusSchematicComputedLayoutAttempt,
  computeFocusSchematicUniformLayoutAttempt,
  FOCUS_SCHEMATIC_SELECTED_LAYOUT_ALGORITHM_VERSION,
  measureFocusSchematicEndpointOrder,
  type EndpointFixtureSpec,
} from '@icarus-graph-explorer/focus-schematic-layout';

import { createLayoutInput } from './dimensions';

const heading = (
  index: number,
  parentId = 'Atlas',
): NonNullable<EndpointFixtureSpec['entities']>[number] => ({
  id: `Atlas-heading-${index}`,
  kind: 'section',
  documentId: 'Atlas',
  parentId,
  line: index * 2,
  title: `Heading ${index}`,
});

function stressSpec(count: 5 | 20 | 100, nested = false): EndpointFixtureSpec {
  const roots = Array.from({ length: count }, (_, index) => heading(index + 1));
  return {
    id: `CS${nested ? 700 : 600}${count}`,
    label: `${count}-branch${nested ? ' nested' : ''} center-spine profile`,
    authored: 'Synthetic center-spine benchmark.',
    expectation: 'Bounded deterministic layout evidence.',
    inspect: 'Performance profile only.',
    rootDocumentId: 'Atlas',
    documents: [{ id: 'Atlas' }, { id: 'Beacon' }],
    entities: nested
      ? roots.flatMap((root, index) => [
          root,
          {
            ...heading(count + index + 1, root.id),
            id: `${root.id}-child`,
            line: root.line + 1,
          },
        ])
      : roots,
    references: [{ sourceEntityId: 'Atlas', targetEntityId: 'Beacon' }],
    direction: 'outgoing',
    hops: 1,
  };
}

const profiles: readonly EndpointFixtureSpec[] = [
  ...CENTER_SPINE_FIXTURES,
  stressSpec(5),
  stressSpec(20),
  stressSpec(100),
  stressSpec(20, true),
];

for (const spec of profiles) {
  const fixture = buildEndpointFixture(spec);
  const input = createLayoutInput(fixture);
  const started = performance.now();
  const attempt = computeFocusSchematicComputedLayoutAttempt(input);
  const elapsedMs = performance.now() - started;
  const uniform = computeFocusSchematicUniformLayoutAttempt(input);
  if (attempt.status !== 'success')
    throw new Error(`${spec.id} failed: ${attempt.reason}`);
  if (uniform.status !== 'success')
    throw new Error(`${spec.id} uniform baseline failed: ${uniform.reason}`);
  const module = [...attempt.result.candidate.modules].sort(
    (left, right) =>
      attempt.result.candidate.nodes.filter(
        ({ moduleId }) => moduleId === right.moduleId,
      ).length -
        attempt.result.candidate.nodes.filter(
          ({ moduleId }) => moduleId === left.moduleId,
        ).length || left.moduleId.localeCompare(right.moduleId),
  )[0];
  if (module === undefined)
    throw new Error(`${spec.id} omitted its structured center module.`);
  const uniformModule = uniform.candidate.modules.find(
    ({ moduleId }) => moduleId === module.moduleId,
  );
  if (uniformModule === undefined)
    throw new Error(`${spec.id} uniform baseline omitted ${module.moduleId}.`);
  const uniformOrder = measureFocusSchematicEndpointOrder(
    attempt.result.modulePlan,
    attempt.result.endpointPlan,
    uniform.candidate,
  );
  console.log(
    JSON.stringify({
      fixture: spec.id,
      algorithmVersion: FOCUS_SCHEMATIC_SELECTED_LAYOUT_ALGORITHM_VERSION,
      dagreCallCount: attempt.timings.dagreCallCount,
      moduleWidth: module.width,
      moduleHeight: module.height,
      uniformBaselineWidth: uniformModule.width,
      uniformBaselineHeight: uniformModule.height,
      exactEndpointCrossings: attempt.result.quality.exactEndpointCrossingCount,
      adjacentRankInversions:
        attempt.result.quality.adjacentRankOrderInversionCount,
      uniformBaselineCrossings: uniformOrder.exactEndpointCrossingCount,
      uniformBaselineInversions: uniformOrder.adjacentRankOrderInversionCount,
      layoutMs: Number(elapsedMs.toFixed(3)),
    }),
  );
}
