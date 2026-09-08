import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';

import type {
  NetworkPhysicsLifecycleState,
  NetworkPhysicsPosition,
  NetworkPhysicsService,
  TemporaryNodeConstraintCommand,
} from '@icarus-graph-explorer/renderer-sigma/core';

import {
  PHYSICS1_LAB_FIXTURES,
  type Physics1LabFixture,
} from './physics1-fixtures';
import { createNetworkPhysicsWorkerService } from './workers/network-physics-worker-client';

const VIEW_BOX = { x: -80, y: -60, width: 160, height: 120 } as const;

function displayPosition(
  fixture: Physics1LabFixture,
  position: NetworkPhysicsPosition,
) {
  const translation = fixture.placeTranslationByNodeKey.get(position.key);
  return {
    x: position.x + (translation?.x ?? 0),
    y: position.y + (translation?.y ?? 0),
  };
}

function FixtureLab({ fixture }: { readonly fixture: Physics1LabFixture }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const positionsRef = useRef<readonly NetworkPhysicsPosition[]>(
    fixture.seed.nodes.map(({ key, x, y }) => ({ key, x, y })),
  );
  const dragRef = useRef<
    | { readonly pointerId: number; readonly nodeKey: string; sequence: number }
    | undefined
  >(undefined);
  const scriptedRun = useRef(0);
  const serviceRef = useRef<NetworkPhysicsService | undefined>(undefined);
  const serviceGeneration = useRef(0);
  const [lifecycle, setLifecycle] =
    useState<NetworkPhysicsLifecycleState>('sleeping');
  const [failure, setFailure] = useState<string>();

  const draw = useCallback(
    (positions: readonly NetworkPhysicsPosition[]) => {
      positionsRef.current = positions;
      const svg = svgRef.current;
      if (svg === null) return;
      const displayed = new Map(
        positions.map((position) => [
          position.key,
          displayPosition(fixture, position),
        ]),
      );
      svg
        .querySelectorAll<SVGCircleElement>('[data-node-key]')
        .forEach((node) => {
          const key = node.dataset.nodeKey;
          const point = key === undefined ? undefined : displayed.get(key);
          if (point === undefined) return;
          node.setAttribute('cx', String(point.x));
          node.setAttribute('cy', String(point.y));
        });
      svg
        .querySelectorAll<SVGLineElement>('[data-edge-key]')
        .forEach((edge) => {
          const source = displayed.get(edge.dataset.source ?? '');
          const target = displayed.get(edge.dataset.target ?? '');
          if (source === undefined || target === undefined) return;
          edge.setAttribute('x1', String(source.x));
          edge.setAttribute('y1', String(source.y));
          edge.setAttribute('x2', String(target.x));
          edge.setAttribute('y2', String(target.y));
        });
    },
    [fixture],
  );

  useEffect(() => {
    const generation = ++serviceGeneration.current;
    const service = createNetworkPhysicsWorkerService({
      onFrame: (frame) => {
        if (serviceGeneration.current === generation) draw(frame.positions);
      },
      onConstraint: (command: TemporaryNodeConstraintCommand) => {
        if (serviceGeneration.current !== generation) return;
        if (command.kind === 'end') return;
        draw(
          positionsRef.current.map((position) =>
            position.key === command.nodeKey
              ? { key: position.key, ...command.target }
              : position,
          ),
        );
      },
      onStateChange: (state) => {
        if (serviceGeneration.current === generation) setLifecycle(state);
      },
      onFailure: (value) => {
        if (serviceGeneration.current === generation) {
          setFailure(value.message);
        }
      },
    });
    serviceRef.current = service;
    service.initialize(fixture.seed);
    draw(positionsRef.current);
    return () => {
      scriptedRun.current += 1;
      if (serviceRef.current === service) serviceRef.current = undefined;
      queueMicrotask(() => service.dispose());
    };
  }, [draw, fixture]);

  const currentService = () => {
    const service = serviceRef.current;
    if (service === undefined) {
      setFailure('PHYSICS1 worker service is not ready.');
    }
    return service;
  };

  const graphPoint = useCallback(
    (event: Pick<PointerEvent, 'clientX' | 'clientY'>) => {
      const svg = svgRef.current;
      const matrix = svg?.getScreenCTM();
      if (svg === null || matrix === null || matrix === undefined) {
        throw new Error('PHYSICS1 lab SVG transform is unavailable.');
      }
      const point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      return point.matrixTransform(matrix.inverse());
    },
    [],
  );

  const dynamicTarget = useCallback(
    (nodeKey: string, point: { readonly x: number; readonly y: number }) => {
      const translation = fixture.placeTranslationByNodeKey.get(nodeKey);
      return {
        x: point.x - (translation?.x ?? 0),
        y: point.y - (translation?.y ?? 0),
      };
    },
    [fixture],
  );

  const begin = (event: ReactPointerEvent<SVGCircleElement>) => {
    if (dragRef.current !== undefined) return;
    const service = currentService();
    if (service === undefined) return;
    const nodeKey = event.currentTarget.dataset.nodeKey;
    if (nodeKey === undefined) return;
    const target = dynamicTarget(nodeKey, graphPoint(event.nativeEvent));
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, nodeKey, sequence: 0 };
    setFailure(undefined);
    service.begin({
      schemaVersion: 1,
      kind: 'begin',
      sessionGeneration: fixture.seed.sessionGeneration,
      simulationGeneration: fixture.seed.simulationGeneration,
      gestureId: `pointer:${event.pointerId}`,
      sequence: 0,
      nodeKey,
      target,
    });
  };

  const update = (event: ReactPointerEvent<SVGCircleElement>) => {
    const drag = dragRef.current;
    if (drag === undefined || drag.pointerId !== event.pointerId) return;
    const service = currentService();
    if (service === undefined) return;
    drag.sequence += 1;
    service.update({
      schemaVersion: 1,
      kind: 'update',
      sessionGeneration: fixture.seed.sessionGeneration,
      simulationGeneration: fixture.seed.simulationGeneration,
      gestureId: `pointer:${event.pointerId}`,
      sequence: drag.sequence,
      nodeKey: drag.nodeKey,
      target: dynamicTarget(drag.nodeKey, graphPoint(event.nativeEvent)),
    });
  };

  const end = (event: ReactPointerEvent<SVGCircleElement>) => {
    const drag = dragRef.current;
    if (drag === undefined || drag.pointerId !== event.pointerId) return;
    const service = currentService();
    if (service === undefined) return;
    drag.sequence += 1;
    dragRef.current = undefined;
    service.end({
      schemaVersion: 1,
      kind: 'end',
      sessionGeneration: fixture.seed.sessionGeneration,
      simulationGeneration: fixture.seed.simulationGeneration,
      gestureId: `pointer:${event.pointerId}`,
      sequence: drag.sequence,
      nodeKey: drag.nodeKey,
      reason: event.type === 'pointerup' ? 'released' : 'pointer-lost',
    });
  };

  const runScriptedDrag = async (
    reason: 'released' | 'cancelled' = 'released',
  ) => {
    const service = currentService();
    if (service === undefined) return;
    const run = ++scriptedRun.current;
    const command = {
      schemaVersion: 1 as const,
      sessionGeneration: fixture.seed.sessionGeneration,
      simulationGeneration: fixture.seed.simulationGeneration,
      gestureId: `script:${run}`,
      nodeKey: 'n0',
    };
    setFailure(undefined);
    service.begin({
      ...command,
      kind: 'begin',
      sequence: 0,
      target: { x: -48, y: -28 },
    });
    for (const [sequence, target] of [
      [1, { x: -18, y: -8 }],
      [2, { x: 18, y: 14 }],
      [3, { x: 46, y: 26 }],
    ] as const) {
      await new Promise((resolve) => window.setTimeout(resolve, 140));
      if (scriptedRun.current !== run) return;
      service.update({ ...command, kind: 'update', sequence, target });
    }
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    if (scriptedRun.current !== run) return;
    service.end({ ...command, kind: 'end', sequence: 4, reason });
  };

  const invalidateSimulation = () => {
    const service = currentService();
    if (service === undefined) return;
    scriptedRun.current += 1;
    dragRef.current = undefined;
    service.invalidate('topology-changed');
    service.initialize(fixture.seed);
    draw(
      fixture.seed.nodes.map(({ key, x, y }) => ({
        key,
        x,
        y,
      })),
    );
  };

  const initialByKey = new Map(
    fixture.seed.nodes.map((position) => [
      position.key,
      displayPosition(fixture, position),
    ]),
  );
  return (
    <section className="physics1-lab__fixture">
      <header>
        <div>
          <h2>{fixture.label}</h2>
          <p>{fixture.description}</p>
        </div>
        <div className="physics1-lab__state">
          <span data-physics-state={lifecycle}>{lifecycle}</span>
          <button
            disabled={lifecycle !== 'sleeping'}
            onClick={() => void runScriptedDrag()}
            type="button"
          >
            Run scripted drag
          </button>
          <button
            disabled={lifecycle !== 'sleeping'}
            onClick={() => void runScriptedDrag('cancelled')}
            type="button"
          >
            Run scripted cancel
          </button>
          <button onClick={invalidateSimulation} type="button">
            Invalidate simulation
          </button>
        </div>
      </header>
      {failure === undefined ? null : <p role="alert">{failure}</p>}
      <svg
        aria-label={`${fixture.label} continuous simulation`}
        className="physics1-lab__graph"
        ref={svgRef}
        viewBox={`${VIEW_BOX.x} ${VIEW_BOX.y} ${VIEW_BOX.width} ${VIEW_BOX.height}`}
      >
        <g className="physics1-lab__edges">
          {fixture.seed.edges.map((edge) => {
            const source = initialByKey.get(edge.source)!;
            const target = initialByKey.get(edge.target)!;
            return (
              <line
                data-edge-key={edge.key}
                data-source={edge.source}
                data-target={edge.target}
                key={edge.key}
                x1={source.x}
                x2={target.x}
                y1={source.y}
                y2={target.y}
              />
            );
          })}
        </g>
        <g className="physics1-lab__nodes">
          {fixture.seed.nodes.map((node) => {
            const point = initialByKey.get(node.key)!;
            return (
              <circle
                cx={point.x}
                cy={point.y}
                data-node-key={node.key}
                key={node.key}
                onPointerCancel={end}
                onPointerDown={begin}
                onPointerMove={update}
                onPointerUp={end}
                r={node.key === 'n0' ? 3.5 : 2}
              />
            );
          })}
        </g>
      </svg>
      <p className="physics1-lab__hint">
        Drag any node, run the scripted n0 gesture, cancel it, or invalidate the
        retained simulation. End events enter bounded cooling; sleeping means
        the worker has scheduled no further step.
      </p>
    </section>
  );
}

