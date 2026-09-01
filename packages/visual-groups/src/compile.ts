import type { AddressableEntity } from '@icarus-graph-explorer/core';
import {
  matchesGraphQuery,
  parseGraphQuery,
  type GraphQueryExpression,
} from '@icarus-graph-explorer/graph-query';

import { isVisualGroupColor, visualGroupPaletteEntry } from './palette';
import type {
  VisualGroupDefinition,
  VisualGroupDefinitionValidationResult,
  VisualGroupMatch,
  VisualGroupNodePresentation,
  VisualGroupPresentationMap,
  VisualGroupValidationIssue,
} from './types';

export const MAX_VISUAL_GROUPS = 24;
export const MAX_VISUAL_GROUP_NAME_LENGTH = 64;

interface PreparedDefinition {
  readonly definition: VisualGroupDefinition;
  readonly expression: GraphQueryExpression;
}

interface PreparedDefinitionsResult {
  readonly definitions: readonly PreparedDefinition[];
  readonly issues: readonly VisualGroupValidationIssue[];
}

const COMPILED_RULES: unique symbol = Symbol('compiled-visual-group-rules');

interface CompiledVisualGroupRule extends PreparedDefinition {
  readonly presentation: VisualGroupNodePresentation;
}

/** Opaque compiled evaluator. QUERY1 expressions never cross into renderers. */
export interface CompiledVisualGroups {
  readonly definitions: readonly VisualGroupDefinition[];
  readonly activeGroupCount: number;
  readonly [COMPILED_RULES]: readonly CompiledVisualGroupRule[];
}

export type VisualGroupCompilationResult =
  | { readonly ok: true; readonly value: CompiledVisualGroups }
  | {
      readonly ok: false;
      readonly issues: readonly VisualGroupValidationIssue[];
    };

function issue(
  code: VisualGroupValidationIssue['code'],
  path: string,
  message: string,
): VisualGroupValidationIssue {
  return { code, path, message };
}

function prepareDefinitions(value: unknown): PreparedDefinitionsResult {
  if (!Array.isArray(value)) {
    return {
      definitions: [],
      issues: [
        issue(
          'expected-array',
          'groups',
          'Expected an array of Visual Group definitions.',
        ),
      ],
    };
  }
  if (value.length > MAX_VISUAL_GROUPS) {
    return {
      definitions: [],
      issues: [
        issue(
          'too-many-groups',
          'groups',
          `A workspace may contain at most ${MAX_VISUAL_GROUPS} Visual Groups.`,
        ),
      ],
    };
  }

  const definitions: PreparedDefinition[] = [];
  const issues: VisualGroupValidationIssue[] = [];
  const names = new Set<string>();
  for (const [index, candidate] of value.entries()) {
    const path = `groups[${index}]`;
    if (
      typeof candidate !== 'object' ||
      candidate === null ||
      Array.isArray(candidate)
    ) {
      issues.push(
        issue('expected-object', path, 'Expected a Visual Group object.'),
      );
      continue;
    }
    const record = candidate as Record<string, unknown>;
    if (Object.keys(record).sort().join(',') !== 'color,enabled,name,query') {
      issues.push(
        issue(
          'incompatible-fields',
          path,
          'Visual Group fields must be exactly name, query, color, and enabled.',
        ),
      );
      continue;
    }

    let candidateValid = true;
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    if (
      typeof record.name !== 'string' ||
      name.length < 1 ||
      name.length > MAX_VISUAL_GROUP_NAME_LENGTH
    ) {
      candidateValid = false;
      issues.push(
        issue(
          'invalid-name',
          `${path}.name`,
          `Visual Group names must contain 1 to ${MAX_VISUAL_GROUP_NAME_LENGTH} trimmed characters.`,
        ),
      );
    } else {
      const foldedName = name.toLowerCase();
      if (names.has(foldedName)) {
        candidateValid = false;
        issues.push(
          issue(
            'duplicate-name',
            `${path}.name`,
            `Visual Group name ${JSON.stringify(name)} is duplicated.`,
          ),
        );
      } else {
        names.add(foldedName);
      }
    }

    let canonicalQuery = '';
    let expression: GraphQueryExpression | undefined;
    if (typeof record.query !== 'string') {
      candidateValid = false;
      issues.push(
        issue(
          'invalid-query',
          `${path}.query`,
          'Visual Groups require a valid QUERY1 query string.',
        ),
      );
    } else {
      const parsed = parseGraphQuery(record.query);
      if (!parsed.valid) {
        candidateValid = false;
        issues.push(
          issue(
            'invalid-query',
            `${path}.query`,
            parsed.issues[0]?.message ?? 'Visual Group query is invalid.',
          ),
        );
      } else {
        canonicalQuery = parsed.canonical;
        expression = parsed.expression;
      }
    }

    if (!isVisualGroupColor(record.color)) {
      candidateValid = false;
      issues.push(
        issue(
          'invalid-color',
          `${path}.color`,
          `Unsupported Visual Group color token ${JSON.stringify(record.color)}.`,
        ),
      );
    }
    if (typeof record.enabled !== 'boolean') {
      candidateValid = false;
      issues.push(
        issue(
          'invalid-enabled',
          `${path}.enabled`,
          'Visual Group enabled must be a boolean.',
        ),
      );
    }
    if (
      !candidateValid ||
      expression === undefined ||
      !isVisualGroupColor(record.color) ||
      typeof record.enabled !== 'boolean'
    ) {
      continue;
    }
    definitions.push({
      definition: {
        name,
        query: canonicalQuery,
        color: record.color,
        enabled: record.enabled,
      },
      expression,
    });
  }
  return { definitions, issues };
}

