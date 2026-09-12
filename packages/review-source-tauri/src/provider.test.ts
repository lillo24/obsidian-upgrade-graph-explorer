import {
  ReviewEngine,
  ScriptedAgentProvider,
  createSequentialIdGenerator,
  exportReviewRunJson,
  exportReviewRunMarkdown,
  prepareReviewInput,
  type ScriptedStep,
} from '@icarus-graph-explorer/ai-review';
import { describe, expect, it } from 'vitest';

import type { ReviewSourceNativeBridge } from './bridge';
import { mapCaptureToReviewSource } from './mapping';
import { createReviewSourceProvider } from './provider';
import {
  ReviewSourceCaptureError,
  type NativeReviewSourceCapture,
  type ReviewSourcePreparation,
  type ReviewSourceSessionDescriptor,
} from './types';
import type { WorkspaceIdentitySession } from '@icarus-graph-explorer/source-provider-tauri';

const BASE = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const HEAD = '1111111111111111111111111111111111111111';

const descriptor: ReviewSourceSessionDescriptor = {
  schemaVersion: 1,
  sessionId: 'session-1',
  workspaceId: 'synthetic-workspace',
  displayName: 'Synthetic Vault',
  worktreeLayout: 'main',
  vaultPrefix: 'notes',
  limits: {
    maxCommits: 10,
    maxSelectedFiles: 32,
    maxInventoryFiles: 20_000,
    maxPageSize: 200,
    maxBlobBytes: 524_288,
    maxPatchBytes: 524_288,
    maxCaptureBytes: 921_600,
    commandTimeoutMs: 10_000,
    operationTimeoutMs: 30_000,
  },
  limitations: ['Synthetic bridge fixture.'],
};

const preparation: ReviewSourcePreparation = {
  schemaVersion: 1,
  sessionId: descriptor.sessionId,
  preparationId: 'preparation-1',
  requestedCount: 1,
  historyPolicy: 'first-parent',
  commitOrder: 'oldest-to-newest',
  baseCommitId: BASE,
  headCommitId: HEAD,
  commits: [{ commitId: HEAD, parentIds: [BASE], firstParentId: BASE }],
  branchName: 'main',
  changedFiles: [
    {
      path: 'empty.md',
      role: 'changed',
      eligible: true,
      availability: 'available',
      byteLength: 0,
      changes: [
        {
          commitId: HEAD,
          parentCommitId: BASE,
          status: 'modified',
          oldPath: 'empty.md',
          newPath: 'empty.md',
        },
      ],
    },
  ],
  additionalEligibleFileCount: 1,
  excludedPathCount: 0,
  exclusionReasons: [],
  workingTreeWarning: 'Synthetic dirty-tree warning.',
  limitations: ['Synthetic bridge fixture.'],
};

const nativeCapture: NativeReviewSourceCapture = {
  schemaVersion: 1,
  sessionId: descriptor.sessionId,
  preparationId: preparation.preparationId,
  requestId: 'request-1',
  workspaceId: descriptor.workspaceId,
  selectedPaths: ['context.md', 'empty.md'],
  headAdvanced: false,
  workingTreeWarning: 'Synthetic dirty-tree warning.',
  completeness: 'complete',
  missingMaterial: [],
  omissions: [],
  files: [
    {
      path: 'context.md',
      role: 'context',
      availability: 'available',
      headBlob: {
        commitId: HEAD,
        objectId: '2222222222222222222222222222222222222222',
        byteLength: 20,
        content: '# Synthetic context\n',
      },
      changes: [],
    },
    {
      path: 'empty.md',
      role: 'changed',
      availability: 'available',
      headBlob: {
        commitId: HEAD,
        objectId: '3333333333333333333333333333333333333333',
        byteLength: 0,
        content: '',
      },
      changes: preparation.changedFiles[0]!.changes,
    },
  ],
  patches: [
    {
      id: `diff:${HEAD}:empty.md`,
      path: 'empty.md',
      commitId: HEAD,
      parentCommitId: BASE,
      status: 'modified',
      byteLength: 36,
      content: 'diff --git empty.md empty.md\n-old\n+\n',
    },
  ],
  manifest: {
    schemaVersion: 1,
    historyPolicy: 'first-parent',
    commitOrder: 'oldest-to-newest',
    baseCommitId: BASE,
    headCommitId: HEAD,
    commits: preparation.commits,
    files: [
      {
        path: 'context.md',
        role: 'context',
        availability: 'available',
        headBlob: {
          commitId: HEAD,
          objectId: '2222222222222222222222222222222222222222',
          byteLength: 20,
        },
        changes: [],
      },
      {
        path: 'empty.md',
        role: 'changed',
        availability: 'available',
        headBlob: {
          commitId: HEAD,
          objectId: '3333333333333333333333333333333333333333',
          byteLength: 0,
        },
        changes: preparation.changedFiles[0]!.changes,
      },
    ],
    capturedByteCount: 56,
    limits: descriptor.limits,
  },
};