export function Physics1Lab() {
  const [fixtureId, setFixtureId] = useState(PHYSICS1_LAB_FIXTURES[0]!.id);
  const [revision, setRevision] = useState(0);
  const fixture = PHYSICS1_LAB_FIXTURES.find(({ id }) => id === fixtureId)!;
  return (
    <main className="physics1-lab">
      <header className="physics1-lab__header">
        <div>
          <p className="physics1-lab__eyebrow">Development-only evidence</p>
          <h1>PHYSICS1 continuous Network simulation</h1>
          <p>
            Real browser worker, public ForceAtlas2 calls, whole-graph reaction,
            hard moving target, release cooling, and zero scheduled work asleep.
          </p>
        </div>
        <div className="physics1-lab__controls">
          <label>
            Fixture
            <select
              onChange={(event) => {
                setFixtureId(event.target.value);
                setRevision(0);
              }}
              value={fixtureId}
            >
              {PHYSICS1_LAB_FIXTURES.map((value) => (
                <option key={value.id} value={value.id}>
                  {value.label}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => setRevision((value) => value + 1)}
            type="button"
          >
            Reset fixture
          </button>
        </div>
      </header>
      <FixtureLab fixture={fixture} key={`${fixture.id}:${revision}`} />
    </main>
  );
}
