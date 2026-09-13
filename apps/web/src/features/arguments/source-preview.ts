import type {
  ArgumentRecordKind,
  ReadLinkedTheorySourceResult,
  SnapshotDescriptor,
  TheorySourceReference,
} from '@icarus-graph-explorer/argument-workspace';

import type { ArgumentSourceIdentity } from './source-capture';

export interface ArgumentSourcePreview {
  readonly recordKind: Extract<
    ArgumentRecordKind,
    'axiom' | 'counter-argument'
  >;
  readonly recordId: string;
  readonly reference: TheorySourceReference;
  readonly source: ArgumentSourceIdentity;
  readonly library: SnapshotDescriptor;
  readonly result: ReadLinkedTheorySourceResult;
}

export function argumentSourcePreviewKey(
  preview: Pick<ArgumentSourcePreview, 'recordKind' | 'recordId' | 'reference'>,
): string {
  return `${preview.recordKind}\0${preview.recordId}\0${preview.reference.id}`;
}
