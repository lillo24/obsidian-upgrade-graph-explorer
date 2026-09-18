import { describe, expect, it } from 'vitest';

import {
  createAxiom,
  createArgument,
  createContext,
  createEmptyArgumentLibrary,
  editAxiom,
  editContext,
  moveContextAxiom,
  setContextAxiomMembership,
  setRecordArchived,
} from './library';
import { resolveArgumentBackground, createContextResolver } from './contexts';
import { createKnowledgeReaderFromLibrary } from './reader';
import { exportArgumentLibraryMarkdown } from './markdown';
import { parseArgumentLibraryJson } from './serialization';
import { deterministicRuntime } from './test-fixture';
import { argumentStaleness } from './library';
import { validateArgumentLibrary } from './validation';

function contextLibrary() {
  const runtime = deterministicRuntime('context');
  let library = createEmptyArgumentLibrary(runtime, 'library-context');
  for (const [id, title, statement] of [
    [
      'AX-ROOT',
      'Root rule',
      'Only the root description contains nebula prose.',
    ],
    ['AX-SHARED', 'Shared rule', 'Shared statement.'],
    ['AX-CHILD', 'Child rule', 'Child statement.'],
  ] as const) {
    library = createAxiom(
      library,
      { id, title, statement, reviewState: 'accepted' },
      runtime,
    );
  }
  library = createContext(
    library,
    {
      id: 'CTX-ROOT',
      title: 'Root context',
      description: 'Root-only metadata',
      axiomIds: ['AX-ROOT', 'AX-SHARED'],
      reviewState: 'accepted',
    },
    runtime,
  );
  library = createContext(
    library,
    {
      id: 'CTX-CHILD',
      title: 'Child context',
      description: 'Child-only metadata',
      parentContextId: 'CTX-ROOT',
      axiomIds: ['AX-SHARED', 'AX-CHILD'],
      reviewState: 'accepted',
    },
    runtime,
  );
  library = createArgument(
    library,
    {
      id: 'AR-CONTEXT',
      title: 'Context-bearing argument',
      premises: [],
      conclusion: 'The conclusion is explicit.',
      contextIds: ['CTX-CHILD'],
      reviewState: 'accepted',
    },
    runtime,
  );
  return { library, runtime };
}

