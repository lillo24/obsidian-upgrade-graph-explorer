import { describeArgumentLibrary } from './canonical';
import { createContextResolver, resolveArgumentBackground } from './contexts';
import type {
  ArgumentLibrary,
  ArgumentMarkdownExport,
  TheorySourceReference,
} from './types';
import { assertValidArgumentLibrary } from './validation';

const WINDOWS_RESERVED = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu;

export function safeMarkdownFileName(title: string, id: string): string {
  const safeTitle = title
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\p{Cc}]/gu, '-')
    .replace(/\s+/gu, ' ')
    .replace(/[. ]+$/gu, '')
    .trim()
    .slice(0, 80);
  const base =
    safeTitle === '' || WINDOWS_RESERVED.test(safeTitle) ? 'record' : safeTitle;
  const safeId = id
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 48);
  return `${base}--${safeId === '' ? 'id' : safeId}.md`;
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

export function formatTheorySourceLocator(
  reference: TheorySourceReference,
): string {
  if (reference.originalWikilink !== undefined)
    return reference.originalWikilink;
  const fragments = [
    ...(reference.heading === undefined ? [] : [reference.heading]),
    ...(reference.block === undefined ? [] : [`^${reference.block}`]),
  ];
  const target = `${reference.path.replace(/\.md$/iu, '')}${
    fragments.length === 0 ? '' : `#${fragments.join('#')}`
  }`;
  return `[[${target}|${reference.label}]]`;
}

function frontmatter(
  values: Readonly<Record<string, string | number | boolean>>,
): string {
  return [
    '---',
    ...Object.entries(values).map(([key, value]) =>
      typeof value === 'string'
        ? `${key}: ${yamlString(value)}`
        : `${key}: ${String(value)}`,
    ),
    '---',
  ].join('\n');
}

export function exportArgumentLibraryMarkdown(
  candidate: ArgumentLibrary,
): ArgumentMarkdownExport {
  const library = assertValidArgumentLibrary(candidate);
  const topicFiles = new Map(
    library.topics.map((record) => [
      record.id,
      safeMarkdownFileName(record.title, record.id),
    ]),
  );
  const axiomFiles = new Map(
    library.axioms.map((record) => [
      record.id,
      safeMarkdownFileName(record.title, record.id),
    ]),
  );
  const contextFiles = new Map(
    library.contexts.map((record) => [
      record.id,
      safeMarkdownFileName(record.title, record.id),
    ]),
  );
  const argumentFiles = new Map(
    library.arguments.map((record) => [
      record.id,
      safeMarkdownFileName(record.title, record.id),
    ]),
  );
  const counterFiles = new Map(
    library.counterArguments.map((record) => [
      record.id,
      safeMarkdownFileName(record.title, record.id),
    ]),
  );
  const axiomTitles = new Map(
    library.axioms.map(({ id, title }) => [id, title]),
  );
  const argumentTitles = new Map(
    library.arguments.map(({ id, title }) => [id, title]),
  );
  const contextTitles = new Map(
    library.contexts.map(({ id, title }) => [id, title]),
  );
  const resolveContext = createContextResolver(library);
  const counterTitles = new Map(
    library.counterArguments.map(({ id, title }) => [id, title]),
  );
  const files = [
    ...library.topics.map((topic) => ({
      path: `topics/${topicFiles.get(topic.id)!}`,
      text: `${[
        frontmatter({
          type: 'argument-topic',
          id: topic.id,
          revision: topic.revision,
          reviewState: topic.reviewState,
          archived: topic.archived,
        }),
        '',
        `# ${topic.title}`,
        '',
        topic.summary,
        '',
        '## Axioms',
        '',
        ...(topic.axiomIds.length === 0
          ? ['_None._']
          : topic.axiomIds.map(
              (id) =>
                `- [[axioms/${axiomFiles.get(id)!}|${axiomTitles.get(id)!}]] (${id})`,
            )),
        '',
        '## Current Argument',
        '',
        ...(topic.currentArgumentId === undefined
          ? ['_None._']
          : [
              `[[arguments/${argumentFiles.get(topic.currentArgumentId)!}|${argumentTitles.get(topic.currentArgumentId)!}]] (${topic.currentArgumentId})`,
            ]),
        '',
        '## Arguments',
        '',
        ...(topic.argumentIds.length === 0
          ? ['_None._']
          : topic.argumentIds.map(
              (id) =>
                `- [[arguments/${argumentFiles.get(id)!}|${argumentTitles.get(id)!}]] (${id})${id === topic.currentArgumentId ? ' — Current' : ''}`,
            )),
        '',
        '## Counter-Arguments',
        '',
        ...(topic.counterArgumentIds.length === 0
          ? ['_None._']
          : topic.counterArgumentIds.map(
              (id) =>
                `- [[counter-arguments/${counterFiles.get(id)!}|${counterTitles.get(id)!}]] (${id})`,
            )),
      ].join('\n')}\n`,
    })),
    ...library.contexts.map((context) => {
      const resolved = resolveContext(context.id);
      return {
        path: `contexts/${contextFiles.get(context.id)!}`,
        text: `${[
          frontmatter({
            type: 'argument-context',
            id: context.id,
            revision: context.revision,
            reviewState: context.reviewState,
            archived: context.archived,
          }),
          '',
          `# ${context.title}`,
          ...(context.description === undefined
            ? []
            : ['', '## Description', '', context.description]),
          '',
          '## Parent Context',
          '',
          ...(context.parentContextId === undefined
            ? ['_None._']
            : [
                `[[contexts/${contextFiles.get(context.parentContextId)!}|${contextTitles.get(context.parentContextId)!}]] (${context.parentContextId})`,
              ]),
          '',
          '## Direct Axioms',
          '',
          ...(context.axiomIds.length === 0
            ? ['_None._']
            : context.axiomIds.map(
                (id) =>
                  `- [[axioms/${axiomFiles.get(id)!}|${axiomTitles.get(id)!}]] (${id})`,
              )),
          '',
          '## Inherited Axioms',
          '',
          ...(resolved.inheritedAxiomIds.length === 0
            ? ['_None._']
            : resolved.inheritedAxiomIds.map(
                (id) =>
                  `- [[axioms/${axiomFiles.get(id)!}|${axiomTitles.get(id)!}]] (${id})`,
              )),
          '',
          '## Effective Axioms',
          '',
          ...(resolved.effectiveAxiomIds.length === 0
            ? ['_None._']
            : resolved.effectiveAxiomIds.map(
                (id) =>
                  `- [[axioms/${axiomFiles.get(id)!}|${axiomTitles.get(id)!}]] (${id})`,
              )),
        ].join('\n')}\n`,
      };
    }),
    ...library.axioms.map((axiom) => ({
      path: `axioms/${axiomFiles.get(axiom.id)!}`,
      text: `${[
        frontmatter({
          type: 'argument-axiom',
          id: axiom.id,
          revision: axiom.revision,
          reviewState: axiom.reviewState,
          archived: axiom.archived,
        }),
        '',
        `# ${axiom.title}`,
        '',
        '## Statement',
        '',
        axiom.statement,
        ...(axiom.explanation === undefined
          ? []
          : ['', '## Explanation', '', axiom.explanation]),
        ...(axiom.scope === undefined ? [] : ['', '## Scope', '', axiom.scope]),
        ...(axiom.supportingReasoning === undefined
          ? []
          : ['', '## Supporting reasoning', '', axiom.supportingReasoning]),
        '',
        '## Theory sources',
        '',
        ...(axiom.sourceReferences.length === 0
          ? ['_None._']
          : axiom.sourceReferences.map(
              (reference) =>
                `- ${formatTheorySourceLocator(reference)} — ${reference.role} (${reference.id})`,
            )),
      ].join('\n')}\n`,
    })),
    ...library.arguments.map((argument) => {
      const background = resolveArgumentBackground(
        library,
        argument.contextIds,
      );
      return {
        path: `arguments/${argumentFiles.get(argument.id)!}`,
        text: `${[
          frontmatter({
            type: 'argument',
            id: argument.id,
            revision: argument.revision,
            reviewState: argument.reviewState,
            archived: argument.archived,
          }),
          '',
          `# ${argument.title}`,
          '',
          '## Contexts (background, not premises)',
          '',
          ...(argument.contextIds.length === 0
            ? ['_None._']
            : argument.contextIds.map(
                (id) =>
                  `- [[contexts/${contextFiles.get(id)!}|${contextTitles.get(id)!}]] (${id})`,
              )),
          '',
          '### Effective background Axioms',
          '',
          ...(background.axioms.length === 0
            ? ['_None._']
            : background.axioms.map(
                ({ axiomId, viaContextIds }) =>
                  `- [[axioms/${axiomFiles.get(axiomId)!}|${axiomTitles.get(axiomId)!}]] (${axiomId}; via ${viaContextIds.join(', ')})`,
              )),
          '',
          '## Examples',
          '',
          ...(argument.examples.length === 0
            ? ['_None._']
            : argument.examples.map(
                (example, index) =>
                  `${index + 1}. **${example.id}** — ${example.text}`,
              )),
          '',
          '## Premises',
          '',
          ...(argument.premises.length === 0
            ? ['_None._']
            : argument.premises.map((premise, index) => {
                const exampleLinks =
                  premise.exampleIds === undefined ||
                  premise.exampleIds.length === 0
                    ? ''
                    : ` [Examples: ${premise.exampleIds.join(', ')}]`;
                const prefix = `${index + 1}. **${premise.id}**${exampleLinks} — `;
                if (premise.kind === 'text') return `${prefix}${premise.text}`;
                if (premise.kind === 'axiom') {
                  return `${prefix}[[axioms/${axiomFiles.get(premise.axiomId)!}|${axiomTitles.get(premise.axiomId)!}]] (${premise.axiomId}, relied on revision ${premise.reliedOnRevision})`;
                }
                if (premise.kind === 'argument-conclusion') {
                  return `${prefix}[[arguments/${argumentFiles.get(premise.argumentId)!}|${argumentTitles.get(premise.argumentId)!}]] conclusion (${premise.argumentId}, relied on revision ${premise.reliedOnRevision})`;
                }
                return `${prefix}[[arguments/${argumentFiles.get(premise.argumentId)!}|${argumentTitles.get(premise.argumentId)!}]] premise ${premise.premiseId} (${premise.argumentId}, relied on revision ${premise.reliedOnRevision})`;
              })),
          ...(argument.reasoning === undefined
            ? []
            : ['', '## Reasoning', '', argument.reasoning]),
          '',
          '## Conclusion',
          '',
          argument.conclusion,
          ...(argument.boundary === undefined
            ? []
            : ['', '## Boundary / Invariance', '', argument.boundary]),
          '',
          '## Argument relations',
          '',
          ...(argument.relations.length === 0
            ? ['_None._']
            : argument.relations.map((relation) => {
                const part =
                  relation.targetPart.kind === 'premise'
                    ? `premise ${relation.targetPart.premiseId}`
                    : relation.targetPart.kind;
                return `- **${relation.id}** — ${relation.kind} [[arguments/${argumentFiles.get(relation.targetArgumentId)!}|${argumentTitles.get(relation.targetArgumentId)!}]].${part} (${relation.targetArgumentId}, relied on revision ${relation.reliedOnRevision})`;
              })),
          ...(argument.supersedesArgumentId === undefined
            ? []
            : [
                '',
                '## Supersedes',
                '',
                `[[arguments/${argumentFiles.get(argument.supersedesArgumentId)!}|${argumentTitles.get(argument.supersedesArgumentId)!}]] (${argument.supersedesArgumentId})`,
              ]),
          '',
          '## Theory sources',
          '',
          ...(argument.sourceReferences.length === 0
            ? ['_None._']
            : argument.sourceReferences.map(
                (reference) =>
                  `- ${formatTheorySourceLocator(reference)} — ${reference.role} (${reference.id})`,
              )),
        ].join('\n')}\n`,
      };
    }),
    ...library.counterArguments.map((counter) => {
      const target =
        counter.target === undefined
          ? '_No structured target recorded._'
          : counter.target.kind === 'topic-claim'
            ? `Topic claim: ${counter.target.topicId}`
            : counter.target.kind === 'axiom'
              ? `Axiom: ${counter.target.axiomId}`
              : counter.target.kind === 'counter-argument'
                ? `Counter-Argument: ${counter.target.counterArgumentId}`
                : `Argument: ${counter.target.argumentId} (${counter.target.part.kind}${
                    counter.target.part.kind === 'premise'
                      ? ` ${counter.target.part.premiseId}`
                      : ''
                  })`;
      return {
        path: `counter-arguments/${counterFiles.get(counter.id)!}`,
        text: `${[
          frontmatter({
            type: 'argument-counter-argument',
            id: counter.id,
            revision: counter.revision,
            reviewState: counter.reviewState,
            archived: counter.archived,
            outcome: counter.response.outcome,
          }),
          '',
          `# ${counter.title}`,
          '',
          '## Observation / example',
          '',
          counter.observation,
          '',
          '## Challenged claim',
          '',
          counter.challengedClaim,
          '',
          '## Structured target',
          '',
          target,
          '',
          '## Recorded response',
          '',
          counter.response.explanation === ''
            ? '_No response recorded._'
            : counter.response.explanation,
          '',
          `**Outcome:** ${counter.response.outcome}`,
          '',
          '**Answering Axioms:**',
          '',
          ...(counter.response.answeringAxioms.length === 0
            ? ['_None._']
            : counter.response.answeringAxioms.map(
                ({ axiomId, reliedOnRevision }) =>
                  `- [[axioms/${axiomFiles.get(axiomId)!}|${axiomTitles.get(axiomId)!}]] (${axiomId}, assessed at revision ${reliedOnRevision})`,
              )),
          ...(counter.response.boundary === undefined
            ? []
            : [
                '',
                '## Boundary / unresolved remainder',
                '',
                counter.response.boundary,
              ]),
          ...(counter.response.reopeningCondition === undefined
            ? []
            : [
                '',
                '## Reopening condition',
                '',
                counter.response.reopeningCondition,
              ]),
          '',
          '## Theory sources',
          '',
          ...(counter.sourceReferences.length === 0
            ? ['_None._']
            : counter.sourceReferences.map(
                (reference) =>
                  `- ${formatTheorySourceLocator(reference)} — ${reference.role} (${reference.id})`,
              )),
        ].join('\n')}\n`,
      };
    }),
  ].sort((left, right) => left.path.localeCompare(right.path));
  return { files, snapshot: describeArgumentLibrary(library) };
}