function workspace(): WorkspaceIdentitySession {
  return {
    selection: {
      rootPath: 'C:\\private\\synthetic-vault',
      displayName: 'Synthetic Vault',
    },
    workspaceId: 'synthetic-workspace',
    catalog: {
      schemaVersion: 1,
      workspaceId: 'synthetic-workspace',
      nextEntitySequence: 1,
      nextReferenceSequence: 1,
      entities: [],
      references: [],
    },
    association: 'existing' as const,
  };
}

function bridge(overrides: Partial<ReviewSourceNativeBridge> = {}): {
  value: ReviewSourceNativeBridge;
  calls: Array<{ name: string; input: unknown }>;
} {
  const calls: Array<{ name: string; input: unknown }> = [];
  const value: ReviewSourceNativeBridge = {
    isSupported: () => true,
    openSession: async (input) => {
      calls.push({ name: 'open', input });
      return descriptor;
    },
    prepare: async (input) => {
      calls.push({ name: 'prepare', input });
      return preparation;
    },
    listFiles: async (input) => {
      calls.push({ name: 'list', input });
      return {
        schemaVersion: 1,
        sessionId: descriptor.sessionId,
        preparationId: preparation.preparationId,
        files: [
          {
            path: 'context.md',
            role: 'context',
            eligible: true,
            availability: 'available',
            byteLength: 20,
            changes: [],
          },
        ],
        totalMatching: 1,
      };
    },
    capture: async (input) => {
      calls.push({ name: 'capture', input });
      return { ...nativeCapture, requestId: input.requestId };
    },
    cancel: async (input) => {
      calls.push({ name: 'cancel', input });
    },
    dispose: async (input) => {
      calls.push({ name: 'dispose', input });
    },
    ...overrides,
  };
  return { value, calls };
}

