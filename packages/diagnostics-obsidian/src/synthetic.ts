import type {
  SyntheticSourceDocument,
  SyntheticWorkspaceConfig,
} from './types';

function positiveInteger(value: number, name: string, minimum: number): void {
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(
      `${name} must be an integer greater than or equal to ${minimum}.`,
    );
  }
}

function repeatedReference(target: string, count: number): string {
  return Array.from({ length: count }, () => `[[${target}]]`).join(' ');
}

/** Generate repeatable Markdown source for non-gating pipeline measurements. */
export function generateSyntheticWorkspace(
  config: SyntheticWorkspaceConfig,
): readonly SyntheticSourceDocument[] {
  positiveInteger(config.documentCount, 'documentCount', 3);
  positiveInteger(config.sectionsPerDocument, 'sectionsPerDocument', 1);
  positiveInteger(config.nestedDepth, 'nestedDepth', 1);
  if (config.nestedDepth > 6) {
    throw new Error('nestedDepth must not exceed Markdown heading level 6.');
  }
  positiveInteger(
    config.resolvedReferencesPerSection,
    'resolvedReferencesPerSection',
    0,
  );
  positiveInteger(
    config.unresolvedReferencesPerSection,
    'unresolvedReferencesPerSection',
    0,
  );
  positiveInteger(
    config.ambiguousReferencesPerSection,
    'ambiguousReferencesPerSection',
    0,
  );

  return Array.from(
    { length: config.documentCount },
    (_value, documentIndex) => {
      const path =
        documentIndex === 0
          ? 'ambiguous-a/Shared.md'
          : documentIndex === 1
            ? 'ambiguous-b/Shared.md'
            : `notes/Document-${documentIndex.toString().padStart(4, '0')}.md`;
      const lines: string[] = [];
      for (
        let sectionIndex = 0;
        sectionIndex < config.sectionsPerDocument;
        sectionIndex += 1
      ) {
        const level = (sectionIndex % config.nestedDepth) + 1;
        lines.push(
          `${'#'.repeat(level)} Section ${documentIndex}-${sectionIndex}`,
          [
            repeatedReference(
              'notes/Document-0002',
              config.resolvedReferencesPerSection,
            ),
            repeatedReference(
              `Missing-${documentIndex}-${sectionIndex}`,
              config.unresolvedReferencesPerSection,
            ),
            repeatedReference('Shared', config.ambiguousReferencesPerSection),
          ]
            .filter((value) => value.length > 0)
            .join(' '),
          `Synthetic marker ^block-${documentIndex}-${sectionIndex}`,
          '',
        );
      }
      return { path, source: lines.join('\n') };
    },
  );
}