export function validateAndCanonicalizeVisualGroupDefinitions(
  value: unknown,
): VisualGroupDefinitionValidationResult {
  const prepared = prepareDefinitions(value);
  return prepared.issues.length > 0
    ? { valid: false, issues: prepared.issues }
    : {
        valid: true,
        value: prepared.definitions.map(({ definition }) => definition),
        issues: [],
      };
}

export function compileVisualGroups(
  value: unknown,
): VisualGroupCompilationResult {
  const prepared = prepareDefinitions(value);
  if (prepared.issues.length > 0) {
    return { ok: false, issues: prepared.issues };
  }
  const activeRules = prepared.definitions
    .filter(({ definition }) => definition.enabled)
    .map(({ definition, expression }): CompiledVisualGroupRule => ({
      definition,
      expression,
      presentation: {
        groupName: definition.name,
        color: definition.color,
        accent: visualGroupPaletteEntry(definition.color).accent,
      },
    }));
  return {
    ok: true,
    value: {
      definitions: prepared.definitions.map(({ definition }) => definition),
      activeGroupCount: activeRules.length,
      [COMPILED_RULES]: activeRules,
    },
  };
}

export function resolvePrimaryVisualGroup(
  entity: AddressableEntity,
  compiled: CompiledVisualGroups,
): VisualGroupMatch | undefined {
  for (const rule of compiled[COMPILED_RULES]) {
    if (matchesGraphQuery(entity, rule.expression)) {
      return {
        definition: rule.definition,
        presentation: rule.presentation,
      };
    }
  }
  return undefined;
}

export function matchingVisualGroupsForEntity(
  entity: AddressableEntity,
  compiled: CompiledVisualGroups,
): readonly VisualGroupMatch[] {
  const matches: VisualGroupMatch[] = [];
  for (const rule of compiled[COMPILED_RULES]) {
    if (!matchesGraphQuery(entity, rule.expression)) continue;
    matches.push({
      definition: rule.definition,
      presentation: rule.presentation,
    });
  }
  return matches;
}

export function assignPrimaryVisualGroupPresentations(
  entities: Iterable<AddressableEntity>,
  compiled: CompiledVisualGroups,
): VisualGroupPresentationMap {
  const presentations = new Map<
    AddressableEntity['id'],
    VisualGroupNodePresentation
  >();
  const seenEntityIds = new Set<AddressableEntity['id']>();
  for (const entity of entities) {
    if (seenEntityIds.has(entity.id)) {
      throw new Error(
        `Cannot assign Visual Group presentation for duplicate entity ID ${JSON.stringify(entity.id)}.`,
      );
    }
    seenEntityIds.add(entity.id);
    const match = resolvePrimaryVisualGroup(entity, compiled);
    if (match !== undefined) presentations.set(entity.id, match.presentation);
  }
  return presentations;
}
