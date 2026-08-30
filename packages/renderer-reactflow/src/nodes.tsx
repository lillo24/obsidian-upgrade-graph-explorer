import { memo, type KeyboardEvent, type MouseEvent } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

import { useEntityDisclosure } from './disclosure-context';
import { shouldToggleDisclosureForClick } from './focus-interaction';
import type { DiagnosticFlowNode, EntityFlowNode } from './types';

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
  const toggleEntity = useEntityDisclosure();

  function handleDisclosure(event: MouseEvent<HTMLButtonElement>): void {
    event.stopPropagation();
    if (!shouldToggleDisclosureForClick(event.detail)) return;
    toggleEntity(data.entityId, data.isExpanded);
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
      toggleEntity(data.entityId, data.isExpanded);
    }
  }

  function keepDisclosureKeyUpLocal(
    event: KeyboardEvent<HTMLButtonElement>,
  ): void {
    event.stopPropagation();
  }

  const disclosureCount = data.isExpanded
    ? data.visibleDescendantCount
    : data.hiddenDescendantCount;
  const disclosureDescription = data.isExpanded
    ? `${disclosureCount} visible descendants`
    : `${disclosureCount} hidden descendants`;
  const hasFooter =
    data.internalReferenceCount > 0 ||
    data.hasHiddenChildren ||
    data.isExpanded;
  const hasDisclosure = data.hasHiddenChildren || data.isExpanded;
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
          {data.hasHiddenChildren || data.isExpanded ? (
            <button
              aria-label={`${data.isExpanded ? 'Collapse' : 'Expand'} ${data.title}; ${disclosureDescription}`}
              className="entity-disclosure nodrag nopan"
              onClick={handleDisclosure}
              onDoubleClick={keepDisclosureDoubleClickLocal}
              onKeyDown={handleDisclosureKey}
              onKeyUp={keepDisclosureKeyUpLocal}
              type="button"
            >
              <span aria-hidden="true">{data.isExpanded ? '⌄' : '›'}</span>
              <span>{disclosureCount}</span>
            </button>
          ) : null}
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