describe('Tauri review-source bridge and mapping', () => {
  it('keeps roots at session opening and uses opaque IDs afterward', async () => {
    const fake = bridge();
    const provider = createReviewSourceProvider({
      bridge: fake.value,
      requestId: () => 'request-1',
    });
    const session = await provider.openAuthorizedSession(workspace());
    const prepared = await session.prepareLastCommits(1);
    const page = await session.listAdditionalFiles(prepared.preparationId, {
      query: 'context',
    });
    const captured = await session.capture(prepared.preparationId, [
      'empty.md',
      page.files[0]!.path,
    ]);
    expect(captured.source.commitIds).toEqual([HEAD]);
    expect(
      captured.source.materials.find(({ id }) => id === 'source:empty.md')
        ?.content,
    ).toBe('');
    expect(fake.calls[0]).toMatchObject({
      name: 'open',
      input: { rootPath: workspace().selection.rootPath },
    });
    expect(
      fake.calls
        .slice(1)
        .some(({ input }) => JSON.stringify(input).includes('private')),
    ).toBe(false);
    await session.dispose();
    await expect(session.prepareLastCommits(1)).rejects.toMatchObject({
      code: 'unauthorized',
    });
  });

  it('is safe to construct in a browser-only runtime and reports unsupported', async () => {
    const fake = bridge({ isSupported: () => false });
    const provider = createReviewSourceProvider({ bridge: fake.value });
    expect(provider.isSupported()).toBe(false);
    await expect(
      provider.openAuthorizedSession(workspace()),
    ).rejects.toMatchObject({
      code: 'unsupported-runtime',
    });
    expect(fake.calls).toEqual([]);
  });

  it('rejects foreign native identities and late results after disposal', async () => {
    let release!: (value: NativeReviewSourceCapture) => void;
    const pending = new Promise<NativeReviewSourceCapture>((resolve) => {
      release = resolve;
    });
    const fake = bridge({ capture: () => pending });
    const session = await createReviewSourceProvider({
      bridge: fake.value,
      requestId: () => 'request-1',
    }).openAuthorizedSession(workspace());
    const prepared = await session.prepareLastCommits(1);
    const result = session.capture(prepared.preparationId, [
      'context.md',
      'empty.md',
    ]);
    await session.dispose();
    release(nativeCapture);
    await expect(result).rejects.toMatchObject({ code: 'changed-preparation' });
  });

  it('maps capture into prepareReviewInput and a scripted REVIEW1 run', async () => {
    const source = mapCaptureToReviewSource(nativeCapture);
    const input = {
      workspaceId: nativeCapture.workspaceId,
      source,
      additionalRequest: 'Review only the synthetic captured fixture.',
      models: {
        analysis: { provider: 'scripted-test', model: 'analysis' },
        integrator: { provider: 'scripted-test', model: 'integrator' },
        postCheck: { provider: 'scripted-test', model: 'post-check' },
      },
    };
    const prepared = prepareReviewInput(input);
    expect(prepared.frozenInput.sharedMaterial).toContain('first-parent');
    expect(prepared.frozenInput.sharedMaterial).toContain(
      '# Synthetic context',
    );
    const terminal = (rawText: string): ScriptedStep[] => [
      { type: 'terminal', status: 'completed', rawText },
    ];
    const engine = new ReviewEngine({
      ids: createSequentialIdGenerator('capture'),
      provider: new ScriptedAgentProvider({
        negative: [terminal('Synthetic negative branch.')],
        positive: [terminal('Synthetic positive branch.')],
        integrator: [
          [
            {
              type: 'terminal',
              status: 'completed',
              rawText: 'SYNTHETIC REVIEW OUTPUT — NOT AN AI CONCLUSION',
              structured: {
                schemaVersion: 1,
                summary: 'Synthetic integration.',
                issues: [
                  {
                    id: 'synthetic-issue',
                    relation: 'agreement',
                    negativeReferences: [{ attemptId: 'capture-attempt-1' }],
                    positiveReferences: [{ attemptId: 'capture-attempt-2' }],
                    integrationMarkdown: 'Synthetic only.',
                    unresolvedPoints: [],
                    integratorNotes: [],
                  },
                ],
                unresolvedQuestions: [],
              },
            },
          ],
        ],
      }),
    });
    const run = await (await engine.start(input)).completion;
    expect(run.state).toBe('completed');
    expect(exportReviewRunMarkdown(run)).toContain('Captured bytes: 56');
    expect(exportReviewRunJson(run)).toContain('preparation-1');
    expect(() =>
      mapCaptureToReviewSource({ ...nativeCapture, patches: [] }),
    ).toThrow(/patches do not match/);
  });

  it('keeps incomplete acceptance outside the adapter', () => {
    const source = mapCaptureToReviewSource(nativeCapture);
    const incomplete = {
      ...source,
      completeness: 'incomplete' as const,
      missingMaterial: ['synthetic missing object'],
    };
    expect(() =>
      prepareReviewInput({
        workspaceId: nativeCapture.workspaceId,
        source: incomplete,
        additionalRequest: '',
        models: {
          analysis: { provider: 'test', model: 'test' },
          integrator: { provider: 'test', model: 'test' },
          postCheck: { provider: 'test', model: 'test' },
        },
      }),
    ).toThrow(/acceptIncomplete/);
    expect(
      new ReviewSourceCaptureError({ code: 'cancelled', message: 'x' }).code,
    ).toBe('cancelled');
  });
});
