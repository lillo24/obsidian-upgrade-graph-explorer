import { describeArgumentLibrary } from './canonical';
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

function sourceLink(reference: TheorySourceReference): string {
  if (reference.originalWikilink !== undefined)
    return reference.originalWikilink;
  const target = `${reference.path.replace(/\.md$/iu, '')}${
    reference.heading === undefined ? '' : `#${reference.heading}`
  }${reference.block === undefined ? '' : `^${reference.block}`}`;
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
  const counterFiles = new Map(
    library.counterArguments.map((record) => [
      record.id,
      safeMarkdownFileName(record.title, record.id),
    ]),
  );
  const axiomTitles = new Map(
    library.axioms.map(({ id, title }) => [id, title]),
  );
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
                `- ${sourceLink(reference)} — ${reference.role} (${reference.id})`,
            )),
      ].join('\n')}\n`,
    })),
    ...library.counterArguments.map((counter) => {
      const target =
        counter.target === undefined
          ? '_No structured target recorded._'
          : counter.target.kind === 'topic-claim'
            ? `Topic claim: ${counter.target.topicId}`
            : counter.target.kind === 'axiom'
              ? `Axiom: ${counter.target.axiomId}`
              : `Counter-Argument: ${counter.target.counterArgumentId}`;
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
                  `- ${sourceLink(reference)} — ${reference.role} (${reference.id})`,
              )),
        ].join('\n')}\n`,
      };
    }),
  ].sort((left, right) => left.path.localeCompare(right.path));
  return { files, snapshot: describeArgumentLibrary(library) };
}
