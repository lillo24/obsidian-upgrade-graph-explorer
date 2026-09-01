import { parseGraphQuery } from '@icarus-graph-explorer/graph-query';
import {
  MAX_VISUAL_GROUP_NAME_LENGTH,
  type VisualGroupColor,
  type VisualGroupDefinition,
} from '@icarus-graph-explorer/visual-groups';

export interface VisualGroupDraft {
  readonly name: string;
  readonly query: string;
  readonly color: VisualGroupColor;
  readonly enabled: boolean;
}

export type PreparedVisualGroupDefinition =
  | { readonly ok: true; readonly value: VisualGroupDefinition }
  | {
      readonly ok: false;
      readonly field: 'name' | 'query';
      readonly message: string;
    };

/** Validates only the submitted draft; rendered entities use compiled QUERY1. */
export function prepareVisualGroupDefinition(
  draft: VisualGroupDraft,
): PreparedVisualGroupDefinition {
  const name = draft.name.trim();
  if (name.length === 0) {
    return { ok: false, field: 'name', message: 'Name is required.' };
  }
  if (name.length > MAX_VISUAL_GROUP_NAME_LENGTH) {
    return {
      ok: false,
      field: 'name',
      message: `Name must contain at most ${MAX_VISUAL_GROUP_NAME_LENGTH} characters.`,
    };
  }
  const parsed = parseGraphQuery(draft.query.trim());
  if (!parsed.valid) {
    const first = parsed.issues[0];
    return {
      ok: false,
      field: 'query',
      message:
        first === undefined
          ? 'The Visual Group rule is invalid.'
          : `Character ${first.position + 1}: ${first.message}`,
    };
  }
  return {
    ok: true,
    value: {
      name,
      query: parsed.canonical,
      color: draft.color,
      enabled: draft.enabled,
    },
  };
}
