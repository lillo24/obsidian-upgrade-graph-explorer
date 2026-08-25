import type { EntityId } from './ids';
import type { SourceLocation } from './source';

export type EntityKind = 'document' | 'section' | 'block';

interface SourceBackedEntity {
  readonly id: EntityId;
  readonly source: SourceLocation;
}

/** A Markdown document is the structural root for one workspace-relative file. */
export interface DocumentEntity extends SourceBackedEntity {
  readonly kind: 'document';
}

/**
 * A heading-backed section. Its parent is its document or a containing section.
 * Titles are source content, not identity, and may be empty or duplicated.
 */
export interface SectionEntity extends SourceBackedEntity {
  readonly kind: 'section';
  readonly parentId: EntityId;
  readonly title: string;
  readonly level: number;
}

/**
 * An optional addressable source block owned by a document or section.
 * Adapter-specific block labels do not belong in the generic contract yet.
 */
export interface BlockEntity extends SourceBackedEntity {
  readonly kind: 'block';
  readonly parentId: EntityId;
}

export type AddressableEntity = DocumentEntity | SectionEntity | BlockEntity;
