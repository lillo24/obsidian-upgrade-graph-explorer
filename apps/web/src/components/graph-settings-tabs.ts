export type GraphSettingsTab = 'graph' | 'source';

export function graphSettingsTabForKey(
  current: GraphSettingsTab,
  key: string,
): GraphSettingsTab | undefined {
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowRight':
      return current === 'graph' ? 'source' : 'graph';
    case 'Home':
      return 'graph';
    case 'End':
      return 'source';
    default:
      return undefined;
  }
}
