import type { VaultDiscoveryProgressListener } from '@icarus-graph-explorer/source-provider-tauri';

import type {
  DesktopVaultOpenProgress,
  DesktopVaultOpenProgressListener,
  DesktopVaultOpenStage,
} from './desktop-vault';
import type { DesktopLiveVaultPhase } from './desktop-live-vault';

const STAGE_MESSAGES: Record<DesktopVaultOpenStage, string> = {
  'acquiring-source': 'Preparing vault source…',
  'building-workspace': 'Building workspace…',
  'persisting-identity': 'Saving workspace identity…',
  'committing-workspace': 'Finalizing workspace…',
  'recovering-workspace': 'Recovering workspace…',
};

export function formatVaultOpenElapsed(elapsedMs: number): string {
  const elapsedSeconds = Math.max(0, Math.floor(elapsedMs / 1_000));
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function isCurrentVaultOpenRequest(
  currentGeneration: number,
  requestGeneration: number,
): boolean {
  return currentGeneration === requestGeneration;
}

export function guardVaultOpenProgress(
  requestGeneration: number,
  currentGeneration: () => number,
  publish: DesktopVaultOpenProgressListener,
): DesktopVaultOpenProgressListener {
  return (progress) => {
    if (isCurrentVaultOpenRequest(currentGeneration(), requestGeneration)) {
      publish(progress);
    }
  };
}

export function guardVaultDiscoveryProgress(
  requestGeneration: number,
  currentGeneration: () => number,
  publish: VaultDiscoveryProgressListener,
): VaultDiscoveryProgressListener {
  return (progress) => {
    if (isCurrentVaultOpenRequest(currentGeneration(), requestGeneration)) {
      publish(progress);
    }
  };
}

export function isLiveVaultProgressPhase(
  phase: DesktopLiveVaultPhase | undefined,
): phase is 'catching-up' | 'updating' | 'resyncing' {
  return (
    phase === 'catching-up' || phase === 'updating' || phase === 'resyncing'
  );
}

export function describeVaultOpenProgress(
  progress: DesktopVaultOpenProgress | undefined,
): string {
  const stage = progress?.stage ?? 'acquiring-source';
  const message = STAGE_MESSAGES[stage];
  if (progress?.stage === 'acquiring-source') {
    if (
      progress.acquisition.sourceDiscovery === 'complete' &&
      progress.acquisition.identityPreparation === 'pending'
    ) {
      return 'Loading workspace identity…';
    }
    if (
      progress.acquisition.sourceDiscovery === 'pending' &&
      progress.acquisition.identityPreparation === 'complete'
    ) {
      return 'Reading vault files…';
    }
    if (
      progress.acquisition.sourceDiscovery === 'complete' &&
      progress.acquisition.identityPreparation === 'complete'
    ) {
      return progress.acquisition.markdownFileCount === undefined
        ? STAGE_MESSAGES['building-workspace']
        : `${STAGE_MESSAGES['building-workspace']} ${progress.acquisition.markdownFileCount.toLocaleString()} Markdown ${
            progress.acquisition.markdownFileCount === 1 ? 'file' : 'files'
          }`;
    }
    return message;
  }
  if (
    stage !== 'building-workspace' ||
    progress?.markdownFileCount === undefined
  ) {
    return message;
  }
  return `${message} ${progress.markdownFileCount.toLocaleString()} Markdown ${
    progress.markdownFileCount === 1 ? 'file' : 'files'
  }`;
}
