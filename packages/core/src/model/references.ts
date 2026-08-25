import type { EntityId, ReferenceId } from './ids';
import type { SourceSpan } from './source';

export type ReferenceKind = 'link' | 'embed';

export type ReferenceResolution =
  | {
      readonly status: 'resolved';
      readonly targetEntityId: EntityId;
    }
  | {
      readonly status: 'unresolved';
      readonly reason?: string;
    }
  | {
      readonly status: 'ambiguous';
      readonly candidateEntityIds: readonly EntityId[];
      readonly reason?: string;
    }
  | {
      readonly status: 'invalid';
      readonly reason: string;
    };

/**
 * Exact source provenance is independent from the resolution result.
 * The source entity determines the file; sourceSpan locates the reference text.
 */
export interface Reference {
  readonly id: ReferenceId;
  readonly kind: ReferenceKind;
  readonly sourceEntityId: EntityId;
  readonly rawTarget: string;
  readonly sourceSpan: SourceSpan;
  readonly resolution: ReferenceResolution;
}
