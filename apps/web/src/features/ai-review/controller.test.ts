import { describe, expect, it, vi } from 'vitest';

import {
  Deferred,
  ScriptedAgentProvider,
  createSequentialIdGenerator,
  type IntegrationResultInput,
} from '@icarus-graph-explorer/ai-review';
import { MemoryReviewHistoryStore } from '@icarus-graph-explorer/review-workspace';
import {
  mapCaptureToReviewSource,
  type NativeReviewSourceCapture,
  type ReviewSourcePreparation,
  type ReviewSourceProvider,
  type ReviewSourceSession,
} from '@icarus-graph-explorer/review-source-tauri';
import type { WorkspaceIdentitySession } from '@icarus-graph-explorer/source-provider-tauri';

import { AiReviewController } from './controller';

const BASE = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const HEAD = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const SOURCE = '# Synthetic source\n';
const PATCH = 'diff --git a/change.md b/change.md\n+Synthetic\n';

const limits = {
  maxCommits: 10,
  maxSelectedFiles: 32,
  maxInventoryFiles: 20_000,
  maxPageSize: 200,
  maxBlobBytes: 524_288,
  maxPatchBytes: 524_288,
  maxCaptureBytes: 921_600,
  commandTimeoutMs: 10_000,
  operationTimeoutMs: 30_000,
};

const preparation: ReviewSourcePreparation = {
  schemaVersion: 1,
  sessionId: 'session-1',
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
      path: 'change.md',
      role: 'changed',
      eligible: true,
      availability: 'available',
      byteLength: new TextEncoder().encode(SOURCE).byteLength,
      changes: [
        {
          commitId: HEAD,
          parentCommitId: BASE,
          status: 'modified',
          oldPath: 'change.md',
          newPath: 'change.md',
        },
      ],
    },
  ],
  additionalEligibleFileCount: 0,
  excludedPathCount: 0,
  exclusionReasons: [],
  workingTreeWarning: 'Synthetic uncommitted content was excluded.',
  limitations: ['Synthetic controller fixture.'],
};

const nativeCapture: NativeReviewSourceCapture = {
  schemaVersion: 1,
  sessionId: 'session-1',
  preparationId: 'preparation-1',
  requestId: 'request-1',
  workspaceId: 'synthetic-workspace',
  selectedPaths: ['change.md'],
  headAdvanced: false,
  workingTreeWarning: 'Synthetic uncommitted content was excluded.',
  completeness: 'complete',
  missingMaterial: [],
  omissions: [],
  files: [
    {
      path: 'change.md',
      role: 'changed',
      availability: 'available',
      headBlob: {
        commitId: HEAD,
        objectId: 'cccccccccccccccccccccccccccccccccccccccc',
        byteLength: new TextEncoder().encode(SOURCE).byteLength,
        content: SOURCE,
      },
      changes: preparation.changedFiles[0]!.changes,
    },
  ],
  patches: [
    {
      id: `diff:${HEAD}:change.md`,
      path: 'change.md',
      commitId: HEAD,
      parentCommitId: BASE,
      status: 'modified',
      byteLength: new TextEncoder().encode(PATCH).byteLength,
      content: PATCH,
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
        path: 'change.md',
        role: 'changed',
        availability: 'available',
        headBlob: {
          commitId: HEAD,
          objectId: 'cccccccccccccccccccccccccccccccccccccccc',
          byteLength: new TextEncoder().encode(SOURCE).byteLength,
        },
        changes: preparation.changedFiles[0]!.changes,
      },
    ],
    capturedByteCount:
      new TextEncoder().encode(SOURCE).byteLength +
      new TextEncoder().encode(PATCH).byteLength,
    limits,
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
    association: 'existing',
  };
}

function sourceProvider(): {
  readonly provider: ReviewSourceProvider;
  readonly calls: string[];
} {
  const calls: string[] = [];
  const session: ReviewSourceSession = {
    descriptor: {
      schemaVersion: 1,
      sessionId: 'session-1',
      workspaceId: 'synthetic-workspace',
      displayName: 'Synthetic Vault',
      worktreeLayout: 'main',
      vaultPrefix: '',
      limits,
      limitations: ['Synthetic controller fixture.'],
    },
    async prepareLastCommits(count) {
      calls.push(`prepare:${count}`);
      return preparation;
    },
    async listAdditionalFiles() {
      calls.push('list');
      return {
        schemaVersion: 1,
        sessionId: 'session-1',
        preparationId: 'preparation-1',
        files: [],
        totalMatching: 0,
      };
    },
    async capture(_preparationId, _paths, options) {
      calls.push('capture');
      options?.onProgress?.('capturing');
      return {
        native: nativeCapture,
        source: mapCaptureToReviewSource(nativeCapture),
      };
    },
    async dispose() {
      calls.push('dispose');
    },
  };
  return {
    calls,
    provider: {
      isSupported: () => true,
      async openAuthorizedSession() {
        calls.push('open');
        return session;
      },
    },
  };
}

async function capture(controller: AiReviewController): Promise<void> {
  controller.setWorkspace({
    identitySession: workspace(),
    label: 'Synthetic Vault',
  });
  await controller.prepareHistory();
  controller.selectEligibleChangedFiles();
  await controller.captureSelectedFiles();
}

