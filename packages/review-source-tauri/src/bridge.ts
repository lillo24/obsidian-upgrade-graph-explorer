import { invoke, isTauri } from '@tauri-apps/api/core';

import {
  ReviewSourceCaptureError,
  type NativeReviewSourceCapture,
  type ReviewSourceFailure,
  type ReviewSourceFilePage,
  type ReviewSourcePreparation,
  type ReviewSourceSessionDescriptor,
} from './types';

export interface ReviewSourceNativeBridge {
  isSupported(): boolean;
  openSession(input: {
    readonly rootPath: string;
    readonly workspaceId: string;
  }): Promise<ReviewSourceSessionDescriptor>;
  prepare(input: {
    readonly sessionId: string;
    readonly commitCount: number;
  }): Promise<ReviewSourcePreparation>;
  listFiles(input: {
    readonly sessionId: string;
    readonly preparationId: string;
    readonly query: string;
    readonly cursor?: string;
    readonly limit: number;
  }): Promise<ReviewSourceFilePage>;
  capture(input: {
    readonly sessionId: string;
    readonly preparationId: string;
    readonly requestId: string;
    readonly selectedPaths: readonly string[];
  }): Promise<NativeReviewSourceCapture>;
  cancel(input: {
    readonly sessionId: string;
    readonly requestId: string;
  }): Promise<void>;
  dispose(input: { readonly sessionId: string }): Promise<void>;
}

const ERROR_CODES = new Set<ReviewSourceFailure['code']>([
  'unsupported-runtime',
  'permission-needed',
  'unauthorized',
  'git-unavailable',
  'not-a-repository',
  'no-commits',
  'insufficient-history',
  'root-range-unsupported',
  'missing-object',
  'invalid-selection',
  'unsupported-file',
  'unsupported-path-encoding',
  'invalid-utf8',
  'size-limit',
  'time-limit',
  'changed-preparation',
  'cancelled',
  'git-command-failed',
  'native-failure',
]);

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nativeFailure(error: unknown): ReviewSourceCaptureError {
  if (
    record(error) &&
    typeof error.code === 'string' &&
    ERROR_CODES.has(error.code as ReviewSourceFailure['code']) &&
    typeof error.message === 'string'
  ) {
    return new ReviewSourceCaptureError(
      {
        code: error.code as ReviewSourceFailure['code'],
        message: error.message,
        ...(typeof error.availableCount === 'number'
          ? { availableCount: error.availableCount }
          : {}),
      },
      { cause: error },
    );
  }
  return new ReviewSourceCaptureError(
    {
      code: 'native-failure',
      message:
        'The desktop review-source command failed without a valid error envelope.',
    },
    { cause: error },
  );
}

async function call<T>(command: string, input: unknown): Promise<T> {
  try {
    return await invoke<T>(command, { input });
  } catch (error: unknown) {
    throw nativeFailure(error);
  }
}

/** Narrow invoke-only bridge. It never exposes shell/process execution. */
export function createTauriReviewSourceBridge(): ReviewSourceNativeBridge {
  return {
    isSupported: isTauri,
    openSession: (input) => call('open_review_source_session', input),
    prepare: (input) => call('prepare_review_source_history', input),
    listFiles: (input) => call('list_review_source_files', input),
    capture: (input) => call('capture_review_source', input),
    cancel: (input) => call('cancel_review_source_capture', input),
    dispose: (input) => call('dispose_review_source_session', input),
  };
}
