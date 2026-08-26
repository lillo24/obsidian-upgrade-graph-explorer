import type { SyntheticWorkspaceConfig } from '@icarus-graph-explorer/diagnostics-obsidian';

export const BENCHMARK_PROFILES = {
  smoke: {
    documentCount: 4,
    sectionsPerDocument: 2,
    nestedDepth: 2,
    resolvedReferencesPerSection: 1,
    unresolvedReferencesPerSection: 1,
    ambiguousReferencesPerSection: 1,
  },
  small: {
    documentCount: 100,
    sectionsPerDocument: 4,
    nestedDepth: 2,
    resolvedReferencesPerSection: 1,
    unresolvedReferencesPerSection: 1,
    ambiguousReferencesPerSection: 1,
  },
  medium: {
    documentCount: 500,
    sectionsPerDocument: 8,
    nestedDepth: 4,
    resolvedReferencesPerSection: 2,
    unresolvedReferencesPerSection: 1,
    ambiguousReferencesPerSection: 1,
  },
  large: {
    documentCount: 2_000,
    sectionsPerDocument: 10,
    nestedDepth: 5,
    resolvedReferencesPerSection: 2,
    unresolvedReferencesPerSection: 1,
    ambiguousReferencesPerSection: 1,
  },
} as const satisfies Readonly<Record<string, SyntheticWorkspaceConfig>>;

export type BenchmarkProfile = keyof typeof BENCHMARK_PROFILES;

export function isBenchmarkProfile(value: string): value is BenchmarkProfile {
  return Object.hasOwn(BENCHMARK_PROFILES, value);
}
