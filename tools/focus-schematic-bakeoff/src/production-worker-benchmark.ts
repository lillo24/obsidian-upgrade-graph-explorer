import { Worker } from 'node:worker_threads';

import {
  ENDPOINT_FIXTURES,
  FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
  buildEndpointFixture,
  validateFocusSchematicLayoutWorkerResponse,
  type EndpointFixtureSpec,
  type FocusSchematicLayoutInput,
  type FocusSchematicLayoutWorkerRequest,
  type FocusSchematicLayoutWorkerResponse,
} from '@icarus-graph-explorer/focus-schematic-layout';

import { createLayoutInput } from './dimensions';

type Profile = 'small' | 'medium' | 'hub' | 'supersession';

function profileFromArgs(): Profile {
  const index = process.argv.indexOf('--profile');
  const value = index < 0 ? 'small' : process.argv[index + 1];
  if (!['small', 'medium', 'hub', 'supersession'].includes(value ?? ''))
    throw new Error('Expected --profile small|medium|hub|supersession.');
  return value as Profile;
}

function hubSpec(moduleCount: number): EndpointFixtureSpec {
  const leaves = Array.from(
    { length: moduleCount - 1 },
    (_, index) => `Production-${String(index + 1).padStart(3, '0')}`,
  );
  return {
    id: `EP${2000 + moduleCount}`,
    label: `${moduleCount}-module production worker hub`,
    authored: 'Synthetic source-neutral production worker profile.',
    expectation: 'Dedicated protocol and structured-clone transport complete.',
    inspect: 'Runtime evidence only.',
    rootDocumentId: 'Root',
    documents: [{ id: 'Root' }, ...leaves.map((id) => ({ id }))],
    references: leaves.map((targetEntityId) => ({
      sourceEntityId: 'Root',
      targetEntityId,
    })),
    direction: 'outgoing',
    hops: 1,
  };
}

function inputFor(
  profile: Exclude<Profile, 'supersession'>,
): FocusSchematicLayoutInput {
  const fixture =
    profile === 'small'
      ? buildEndpointFixture(ENDPOINT_FIXTURES.find(({ id }) => id === 'EP12')!)
      : profile === 'medium'
        ? buildEndpointFixture(
            ENDPOINT_FIXTURES.find(({ id }) => id === 'EP22')!,
          )
        : buildEndpointFixture(hubSpec(120));
  return createLayoutInput(fixture);
}

function request(input: FocusSchematicLayoutInput, requestId = 1) {
  return {
    protocolVersion: FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
    requestId,
    kind: 'layout',
    input,
  } satisfies FocusSchematicLayoutWorkerRequest;
}

async function runWorker(item: FocusSchematicLayoutWorkerRequest): Promise<{
  readonly response: FocusSchematicLayoutWorkerResponse;
  readonly roundTripMs: number;
}> {
  const startedAt = performance.now();
  return await new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('./production-worker-thread.ts', import.meta.url),
      { workerData: item, execArgv: process.execArgv },
    );
    worker.once('message', (value: unknown) => {
      try {
        resolve({
          response: validateFocusSchematicLayoutWorkerResponse(
            value,
            item.requestId,
            item.input,
          ),
          roundTripMs: performance.now() - startedAt,
        });
      } catch (error: unknown) {
        reject(error);
      } finally {
        void worker.terminate();
      }
    });
    worker.once('error', reject);
  });
}

async function main() {
  const profile = profileFromArgs();
  if (profile === 'supersession') {
    const firstRequest = request(inputFor('hub'), 1);
    const first = new Worker(
      new URL('./production-worker-thread.ts', import.meta.url),
      { workerData: firstRequest, execArgv: process.execArgv },
    );
    const startedAt = performance.now();
    await first.terminate();
    const second = await runWorker(request(inputFor('small'), 2));
    if (second.response.kind !== 'success')
      throw new Error(second.response.message);
    console.log(
      JSON.stringify(
        {
          profile,
          supersededRequestTerminated: true,
          adoptedRequestId: second.response.requestId,
          computeMs: second.response.computeMs,
          roundTripMs: second.roundTripMs,
          totalMs: performance.now() - startedAt,
        },
        null,
        2,
      ),
    );
    return;
  }
  const input = inputFor(profile);
  const result = await runWorker(request(input));
  if (result.response.kind !== 'success')
    throw new Error(result.response.message);
  console.log(
    JSON.stringify(
      {
        profile,
        modules: input.model.modules.length,
        projectedNodes: input.projection.nodes.length,
        projectedEdges: input.projection.edges.length,
        computeMs: result.response.computeMs,
        roundTripMs: result.roundTripMs,
        mainThreadGapProbe: 'covered by the browser client runtime metric',
        phaseTimings: result.response.timings,
      },
      null,
      2,
    ),
  );
}

await main();