function integrationResult(): IntegrationResultInput {
  return {
    schemaVersion: 1,
    summary: 'SYNTHETIC REVIEW OUTPUT — NOT AN AI CONCLUSION',
    issues: [
      {
        id: 'issue-1',
        relation: 'direct-disagreement',
        negativeReferences: [
          { attemptId: 'ui-attempt-1', quote: 'Synthetic negative' },
        ],
        positiveReferences: [
          { attemptId: 'ui-attempt-2', quote: 'Synthetic positive' },
        ],
        negativeContribution: 'Synthetic negative',
        positiveContribution: 'Synthetic positive',
        integrationMarkdown: 'Synthetic integration.',
        unresolvedPoints: [],
        integratorNotes: [],
      },
    ],
    unresolvedQuestions: [],
  };
}

describe('AI Review application controller', () => {
  it('reopens safely after a lifecycle cleanup replay', async () => {
    const controller = new AiReviewController({
      sourceProvider: sourceProvider().provider,
      historyStore: new MemoryReviewHistoryStore(),
    });
    await controller.open();
    await controller.dispose();
    await controller.open();
    controller.updateSetup({ title: 'Reopened controller' });
    expect(controller.snapshot()).toMatchObject({
      phase: 'ready',
      setup: { title: 'Reopened controller' },
    });
  });

  it('captures exact REVIEW2 evidence and persists a model-optional preparation', async () => {
    const source = sourceProvider();
    const history = new MemoryReviewHistoryStore();
    const controller = new AiReviewController({
      sourceProvider: source.provider,
      historyStore: history,
      preparationId: () => 'prepared-controller-1',
    });
    await controller.open();
    expect(source.calls).toEqual([]);
    await capture(controller);
    controller.updateSetup({
      additionalRequest: 'Inspect the synthetic boundary.',
    });
    controller.refreshPromptPreviews();
    const previews = controller.snapshot().promptPreviews!;
    expect(previews.negative).toContain(SOURCE);
    expect(previews.positive).toContain(SOURCE);
    expect(previews.negative).not.toBe(previews.positive);
    await controller.savePreparation();
    const listed = await history.list();
    expect(listed.summaries).toMatchObject([
      { id: 'prepared-controller-1', kind: 'preparation', state: 'prepared' },
    ]);
    const loaded = await history.load('prepared-controller-1');
    expect(loaded.status).toBe('loaded');
    if (loaded.status === 'loaded' && loaded.entry.kind === 'preparation') {
      expect(loaded.entry.preparation.models).toBeUndefined();
      expect(
        loaded.entry.preparation.source.materials.map(({ content }) => content),
      ).toEqual([SOURCE, PATCH]);
    }
    expect(controller.exportPreparation()).toContain(
      'PREPARED AI REVIEW — NOT AI CONCLUSIONS',
    );
    expect(controller.exportSelectedPreparationJson()).toContain(
      '"kind": "preparation"',
    );

    controller.setWorkspace(undefined);
    controller.updateSetup({ additionalRequest: 'Saved evidence still wins.' });
    controller.refreshPromptPreviews();
    expect(controller.snapshot().promptPreviews?.negative).toContain(SOURCE);
    expect(controller.snapshot().draftWorkspace).toEqual({
      id: 'synthetic-workspace',
      label: 'Synthetic Vault',
    });
  });

  it('uses the real concurrent engine only when an agent provider is injected', async () => {
    const negativeGate = new Deferred<void>();
    const positiveGate = new Deferred<void>();
    const agent = new ScriptedAgentProvider({
      negative: [
        [
          { type: 'wait', deferred: negativeGate },
          {
            type: 'terminal',
            status: 'completed',
            rawText: 'Synthetic negative',
          },
        ],
      ],
      positive: [
        [
          { type: 'wait', deferred: positiveGate },
          {
            type: 'terminal',
            status: 'completed',
            rawText: 'Synthetic positive',
          },
        ],
      ],
      integrator: [
        [
          {
            type: 'terminal',
            status: 'completed',
            rawText: 'Synthetic integration',
            structured: integrationResult(),
          },
        ],
      ],
    });
    const source = sourceProvider();
    const history = new MemoryReviewHistoryStore();
    const controller = new AiReviewController({
      sourceProvider: source.provider,
      historyStore: history,
      agentProvider: agent,
      ids: createSequentialIdGenerator('ui'),
    });
    await controller.open();
    await capture(controller);
    controller.updateSetup({
      models: {
        analysis: { provider: 'scripted-test', model: 'analysis-fixture' },
        integrator: { provider: 'scripted-test', model: 'integrator-fixture' },
        postCheck: { provider: 'scripted-test', model: 'post-fixture' },
      },
    });
    await controller.startRun();
    expect(
      agent.startedRequests
        .slice(0, 2)
        .map(({ stage }) => stage)
        .sort(),
    ).toEqual(['negative', 'positive']);
    expect(
      controller.snapshot().run?.attempts.map(({ state }) => state),
    ).toEqual(['running', 'running']);
    controller.setWorkspace(undefined);
    negativeGate.resolve();
    positiveGate.resolve();
    await vi.waitFor(() =>
      expect(controller.snapshot().run?.state).toBe('completed'),
    );
    expect(
      controller.snapshot().run?.attempts.map(({ stage }) => stage),
    ).toEqual(['negative', 'positive', 'integrator']);
    expect((await history.list()).summaries[0]?.workspaceLabel).toBe(
      'Synthetic Vault',
    );
  });
});
