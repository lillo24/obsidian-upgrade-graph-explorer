export type GraphSettingsTab = 'preferences' | 'sandbox' | 'source';

const SETTINGS_TABS: readonly GraphSettingsTab[] = [
  'preferences',
  'sandbox',
  'source',
];

export function graphSettingsTabForKey(
  current: GraphSettingsTab,
  key: string,
): GraphSettingsTab | undefined {
  switch (key) {
    case 'ArrowLeft': {
      const index = SETTINGS_TABS.indexOf(current);
      return SETTINGS_TABS[
        (index - 1 + SETTINGS_TABS.length) % SETTINGS_TABS.length
      ];
    }
    case 'ArrowRight': {
      const index = SETTINGS_TABS.indexOf(current);
      return SETTINGS_TABS[(index + 1) % SETTINGS_TABS.length];
    }
    case 'Home':
      return 'preferences';
    case 'End':
      return 'source';
    default:
      return undefined;
  }
}
