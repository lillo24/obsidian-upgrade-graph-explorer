import { memo, type KeyboardEvent, type MouseEvent } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

import { useEntityDisclosure } from './disclosure-context';
import { shouldToggleDisclosureForClick } from './focus-interaction';
import type { DiagnosticFlowNode, EntityFlowNode } from './types';

export interface EntityDisclosurePresentation {
  readonly action: 'expand' | 'collapse';
  readonly ariaLabel: string;
  readonly count: number;
  readonly symbol: '›' | '⌄';
}

export function entityDisclosurePresentation(
  data: Pick<
    EntityFlowNode['data'],
    | 'isExpanded'
    | 'revealableDescendantCount'
    | 'title'
    | 'visibleDescendantCount'
  >,
): EntityDisclosurePresentation | null {
  if (data.isExpanded && data.visibleDescendantCount > 0) {
    const noun =
      data.visibleDescendantCount === 1 ? 'descendant' : 'descendants';
    return {
      action: 'collapse',
      ariaLabel: `Collapse ${data.title}; hides ${data.visibleDescendantCount} visible ${noun}`,
      count: data.visibleDescendantCount,
      symbol: '⌄',
    };
  }
  if (!data.isExpanded && data.revealableDescendantCount > 0) {
    const noun =
      data.revealableDescendantCount === 1 ? 'descendant' : 'descendants';
    return {
      action: 'expand',
      ariaLabel: `Expand ${data.title}; reveals ${data.revealableDescendantCount} ${noun}`,
      count: data.revealableDescendantCount,
      symbol: '›',
    };
  }
  return null;
}

function NodeHandles() {
  return (
    <>
      <Handle id="target-top" position={Position.Top} type="target" />
      <Handle id="source-bottom" position={Position.Bottom} type="source" />
      <Handle id="target-left" position={Position.Left} type="target" />
      <Handle id="source-right" position={Position.Right} type="source" />
    </>
  );
}

function EntityNodeComponent({ data }: NodeProps<EntityFlowNode>) {
  const disclosure = useEntityDisclosure();
  const disclosurePresentation = entityDisclosurePresentation(data);

  function handleDisclosure(event: MouseEvent<HTMLButtonElement>): void {
    event.stopPropagation();
    if (!shouldToggleDisclosureForClick(event.detail)) return;
    disclosure.toggle(
      data.entityId,
      disclosurePresentation?.action === 'collapse',
    );
  }

  function keepDisclosureDoubleClickLocal(
    event: MouseEvent<HTMLButtonElement>,
  ): void {
    event.stopPropagation();
  }

  function handleDisclosureKey(event: KeyboardEvent<HTMLButtonElement>): void {
    event.stopPropagation();
    if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
      event.preventDefault();
      disclosure.toggle(
        data.entityId,
        disclosurePresentation?.action === 'collapse',
      );
    }
  }

  function keepDisclosureKeyUpLocal(
    event: KeyboardEvent<HTMLButtonElement>,
  ): void {
    event.stopPropagation();
  }

  const hasFooter =
    data.internalReferenceCount > 0 || disclosurePresentation !== null;
  const hasDisclosure = disclosurePresentation !== null;
  const sourceLocation =
    data.entityKind === 'document'
      ? data.sourcePath
      : `${data.sourcePath}, line ${data.sourceStartLine}`;
  return (
    <article
      className={`entity-card entity-card--${data.entityKind} entity-card--${data.role}${hasFooter ? ' entity-card--has-footer' : ''}${hasDisclosure ? ' entity-card--has-disclosure' : ''}`}
      data-entity-id={data.entityId}
      data-entity-kind={data.entityKind}
      data-focus-distance={data.focusDistance ?? undefined}
      data-projection-node-id={data.projectionNodeId}
      title={`${data.title} — ${sourceLocation} — Double-click to focus`}
    >
      <NodeHandles />
      <strong className="entity-title">{data.title}</strong>
      {data.detail === null ? null : (
        <span className="entity-detail" title={data.detail} translate="no">
          {data.detail}
        </span>
      )}
      {hasFooter ? (
        <div className="entity-card__footer">
          {data.internalReferenceCount > 0 ? (
            <span
              aria-label={`${data.internalReferenceCount} internal reference${data.internalReferenceCount === 1 ? '' : 's'}`}
              className="internal-reference-badge"
              title="References whose visible endpoints collapse into this node"
            >
              ↺ {data.internalReferenceCount}
            </span>
          ) : null}
          {disclosurePresentation === null ? null : (
            <button
              aria-label={disclosurePresentation.ariaLabel}
              className="entity-disclosure nodrag nopan"
              disabled={disclosure.disabled}
              onClick={handleDisclosure}
              onDoubleClick={keepDisclosureDoubleClickLocal}
              onKeyDown={handleDisclosureKey}
              onKeyUp={keepDisclosureKeyUpLocal}
              type="button"
            >
              <span aria-hidden="true">{disclosurePresentation.symbol}</span>
              <span>{disclosurePresentation.count}</span>
            </button>
          )}
        </div>
      ) : null}
    </article>
  );
}

function DiagnosticNodeComponent({ data }: NodeProps<DiagnosticFlowNode>) {
  const statusSymbol =
    data.status === 'unresolved'
      ? '?'
      : data.status === 'ambiguous'
        ? '≋'
        : '!';
  const metadata =
    data.status === 'ambiguous'
      ? `${data.candidateCount} candidates`
      : data.reasonCount > 0
        ? `${data.reasonCount} reason${data.reasonCount === 1 ? '' : 's'}`
        : 'No target match';
  return (
    <article
      className={`diagnostic-card diagnostic-card--${data.status}`}
      data-projection-node-id={data.projectionNodeId}
    >
      <NodeHandles />
      <div className="diagnostic-card__topline">
        <span className="diagnostic-symbol" aria-hidden="true">
          {statusSymbol}
        </span>
        <strong>{data.status}</strong>
      </div>
      <span className="diagnostic-target" title={data.rawTarget} translate="no">
        {data.rawTarget}
      </span>
      <span className="diagnostic-meta">
        {metadata} · {data.referenceCount}{' '}
        {data.referenceCount === 1 ? 'reference' : 'references'}
      </span>
    </article>
  );
}

export const EntityNode = memo(EntityNodeComponent);
export const DiagnosticNode = memo(DiagnosticNodeComponent);
