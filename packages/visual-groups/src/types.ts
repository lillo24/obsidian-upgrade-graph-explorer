import type { EntityId } from '@icarus-graph-explorer/core';

export type VisualGroupColor =
  'teal' | 'blue' | 'violet' | 'magenta' | 'red' | 'orange' | 'amber' | 'green';

export interface VisualGroupDefinition {
  readonly name: string;
  readonly query: string;
  readonly color: VisualGroupColor;
  readonly enabled: boolean;
}

export interface VisualGroupPaletteEntry {
  readonly token: VisualGroupColor;
  readonly label: string;
  readonly accent: string;
}

/** Resolved, query-free data safe for any renderer to consume. */
export interface VisualGroupNodePresentation {
  readonly groupName: string;
  readonly color: VisualGroupColor;
  readonly accent: string;
}

export type VisualGroupPresentationMap = ReadonlyMap<
  EntityId,
  VisualGroupNodePresentation
>;

export interface VisualGroupMatch {
  readonly definition: VisualGroupDefinition;
  readonly presentation: VisualGroupNodePresentation;
}

export type VisualGroupValidationIssueCode =
  | 'expected-array'
  | 'too-many-groups'
  | 'expected-object'
  | 'incompatible-fields'
  | 'invalid-name'
  | 'duplicate-name'
  | 'invalid-query'
  | 'invalid-color'
  | 'invalid-enabled';

export interface VisualGroupValidationIssue {
  readonly code: VisualGroupValidationIssueCode;
  readonly path: string;
  readonly message: string;
}

export type VisualGroupDefinitionValidationResult =
  | {
      readonly valid: true;
      readonly value: readonly VisualGroupDefinition[];
      readonly issues: readonly [];
    }
  | {
      readonly valid: false;
      readonly issues: readonly VisualGroupValidationIssue[];
    };
