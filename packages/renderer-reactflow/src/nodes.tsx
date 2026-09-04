import { memo, useEffect, type KeyboardEvent, type MouseEvent } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

import { useEntityDisclosure } from './disclosure-context';
import { shouldToggleDisclosureForClick } from './focus-interaction';
import { useDocumentDirectHover } from './hover-context';
import type {
  DiagnosticFlowNode,
  EntityFlowNode,
  FilteredBridgeFlowNode,
  ModuleBoundaryFlowNode,
} from './types';
import {
  useVisualGroupPresentation,
  visualGroupAccentStyle,
} from './visual-group-presentation';

export interface EntityDisclosurePresentation {
  readonly action: 'expand' | 'collapse';
  readonly ariaLabel: string;
  readonly count: number;
  readonly symbol: '+' | '−';
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
      symbol: '−',
    };
  }
  if (!data.isExpanded && data.revealableDescendantCount > 0) {
    const noun =
      data.revealableDescendantCount === 1 ? 'descendant' : 'descendants';
    return {
      action: 'expand',
      ariaLabel: `Expand ${data.title}; reveals ${data.revealableDescendantCount} ${noun}`,
      count: data.revealableDescendantCount,
      symbol: '+',
    };
  }
  return null;
}

function NodeHandles() {
  return (
    <>
      <Handle id="target-top" position={Position.Top} type="target" />
      <Handle id="source-top" position={Position.Top} type="source" />
      <Handle id="source-bottom" position={Position.Bottom} type="source" />
      <Handle id="target-bottom" position={Position.Bottom} type="target" />
      <Handle id="target-left" position={Position.Left} type="target" />
      <Handle id="source-left" position={Position.Left} type="source" />
      <Handle id="source-right" position={Position.Right} type="source" />
      <Handle id="target-right" position={Position.Right} type="target" />
    </>
  );
}

function ModuleBoundaryNodeComponent({
  data,
}: NodeProps<ModuleBoundaryFlowNode>) {
  return (
    <div
      aria-hidden="true"
      className={`focus-module-boundary${data.root ? ' focus-module-boundary--root' : ''}`}
    >
      <NodeHandles />
    </div>
  );
}

function FilteredBridgeNodeComponent({
  data,
}: NodeProps<FilteredBridgeFlowNode>) {
  return (
    <div
      aria-label={data.ariaLabel}
      className="focus-filtered-bridge"
      role="img"
    >
      <NodeHandles />
      <span aria-hidden="true">⋯</span>
    </div>
  );
}

function EntityNodeComponent({ data }: NodeProps<EntityFlowNode>) {
  const disclosure = useEntityDisclosure();
  const directHover = useDocumentDirectHover();
  const disclosurePresentation = entityDisclosurePresentation(data);
  const visualGroup = useVisualGroupPresentation(data.entityId);

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
  const compact = data.visualVariant === 'compact-schematic';
  const marker =
    data.entityKind === 'document'
      ? '▰'
      : data.entityKind === 'section'
        ? '◇'
        : '●';
  useEffect(() => {
    if (data.hasDirectFileConnectionRing !== true) return;
    const projectionNodeId = data.projectionNodeId;
    return () => directHover.setDocumentDirectHover(projectionNodeId, false);
  }, [data.hasDirectFileConnectionRing, data.projectionNodeId, directHover]);
  return (
    <div className="entity-card-frame">
      {data.hasDirectFileConnectionRing === true ? (
        <button
          aria-label={`Show direct File connections for ${data.title}`}
          className="file-direct-connection-ring nodrag nopan"
          onBlur={() =>
            directHover.setDocumentDirectHover(data.projectionNodeId, false)
          }
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          onFocus={() =>
            directHover.setDocumentDirectHover(data.projectionNodeId, true)
          }
          onPointerDown={(event) => event.stopPropagation()}
          onPointerEnter={() =>
            directHover.setDocumentDirectHover(data.projectionNodeId, true)
          }
          onPointerLeave={() =>
            directHover.setDocumentDirectHover(data.projectionNodeId, false)
          }
          title={`Show direct File connections for ${data.title}`}
          type="button"
        >
          <svg aria-hidden="true" focusable="false">
            <rect className="file-direct-connection-ring__visible" />
            <rect className="file-direct-connection-ring__hit" />
          </svg>
        </button>
      ) : null}
      <article
        className={`entity-card entity-card--${data.entityKind} entity-card--${data.role}${hasFooter ? ' entity-card--has-footer' : ''}${hasDisclosure ? ' entity-card--has-disclosure' : ''}${compact ? ' entity-card--compact-schematic' : ''}${data.root ? ' entity-card--local-root' : ''}`}
        data-entity-id={data.entityId}
        data-entity-kind={data.entityKind}
        data-focus-distance={data.focusDistance ?? undefined}
        data-projection-node-id={data.projectionNodeId}
        data-visual-group-color={visualGroup?.color}
        style={visualGroupAccentStyle(visualGroup)}
        title={`${data.title} — ${sourceLocation} — Double-click to focus`}
      >
        <NodeHandles />
        <div className="entity-card__title-row">
          {compact ? (
            <span
              aria-hidden="true"
              className={`compact-hierarchy-marker compact-hierarchy-marker--${data.entityKind}`}
            >
              {marker}
            </span>
          ) : null}
          <strong className="entity-title">
            {data.title}
            {compact &&
            data.entityKind === 'document' &&
            data.detail !== null ? (
              <span
                className="compact-file-context"
                translate="no"
              >{` · ${data.detail}`}</span>
            ) : null}
          </strong>
        </div>
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
    </div>
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
  const compact = data.visualVariant === 'compact-schematic';
  return (
    <article
      className={`diagnostic-card diagnostic-card--${data.status}${compact ? ' diagnostic-card--compact-schematic' : ''}`}
      data-projection-node-id={data.projectionNodeId}
    >
      <NodeHandles />
      <div className="diagnostic-card__topline">
        <span
          className={
            compact
              ? 'compact-hierarchy-marker compact-hierarchy-marker--diagnostic'
              : 'diagnostic-symbol'
          }
          aria-hidden="true"
        >
          {compact ? '○' : statusSymbol}
        </span>
        <strong>{compact ? data.rawTarget : data.status}</strong>
      </div>
      {compact ? null : (
        <>
          <span
            className="diagnostic-target"
            title={data.rawTarget}
            translate="no"
          >
            {data.rawTarget}
          </span>
          <span className="diagnostic-meta">
            {metadata} · {data.referenceCount}{' '}
            {data.referenceCount === 1 ? 'reference' : 'references'}
          </span>
        </>
      )}
    </article>
  );
}

export const EntityNode = memo(EntityNodeComponent);
export const DiagnosticNode = memo(DiagnosticNodeComponent);
export const ModuleBoundaryNode = memo(ModuleBoundaryNodeComponent);
export const FilteredBridgeNode = memo(FilteredBridgeNodeComponent);