describe('Argument Contexts', () => {
  it('resolves one parent chain deterministically with ordered de-duplication', () => {
    const { library } = contextLibrary();
    const resolved = createContextResolver(library)('CTX-CHILD');

    expect(resolved.parentContextIds).toEqual(['CTX-ROOT']);
    expect(resolved.inheritedAxiomIds).toEqual(['AX-ROOT', 'AX-SHARED']);
    expect(resolved.effectiveAxiomIds).toEqual([
      'AX-ROOT',
      'AX-SHARED',
      'AX-CHILD',
    ]);
    expect(resolved.context.description).toBe('Child-only metadata');
  });

  it('supports direct Axiom reordering without sorting authored order', () => {
    const { library, runtime } = contextLibrary();
    const moved = moveContextAxiom(
      library,
      'CTX-ROOT',
      'AX-SHARED',
      0,
      runtime,
    );
    expect(
      moved.contexts.find(({ id }) => id === 'CTX-ROOT')?.axiomIds,
    ).toEqual(['AX-SHARED', 'AX-ROOT']);
  });

  it('rejects missing parents, self-parenting, and inheritance cycles', () => {
    const { library, runtime } = contextLibrary();
    expect(() =>
      createContext(
        library,
        { id: 'CTX-MISSING', title: 'Missing', parentContextId: 'NOPE' },
        runtime,
      ),
    ).toThrow(/Unknown parent Context/u);
    expect(() =>
      createContext(
        library,
        { id: 'CTX-SELF', title: 'Self', parentContextId: 'CTX-SELF' },
        runtime,
      ),
    ).toThrow(/inherit from itself/u);
    expect(() =>
      editContext(
        library,
        'CTX-ROOT',
        { parentContextId: 'CTX-CHILD' },
        runtime,
      ),
    ).toThrow(/inheritance cycle/u);
  });

  it('rejects missing Context Axioms and missing Argument Contexts', () => {
    const { library } = contextLibrary();
    const missingAxiom = {
      ...library,
      contexts: library.contexts.map((context) =>
        context.id === 'CTX-ROOT'
          ? { ...context, axiomIds: ['AX-NOT-PRESENT'] }
          : context,
      ),
    };
    expect(validateArgumentLibrary(missingAxiom)).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          path: expect.stringContaining('.axiomIds['),
          code: 'missing-reference',
        }),
      ]),
    });

    const missingContext = {
      ...library,
      arguments: library.arguments.map((argument) => ({
        ...argument,
        contextIds: ['CTX-NOT-PRESENT'],
      })),
    };
    expect(validateArgumentLibrary(missingContext)).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          path: expect.stringContaining('.contextIds['),
          code: 'missing-reference',
        }),
      ]),
    });
  });

  it('rejects longer inheritance cycles independently of Argument dependencies', () => {
    const { library, runtime } = contextLibrary();
    const withGrandchild = createContext(
      library,
      {
        id: 'CTX-GRANDCHILD',
        title: 'Grandchild context',
        parentContextId: 'CTX-CHILD',
      },
      runtime,
    );
    expect(() =>
      editContext(
        withGrandchild,
        'CTX-ROOT',
        { parentContextId: 'CTX-GRANDCHILD' },
        runtime,
      ),
    ).toThrow(/inheritance cycle/u);
  });

  it('keeps Context changes out of premise staleness and Argument revisions', () => {
    const { library, runtime } = contextLibrary();
    const argument = library.arguments[0]!;
    const withAdditionalAxiom = createAxiom(
      library,
      {
        id: 'AX-ADDED',
        title: 'Added background rule',
        statement: 'Newly available background.',
      },
      runtime,
    );
    const edited = setContextAxiomMembership(
      withAdditionalAxiom,
      'CTX-ROOT',
      'AX-ADDED',
      true,
      runtime,
    );

    expect(edited.arguments[0]).toEqual(argument);
    expect(
      createContextResolver(edited)('CTX-CHILD').effectiveAxiomIds,
    ).toContain('AX-ADDED');
    expect(argumentStaleness(edited, edited.arguments[0]!)).toMatchObject({
      stale: false,
      premiseIds: [],
    });
  });

  it('stales only an explicit Axiom premise when a background Axiom changes', () => {
    const fixture = contextLibrary();
    const reliedOnRevision = fixture.library.axioms.find(
      ({ id }) => id === 'AX-ROOT',
    )!.revision;
    const withExplicitPremise = createArgument(
      fixture.library,
      {
        id: 'AR-EXPLICIT',
        title: 'Explicit premise argument',
        contextIds: ['CTX-CHILD'],
        premises: [
          {
            id: 'P-ROOT',
            kind: 'axiom',
            axiomId: 'AX-ROOT',
            reliedOnRevision,
          },
        ],
        conclusion: 'This conclusion explicitly relies on the root Axiom.',
      },
      fixture.runtime,
    );
    const changed = editAxiom(
      withExplicitPremise,
      'AX-ROOT',
      { statement: 'Changed root statement.' },
      fixture.runtime,
    );

    expect(
      argumentStaleness(
        changed,
        changed.arguments.find(({ id }) => id === 'AR-CONTEXT')!,
      ),
    ).toMatchObject({ stale: false, premiseIds: [] });
    expect(
      argumentStaleness(
        changed,
        changed.arguments.find(({ id }) => id === 'AR-EXPLICIT')!,
      ),
    ).toMatchObject({ stale: true, premiseIds: ['P-ROOT'] });
  });

  it('deduplicates overlapping attached Contexts and preserves all provenance', () => {
    const { library, runtime } = contextLibrary();
    const withSibling = createContext(
      library,
      {
        id: 'CTX-SIBLING',
        title: 'Sibling context',
        parentContextId: 'CTX-ROOT',
        axiomIds: ['AX-CHILD'],
      },
      runtime,
    );
    expect(
      resolveArgumentBackground(withSibling, ['CTX-CHILD', 'CTX-SIBLING'])
        .axioms,
    ).toEqual([
      {
        axiomId: 'AX-ROOT',
        viaContextIds: ['CTX-CHILD', 'CTX-SIBLING'],
      },
      {
        axiomId: 'AX-SHARED',
        viaContextIds: ['CTX-CHILD', 'CTX-SIBLING'],
      },
      {
        axiomId: 'AX-CHILD',
        viaContextIds: ['CTX-CHILD', 'CTX-SIBLING'],
      },
    ]);
  });

  it('returns Context closure and background provenance without reverse Argument expansion', () => {
    const { library } = contextLibrary();
    const reader = createKnowledgeReaderFromLibrary(library);
    const contextResult = reader.readArgumentBundle({
      kind: 'context',
      id: 'CTX-CHILD',
    });
    expect(contextResult.status).toBe('ok');
    if (contextResult.status !== 'ok') return;
    expect(contextResult.value.contexts.map(({ id }) => id)).toEqual([
      'CTX-CHILD',
      'CTX-ROOT',
    ]);
    expect(contextResult.value.arguments).toEqual([]);

    const argumentResult = reader.readArgumentBundle({
      kind: 'argument',
      id: 'AR-CONTEXT',
    });
    expect(argumentResult.status).toBe('ok');
    if (argumentResult.status !== 'ok') return;
    expect(argumentResult.value.arguments[0]?.backgroundAxioms).toEqual([
      expect.objectContaining({
        axiomId: 'AX-ROOT',
        viaContextIds: ['CTX-CHILD'],
      }),
      expect.objectContaining({
        axiomId: 'AX-SHARED',
        viaContextIds: ['CTX-CHILD'],
      }),
      expect.objectContaining({
        axiomId: 'AX-CHILD',
        viaContextIds: ['CTX-CHILD'],
      }),
    ]);
    expect(argumentResult.value.arguments[0]?.resolvedPremises).toEqual([]);
  });

  it('keeps retained readers pinned while new readers see changed background', () => {
    const { library, runtime } = contextLibrary();
    const retained = createKnowledgeReaderFromLibrary(library);
    const changedContext = editContext(
      library,
      'CTX-ROOT',
      { description: 'Changed root background metadata.' },
      runtime,
    );
    const changed = editAxiom(
      changedContext,
      'AX-ROOT',
      { statement: 'Changed root background statement.' },
      runtime,
    );
    const newest = createKnowledgeReaderFromLibrary(changed);

    const oldBundle = retained.readArgumentBundle({
      kind: 'argument',
      id: 'AR-CONTEXT',
    });
    const newBundle = newest.readArgumentBundle({
      kind: 'argument',
      id: 'AR-CONTEXT',
    });
    expect(oldBundle.status).toBe('ok');
    expect(newBundle.status).toBe('ok');
    if (oldBundle.status !== 'ok' || newBundle.status !== 'ok') return;
    expect(
      oldBundle.value.axioms.find(({ id }) => id === 'AX-ROOT')?.statement,
    ).toBe('Only the root description contains nebula prose.');
    expect(
      newBundle.value.axioms.find(({ id }) => id === 'AX-ROOT')?.statement,
    ).toBe('Changed root background statement.');
    expect(
      oldBundle.value.contexts.find(({ id }) => id === 'CTX-ROOT')?.description,
    ).toBe('Root-only metadata');
    expect(
      newBundle.value.contexts.find(({ id }) => id === 'CTX-ROOT')?.description,
    ).toBe('Changed root background metadata.');
  });

  it('keeps archived Context references readable for historical integrity', () => {
    const { library, runtime } = contextLibrary();
    const archived = setRecordArchived(
      library,
      'context',
      'CTX-CHILD',
      true,
      runtime,
    );
    const result = createKnowledgeReaderFromLibrary(
      archived,
    ).readArgumentBundle({ kind: 'argument', id: 'AR-CONTEXT' });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(
      result.value.contexts.find(({ id }) => id === 'CTX-CHILD'),
    ).toMatchObject({ archived: true });
    expect(result.value.completeness.warnings).toContain(
      'CTX-CHILD is archived.',
    );
  });

  it('does not flatten member Axiom prose into Context search', () => {
    const { library } = contextLibrary();
    const result = createKnowledgeReaderFromLibrary(library).searchIndex({
      query: 'nebula',
    });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.value.candidates.some(({ kind }) => kind === 'context')).toBe(
      false,
    );
  });

  it('exports Context files and a clearly separate Argument background section', () => {
    const { library } = contextLibrary();
    const output = exportArgumentLibraryMarkdown(library);
    expect(output.files.some(({ path }) => path.startsWith('contexts/'))).toBe(
      true,
    );
    const argument = output.files.find(({ path }) =>
      path.startsWith('arguments/'),
    )!;
    expect(argument.text).toContain('## Contexts (background, not premises)');
    expect(argument.text).toContain('### Effective background Axioms');
  });

  it('migrates schema v3 by adding only empty Context structures', () => {
    const { library } = contextLibrary();
    const legacyArguments = library.arguments.map((argument) => {
      const legacyArgument = { ...argument } as Record<string, unknown>;
      delete legacyArgument.contextIds;
      return legacyArgument;
    });
    const legacy = {
      ...library,
      schemaVersion: 3,
      arguments: legacyArguments,
    } as Record<string, unknown>;
    delete legacy.contexts;
    delete legacy.proposals;
    const source = JSON.stringify(legacy);
    const parsed = parseArgumentLibraryJson(source);
    expect(parsed.status).toBe('valid');
    if (parsed.status !== 'valid') return;
    expect(parsed.migratedFromSchemaVersion).toBe(3);
    expect(parsed.value.contexts).toEqual([]);
    expect(parsed.value.arguments[0]?.contextIds).toEqual([]);
  });

  it('reports the effective background independently from Context revision pins', () => {
    const { library } = contextLibrary();
    expect(resolveArgumentBackground(library, ['CTX-CHILD']).axioms).toEqual([
      { axiomId: 'AX-ROOT', viaContextIds: ['CTX-CHILD'] },
      { axiomId: 'AX-SHARED', viaContextIds: ['CTX-CHILD'] },
      { axiomId: 'AX-CHILD', viaContextIds: ['CTX-CHILD'] },
    ]);
  });
});
