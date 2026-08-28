import { memo, type KeyboardEvent, type MouseEvent } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

import { useEntityDisclosure } from './disclosure-context';
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
    toggleEntity(data.entityId, data.isExpanded);
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

  const focusLabel =
    data.focusDistance === null ? null : `Focus distance ${data.focusDistance}`;
  const disclosureCount = data.isExpanded
    ? data.visibleDescendantCount
    : data.hiddenDescendantCount;
  const disclosureDescription = data.isExpanded
    ? `${disclosureCount} visible descendants`
    : `${disclosureCount} hidden descendants`;
  return (
    <article
      className={`entity-card entity-card--${data.entityKind} entity-card--${data.role}`}
      data-projection-node-id={data.projectionNodeId}
    >
      <NodeHandles />
      <div className="entity-card__topline">
        <span className="entity-kind">{data.typeLabel}</span>
        {focusLabel === null ? null : (
          <span className="focus-distance">{focusLabel}</span>
        )}
      </div>
      <strong className="entity-title" title={data.title}>
        {data.title}
      </strong>
      <span className="entity-detail" title={data.detail} translate="no">
        {data.detail}
      </span>
      <div className="entity-card__footer">
        {data.internalReferenceCount > 0 ? (
          <span
            className="internal-reference-badge"
            title="References whose visible endpoints collapse into this node"
          >
            ↺ {data.internalReferenceCount} internal
          </span>
        ) : (
          <span aria-hidden="true" />
        )}
        {data.hasHiddenChildren || data.isExpanded ? (
          <button
            aria-label={`${data.isExpanded ? 'Collapse' : 'Expand'} ${data.title}; ${disclosureDescription}`}
            className="entity-disclosure nodrag nopan"
            onClick={handleDisclosure}
            onKeyDown={handleDisclosureKey}
            onKeyUp={keepDisclosureKeyUpLocal}
            type="button"
          >
            <span aria-hidden="true">{data.isExpanded ? '−' : '+'}</span>
            <span>{disclosureCount}</span>
          </button>
        ) : null}
      </div>
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
