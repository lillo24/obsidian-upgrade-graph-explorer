import { describe, expect, it } from 'vitest';

import {
  argumentStaleness,
  createArgument,
  createAxiom,
  createEmptyArgumentLibrary,
  editArgument,
  editAxiom,
  reassessArgumentPremises,
} from './library';
import { deterministicRuntime } from './test-fixture';
import type { Argument, ArgumentLibrary, ArgumentRuntime } from './types';

function argument(library: ArgumentLibrary, id: string): Argument {
  return library.arguments.find((candidate) => candidate.id === id)!;
}

function conclusionChain(): {
  readonly library: ArgumentLibrary;
  readonly runtime: ArgumentRuntime;
} {
  const runtime = deterministicRuntime('transitive-staleness');
  let library = createEmptyArgumentLibrary(runtime, 'LIB-TRANSITIVE');
  library = createAxiom(
    library,
    {
      id: 'AX-X',
      title: 'Root support',
      statement: 'The root support is recorded.',
    },
    runtime,
  );
  library = createArgument(
    library,
    {
      id: 'A1',
      title: 'First inference',
      premises: [
        {
          id: 'A1-P1',
          kind: 'axiom',
          axiomId: 'AX-X',
          reliedOnRevision: 1,
        },
      ],
      conclusion: 'The first conclusion follows.',
    },
    runtime,
  );
  library = createArgument(
    library,
    {
      id: 'A2',
      title: 'Second inference',
      premises: [
        {
          id: 'A2-P1',
          kind: 'argument-conclusion',
          argumentId: 'A1',
          reliedOnRevision: 1,
        },
      ],
      conclusion: 'The second conclusion follows.',
    },
    runtime,
  );
  library = createArgument(
    library,
    {
      id: 'A3',
      title: 'Third inference',
      premises: [
        {
          id: 'A3-P1',
          kind: 'argument-conclusion',
          argumentId: 'A2',
          reliedOnRevision: 1,
        },
      ],
      conclusion: 'The third conclusion follows.',
    },
    runtime,
  );
  return { library, runtime };
}

