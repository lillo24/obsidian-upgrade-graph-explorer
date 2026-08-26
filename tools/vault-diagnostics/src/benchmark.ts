import {
  generateSyntheticWorkspace,
  type SyntheticWorkspaceConfig,
} from '@icarus-graph-explorer/diagnostics-obsidian';

import {
  BENCHMARK_PROFILES,
  isBenchmarkProfile,
  type BenchmarkProfile,
} from './benchmark-config';
import { buildReportFromSources } from './pipeline';

function selectedProfile(args: readonly string[]): BenchmarkProfile {
  const normalizedArgs = args[0] === '--' ? args.slice(1) : args;
  if (normalizedArgs.length === 0) return 'small';
  if (
    normalizedArgs.length !== 2 ||
    normalizedArgs[0] !== '--profile' ||
    normalizedArgs[1] === undefined
  ) {
    throw new Error(
      'Usage: pnpm benchmark:pipeline -- --profile <smoke|small|medium|large>',
    );
  }
  if (!isBenchmarkProfile(normalizedArgs[1])) {
    throw new Error(`Unknown benchmark profile: ${normalizedArgs[1]}`);
  }
  return normalizedArgs[1];
}

function expectedCounts(config: SyntheticWorkspaceConfig) {
  const sections = config.documentCount * config.sectionsPerDocument;
  const referencesPerSection =
    config.resolvedReferencesPerSection +
    config.unresolvedReferencesPerSection +
    config.ambiguousReferencesPerSection;
  return {
    documents: config.documentCount,
    sections,
    blocks: sections,
    references: sections * referencesPerSection,
  };
}

function main(): void {
  const profile = selectedProfile(process.argv.slice(2));
  const config = BENCHMARK_PROFILES[profile];
  const run = buildReportFromSources({
    workspaceId: `synthetic-${profile}`,
    markdownDocuments: generateSyntheticWorkspace(config),
    nonMarkdownPaths: [],
    discoveryReadMs: 0,
  });
  console.log(
    JSON.stringify(
      {
        profile,
        config,
        workload: expectedCounts(config),
        observed: {
          documents: run.summary.documents,
          sections: run.summary.sections,
          blocks: run.summary.blocks,
          references: run.summary.references,
        },
        timingsMs: {
          parseAdapt: run.timings.parseAdaptMs,
          resolution: run.timings.resolutionMs,
          reportConstruction: run.timings.reportConstructionMs,
        },
        note: 'Diagnostic evidence only; no performance budget is enforced.',
      },
      null,
      2,
    ),
  );
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Pipeline benchmark failed: ${message}`);
  process.exitCode = 1;
}
