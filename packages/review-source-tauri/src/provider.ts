import type { WorkspaceIdentitySession } from '@icarus-graph-explorer/source-provider-tauri';

import {
  createTauriReviewSourceBridge,
  type ReviewSourceNativeBridge,
} from './bridge';
import { mapCaptureToReviewSource } from './mapping';
import {
  ReviewSourceCaptureError,
  type CaptureOptions,
  type ReviewSourceProvider,
  type ReviewSourceSession,
} from './types';
import {
  validateCapture,
  validateFilePage,
  validatePreparation,
  validateSessionDescriptor,
} from './validation';

export interface CreateReviewSourceProviderOptions {
  readonly bridge?: ReviewSourceNativeBridge;
  readonly requestId?: () => string;
}

function defaultRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new ReviewSourceCaptureError({
      code: 'unsupported-runtime',
      message: 'Secure capture request identity generation is unavailable.',
    });
  }
  return globalThis.crypto.randomUUID();
}

function unsupported(): ReviewSourceCaptureError {
  return new ReviewSourceCaptureError({
    code: 'unsupported-runtime',
    message:
      'Local Git review capture is available only in the native desktop runtime.',
  });
}

function createSession(
  bridge: ReviewSourceNativeBridge,
  descriptor: ReturnType<typeof validateSessionDescriptor>,
  requestId: () => string,
): ReviewSourceSession {
  let disposed = false;
  let generation = 0;
  const preparationIds = new Set<string>();

  function active(): void {
    if (disposed) {
      throw new ReviewSourceCaptureError({
        code: 'unauthorized',
        message: 'The review-source session has been disposed.',
      });
    }
  }

  function knownPreparation(preparationId: string): void {
    active();
    if (!preparationIds.has(preparationId)) {
      throw new ReviewSourceCaptureError({
        code: 'changed-preparation',
        message:
          'The preparation does not belong to this active source session.',
      });
    }
  }

  return {
    descriptor,
    async prepareLastCommits(commitCount) {
      active();
      const prepared = validatePreparation(
        await bridge.prepare({
          sessionId: descriptor.sessionId,
          commitCount,
        }),
      );
      if (prepared.sessionId !== descriptor.sessionId) {
        throw new ReviewSourceCaptureError({
          code: 'native-failure',
          message: 'Native preparation returned for a different session.',
        });
      }
      preparationIds.add(prepared.preparationId);
      return prepared;
    },
    async listAdditionalFiles(preparationId, query = {}) {
      knownPreparation(preparationId);
      const page = validateFilePage(
        await bridge.listFiles({
          sessionId: descriptor.sessionId,
          preparationId,
          query: query.query ?? '',
          ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
          limit: query.limit ?? Math.min(100, descriptor.limits.maxPageSize),
        }),
      );
      if (
        page.sessionId !== descriptor.sessionId ||
        page.preparationId !== preparationId
      ) {
        throw new ReviewSourceCaptureError({
          code: 'native-failure',
          message: 'Native file inventory returned for a different scope.',
        });
      }
      return page;
    },
    async capture(preparationId, selectedPaths, options: CaptureOptions = {}) {
      knownPreparation(preparationId);
      if (options.signal?.aborted) {
        options.onProgress?.('cancelled');
        throw new ReviewSourceCaptureError({
          code: 'cancelled',
          message: 'The review-source capture was cancelled before it started.',
        });
      }
      const request = requestId();
      const startedGeneration = generation;
      let aborting: Promise<void> | undefined;
      const abort = () => {
        options.onProgress?.('cancelled');
        aborting ??= bridge
          .cancel({ sessionId: descriptor.sessionId, requestId: request })
          .catch(() => undefined);
      };
      options.signal?.addEventListener('abort', abort, { once: true });
      options.onProgress?.('starting');
      try {
        options.onProgress?.('capturing');
        const native = validateCapture(
          await bridge.capture({
            sessionId: descriptor.sessionId,
            preparationId,
            requestId: request,
            selectedPaths,
          }),
        );
        if (
          disposed ||
          generation !== startedGeneration ||
          native.sessionId !== descriptor.sessionId ||
          native.preparationId !== preparationId ||
          native.requestId !== request ||
          native.workspaceId !== descriptor.workspaceId
        ) {
          throw new ReviewSourceCaptureError({
            code: 'changed-preparation',
            message:
              'A late capture result no longer belongs to the active scope.',
          });
        }
        const source = mapCaptureToReviewSource(native);
        options.onProgress?.('completed');
        return { native, source };
      } finally {
        options.signal?.removeEventListener('abort', abort);
        await aborting;
      }
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      generation += 1;
      preparationIds.clear();
      await bridge.dispose({ sessionId: descriptor.sessionId });
    },
  };
}

export function createReviewSourceProvider(
  options: CreateReviewSourceProviderOptions = {},
): ReviewSourceProvider {
  const bridge = options.bridge ?? createTauriReviewSourceBridge();
  const requestId = options.requestId ?? defaultRequestId;
  return {
    isSupported: () => bridge.isSupported(),
    async openAuthorizedSession(workspace: WorkspaceIdentitySession) {
      if (!bridge.isSupported()) throw unsupported();
      const descriptor = validateSessionDescriptor(
        await bridge.openSession({
          rootPath: workspace.selection.rootPath,
          workspaceId: workspace.workspaceId,
        }),
      );
      if (descriptor.workspaceId !== workspace.workspaceId) {
        await bridge.dispose({ sessionId: descriptor.sessionId });
        throw new ReviewSourceCaptureError({
          code: 'native-failure',
          message:
            'Native session returned for a different workspace identity.',
        });
      }
      return createSession(bridge, descriptor, requestId);
    },
  };
}