describe('transitive Argument dependency staleness', () => {
  it('propagates a changed Axiom through a multi-hop conclusion chain without mutating Arguments', () => {
    const fixture = conclusionChain();
    const originalRevisions = fixture.library.arguments.map(
      ({ id, revision }) => [id, revision] as const,
    );
    const library = editAxiom(
      fixture.library,
      'AX-X',
      { statement: 'The root support was explicitly revised.' },
      fixture.runtime,
    );

    const a1 = argumentStaleness(library, argument(library, 'A1'));
    const a2 = argumentStaleness(library, argument(library, 'A2'));
    const a3 = argumentStaleness(library, argument(library, 'A3'));

    expect(a1.premiseStaleness[0]).toMatchObject({
      premiseId: 'A1-P1',
      stale: true,
      direct: true,
      inherited: false,
    });
    expect(a2.premiseStaleness[0]).toMatchObject({
      premiseId: 'A2-P1',
      stale: true,
      direct: false,
      inherited: true,
    });
    expect(a3.premiseStaleness[0]).toMatchObject({
      premiseId: 'A3-P1',
      stale: true,
      direct: false,
      inherited: true,
    });
    expect(a3.premiseStaleness[0]!.causes).toEqual([
      {
        kind: 'inherited',
        root: {
          kind: 'revision-mismatch',
          recordKind: 'axiom',
          recordId: 'AX-X',
          reliedOnRevision: 1,
          currentRevision: 2,
        },
        path: [
          {
            argumentId: 'A3',
            premiseId: 'A3-P1',
            kind: 'argument-conclusion',
            sourceArgumentId: 'A2',
          },
          {
            argumentId: 'A2',
            premiseId: 'A2-P1',
            kind: 'argument-conclusion',
            sourceArgumentId: 'A1',
          },
          {
            argumentId: 'A1',
            premiseId: 'A1-P1',
            kind: 'axiom',
            axiomId: 'AX-X',
          },
        ],
      },
    ]);
    expect(
      library.arguments.map(({ id, revision }) => [id, revision] as const),
    ).toEqual(originalRevisions);
  });

  it('propagates a reused premise only when that specific source premise is stale', () => {
    const runtime = deterministicRuntime('specific-premise-staleness');
    let library = createEmptyArgumentLibrary(runtime, 'LIB-SPECIFIC');
    for (const id of ['AX-X', 'AX-Y']) {
      library = createAxiom(
        library,
        { id, title: id, statement: `${id} support.` },
        runtime,
      );
    }
    library = createArgument(
      library,
      {
        id: 'A1',
        title: 'Two-source inference',
        premises: [
          {
            id: 'A1-P1',
            kind: 'axiom',
            axiomId: 'AX-X',
            reliedOnRevision: 1,
          },
          {
            id: 'A1-P2',
            kind: 'axiom',
            axiomId: 'AX-Y',
            reliedOnRevision: 1,
          },
        ],
        conclusion: 'Both sources are considered.',
      },
      runtime,
    );
    library = createArgument(
      library,
      {
        id: 'A3',
        title: 'Whole-conclusion reuse',
        premises: [
          {
            id: 'A3-P1',
            kind: 'argument-conclusion',
            argumentId: 'A1',
            reliedOnRevision: 1,
          },
        ],
        conclusion: 'The whole conclusion reuses both supports.',
      },
      runtime,
    );
    library = createArgument(
      library,
      {
        id: 'A2',
        title: 'Specific reuse',
        premises: [
          {
            id: 'A2-P1',
            kind: 'argument-premise',
            argumentId: 'A1',
            premiseId: 'A1-P1',
            reliedOnRevision: 1,
          },
        ],
        conclusion: 'Only the first source premise is reused.',
      },
      runtime,
    );

    library = editAxiom(
      library,
      'AX-Y',
      { statement: 'AX-Y changed.' },
      runtime,
    );
    expect(
      argumentStaleness(library, argument(library, 'A1')).premiseIds,
    ).toEqual(['A1-P2']);
    expect(argumentStaleness(library, argument(library, 'A2'))).toMatchObject({
      stale: false,
      premiseIds: [],
    });

    library = editAxiom(
      library,
      'AX-X',
      { statement: 'AX-X changed.' },
      runtime,
    );
    expect(
      argumentStaleness(library, argument(library, 'A2')).premiseStaleness[0],
    ).toMatchObject({
      stale: true,
      direct: false,
      inherited: true,
      causes: [
        expect.objectContaining({
          root: expect.objectContaining({ recordId: 'AX-X' }),
        }),
      ],
    });
    expect(
      argumentStaleness(
        library,
        argument(library, 'A3'),
      ).premiseStaleness[0]!.causes.map(({ root }) =>
        root.kind === 'revision-mismatch' ? root.recordId : root.kind,
      ),
    ).toEqual(['AX-X', 'AX-Y']);
  });

  it('does not propagate relation or supersession staleness into inference dependencies', () => {
    const runtime = deterministicRuntime('non-inference-staleness');
    let library = createEmptyArgumentLibrary(runtime, 'LIB-NON-INFERENCE');
    library = createAxiom(
      library,
      { id: 'AX-X', title: 'Support', statement: 'Stable support.' },
      runtime,
    );
    for (const id of ['RELATION-TARGET', 'HISTORY']) {
      library = createArgument(
        library,
        {
          id,
          title: id,
          premises: [],
          conclusion: `${id} conclusion.`,
        },
        runtime,
      );
    }
    library = createArgument(
      library,
      {
        id: 'A1',
        title: 'Source inference',
        premises: [
          {
            id: 'A1-P1',
            kind: 'axiom',
            axiomId: 'AX-X',
            reliedOnRevision: 1,
          },
        ],
        conclusion: 'A stable source conclusion.',
        supersedesArgumentId: 'HISTORY',
        relations: [
          {
            id: 'A1-REL',
            kind: 'attack',
            targetArgumentId: 'RELATION-TARGET',
            targetPart: { kind: 'argument' },
            reliedOnRevision: 1,
          },
        ],
      },
      runtime,
    );
    library = createArgument(
      library,
      {
        id: 'A2',
        title: 'Downstream inference',
        premises: [
          {
            id: 'A2-P1',
            kind: 'argument-conclusion',
            argumentId: 'A1',
            reliedOnRevision: 1,
          },
        ],
        conclusion: 'A downstream conclusion.',
      },
      runtime,
    );
    library = editArgument(
      library,
      'RELATION-TARGET',
      { conclusion: 'Changed relation target.' },
      runtime,
    );
    library = editArgument(
      library,
      'HISTORY',
      { conclusion: 'Changed historical predecessor.' },
      runtime,
    );

    expect(argumentStaleness(library, argument(library, 'A1'))).toMatchObject({
      stale: true,
      premiseIds: [],
      relationIds: ['A1-REL'],
    });
    expect(argumentStaleness(library, argument(library, 'A2'))).toMatchObject({
      stale: false,
      premiseIds: [],
      relationIds: [],
    });
  });

  it('preserves direct and inherited causes on the same premise', () => {
    const fixture = conclusionChain();
    let library = editAxiom(
      fixture.library,
      'AX-X',
      { statement: 'Changed root support.' },
      fixture.runtime,
    );
    library = editArgument(
      library,
      'A1',
      { reasoning: 'The first inference was also edited.' },
      fixture.runtime,
    );

    const result = argumentStaleness(library, argument(library, 'A2'))
      .premiseStaleness[0]!;
    expect(result).toMatchObject({
      stale: true,
      direct: true,
      inherited: true,
    });
    expect(result.causes.map(({ kind }) => kind)).toEqual([
      'direct',
      'inherited',
    ]);
    expect(result.causes.map(({ root }) => root.kind)).toEqual([
      'revision-mismatch',
      'revision-mismatch',
    ]);
  });

  it('rejects false-clean reassessment and then supports an explicit upstream-to-downstream cascade', () => {
    const fixture = conclusionChain();
    let library = editAxiom(
      fixture.library,
      'AX-X',
      { statement: 'Changed root support.' },
      fixture.runtime,
    );
    const unchangedA2 = argument(library, 'A2');

    expect(() =>
      reassessArgumentPremises(library, 'A2', fixture.runtime),
    ).toThrow(/inherited stale premises.*A2-P1.*upstream/i);
    expect(argument(library, 'A2')).toEqual(unchangedA2);

    library = reassessArgumentPremises(library, 'A1', fixture.runtime);
    expect(argumentStaleness(library, argument(library, 'A1')).stale).toBe(
      false,
    );
    expect(
      argumentStaleness(library, argument(library, 'A2')).premiseStaleness[0],
    ).toMatchObject({ direct: true, inherited: false });
    expect(
      argumentStaleness(library, argument(library, 'A3')).premiseStaleness[0],
    ).toMatchObject({ direct: false, inherited: true });

    library = reassessArgumentPremises(library, 'A2', fixture.runtime);
    expect(argumentStaleness(library, argument(library, 'A2')).stale).toBe(
      false,
    );
    expect(
      argumentStaleness(library, argument(library, 'A3')).premiseStaleness[0],
    ).toMatchObject({ direct: true, inherited: false });

    library = reassessArgumentPremises(library, 'A3', fixture.runtime);
    expect(argumentStaleness(library, argument(library, 'A3')).stale).toBe(
      false,
    );
  });

  it('fails closed instead of recursing forever on an unvalidated dependency cycle', () => {
    const runtime = deterministicRuntime('defensive-cycle');
    let library = createEmptyArgumentLibrary(runtime, 'LIB-CORRUPT');
    library = createArgument(
      library,
      {
        id: 'A1',
        title: 'First',
        premises: [],
        conclusion: 'First conclusion.',
      },
      runtime,
    );
    library = createArgument(
      library,
      {
        id: 'A2',
        title: 'Second',
        premises: [
          {
            id: 'A2-P1',
            kind: 'argument-conclusion',
            argumentId: 'A1',
            reliedOnRevision: 1,
          },
        ],
        conclusion: 'Second conclusion.',
      },
      runtime,
    );
    const corrupted: ArgumentLibrary = {
      ...library,
      arguments: library.arguments.map((candidate) =>
        candidate.id === 'A1'
          ? {
              ...candidate,
              premises: [
                {
                  id: 'A1-P1',
                  kind: 'argument-conclusion' as const,
                  argumentId: 'A2',
                  reliedOnRevision: 1,
                },
              ],
            }
          : candidate,
      ),
    };

    expect(
      argumentStaleness(corrupted, argument(corrupted, 'A1'))
        .premiseStaleness[0]!.causes,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'inherited',
          root: {
            kind: 'dependency-cycle',
            argumentId: 'A1',
            premiseId: 'A1-P1',
          },
        }),
      ]),
    );
  });
});
