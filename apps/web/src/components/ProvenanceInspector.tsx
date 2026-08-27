import { memo, useMemo, useState } from 'react';

import type { EntityId } from '@icarus-graph-explorer/core';
import {
  inspectProjectedEdge,
  inspectProjectedNode,
  type BreadcrumbPart,
  type EntityDescriptor,
  type InspectionWorkspace,
  type ProjectedEdgeInspection,
  type ProjectedNodeInspection,
  type ReferenceOccurrenceDescriptor,
} from '@icarus-graph-explorer/explorer-inspection';
import type { GraphSelection } from '@icarus-graph-explorer/renderer-reactflow';
import type { ViewProjection } from '@icarus-graph-explorer/view-projection';

interface ProvenanceInspectorProps {
  readonly workspace: InspectionWorkspace;
  readonly projection: ViewProjection;
  readonly selection: GraphSelection | null;
  readonly onClear: () => void;
  readonly onNavigate: (entityId: EntityId, origin: string) => void;
}

interface OccurrenceItem {
  readonly occurrence: ReferenceOccurrenceDescriptor;
  readonly note?: string;
}

interface OccurrenceSectionProps {
  readonly emptyMessage: string;
  readonly items: readonly OccurrenceItem[];
  readonly title: string;
  readonly onNavigate: (entityId: EntityId, origin: string) => void;
}

const PAGE_SIZE = 20;

const EntityAction = memo(function EntityAction({
  entity,
  label,
  onNavigate,
  origin,
}: {
  readonly entity: EntityDescriptor;
  readonly label?: string;
  readonly onNavigate: (entityId: EntityId, origin: string) => void;
  readonly origin: string;
}) {
  return (
    <button
      className="entity-navigation"
      onClick={() => onNavigate(entity.entityId, origin)}
      title={entity.sourceProvenance}
      type="button"
    >
      {label ?? entity.displayName}
    </button>
  );
});

const Breadcrumbs = memo(function Breadcrumbs({
  breadcrumb,
  onNavigate,
}: {
  readonly breadcrumb: readonly BreadcrumbPart[];
  readonly onNavigate: (entityId: EntityId, origin: string) => void;
}) {
  return (
    <nav aria-label="Canonical breadcrumb">
      <ol className="inspector-breadcrumbs">
        {breadcrumb.map((part) => (
          <li key={part.entityId}>
            <button
              onClick={() => onNavigate(part.entityId, 'Breadcrumb')}
              title={`Reveal ${part.kind}`}
              type="button"
            >
              {part.label}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
});

const OccurrenceCard = memo(function OccurrenceCard({
  item,
  onNavigate,
}: {
  readonly item: OccurrenceItem;
  readonly onNavigate: (entityId: EntityId, origin: string) => void;
}) {
  const { occurrence } = item;
  const { resolution } = occurrence;
  return (
    <article className="occurrence-card">
      <div className="occurrence-card__heading">
        <span className={`status-badge status-${occurrence.status}`}>
          {occurrence.status}
        </span>
        <span className="reference-kind">{occurrence.kind}</span>
      </div>
      <p className="occurrence-target" translate="no">
        {occurrence.rawTarget}
      </p>
      <dl>
        <div>
          <dt>Exact Source</dt>
          <dd>
            <EntityAction
              entity={occurrence.source}
              onNavigate={onNavigate}
              origin="Reference Source"
            />
          </dd>
        </div>
        <div>
          <dt>Source Location</dt>
          <dd translate="no">{occurrence.sourceProvenance}</dd>
        </div>
        <div>
          <dt>Reference ID</dt>
          <dd translate="no">{occurrence.referenceId}</dd>
        </div>
      </dl>
      {resolution.status === 'resolved' ? (
        <p>
          Resolved to{' '}
          <EntityAction
            entity={resolution.target}
            onNavigate={onNavigate}
            origin="Resolved Target"
          />
          .
        </p>
      ) : null}
      {resolution.reason === null ? null : (
        <p className="occurrence-reason">Reason: {resolution.reason}</p>
      )}
      {resolution.status !== 'ambiguous' ? null : (
        <div className="occurrence-candidates">
          <strong>Ambiguity Candidates</strong>
          <ul>
            {resolution.candidates.map((candidate) => (
              <li key={candidate.entityId}>
                <EntityAction
                  entity={candidate}
                  label={`${candidate.displayName} — ${candidate.sourceProvenance}`}
                  onNavigate={onNavigate}
                  origin="Ambiguity Candidate"
                />
              </li>
            ))}
          </ul>
          <small>No candidate is treated as the chosen resolution.</small>
        </div>
      )}
      {item.note === undefined ? null : (
        <p className="occurrence-note">{item.note}</p>
      )}
    </article>
  );
});

const OccurrenceSection = memo(function OccurrenceSection({
  emptyMessage,
  items,
  onNavigate,
  title,
}: OccurrenceSectionProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visibleItems = items.slice(0, visibleCount);
  const remaining = items.length - visibleItems.length;
  return (
    <section className="inspector-section">
      <div className="inspector-section__heading">
        <h4>{title}</h4>
        <span>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="inspector-empty">{emptyMessage}</p>
      ) : (
        <div className="occurrence-list">
          {visibleItems.map((item) => (
            <OccurrenceCard
              item={item}
              key={item.occurrence.referenceId}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
      {remaining <= 0 ? null : (
        <button
          className="show-more"
          onClick={() =>
            setVisibleCount((current) =>
              Math.min(current + PAGE_SIZE, items.length),
            )
          }
          type="button"
        >
          Show {Math.min(PAGE_SIZE, remaining)} More
        </button>
      )}
    </section>
  );
});

function sourceLocation(entity: EntityDescriptor): React.ReactNode {
  return <span translate="no">{entity.sourceProvenance}</span>;
}

function EntityInspector({
  inspection,
  onNavigate,
}: {
  readonly inspection: Extract<ProjectedNodeInspection, { kind: 'entity' }>;
  readonly onNavigate: (entityId: EntityId, origin: string) => void;
}) {
  const { entity: scoped } = inspection;
  const outgoing = scoped.outgoingReferences.map((relationship) => ({
    occurrence: relationship.occurrence,
    ...(relationship.sourceIsDescendant
      ? { note: 'Authored by a descendant in the selected subtree.' }
      : {}),
  }));
  const backlinks = scoped.backlinks.map((relationship) => ({
    occurrence: relationship.occurrence,
    ...(relationship.targetIsDescendant
      ? {
          note: `The exact target is descendant “${relationship.target.displayName}”.`,
        }
      : {}),
  }));
  const candidateMentions = scoped.ambiguousCandidateMentions.map(
    (relationship) => ({
      occurrence: relationship.occurrence,
      note: `${relationship.relevantCandidates.length} candidate${relationship.relevantCandidates.length === 1 ? '' : 's'} fall within this subtree; none is resolved.`,
    }),
  );
  const internal = inspection.internalRelationships.map((occurrence) => ({
    occurrence,
    note: 'Both exact endpoints currently roll into this visible node.',
  }));

  return (
    <>
      <div className="inspector-identity">
        <span className={`kind-tag kind-${scoped.entity.kind}`}>
          {scoped.entity.kind}
        </span>
        <h4>{scoped.entity.displayName}</h4>
        <Breadcrumbs
          breadcrumb={scoped.entity.breadcrumb}
          onNavigate={onNavigate}
        />
        <p>{sourceLocation(scoped.entity)}</p>
        <dl className="inspector-facts">
          <div>
            <dt>Projection Role</dt>
            <dd>{inspection.role}</dd>
          </div>
          <div>
            <dt>Focus Distance</dt>
            <dd>{inspection.focusDistance ?? 'Not in focus mode'}</dd>
          </div>
          <div>
            <dt>Canonical Descendants</dt>
            <dd>{scoped.descendantCount}</dd>
          </div>
          <div>
            <dt>Structurally Hidden</dt>
            <dd>{inspection.hiddenDescendantCount}</dd>
          </div>
        </dl>
      </div>
      <div className="relationship-summary" aria-label="Relationship summary">
        <span>{outgoing.length} outgoing</span>
        <span>{backlinks.length} backlinks</span>
        <span>{candidateMentions.length} candidate mentions</span>
        <span>{internal.length} internal</span>
      </div>
      <OccurrenceSection
        emptyMessage="No references are authored by this entity or its descendants."
        items={outgoing}
        onNavigate={onNavigate}
        title="Outgoing References"
      />
      <OccurrenceSection
        emptyMessage="No resolved references target this entity or its descendants."
        items={backlinks}
        onNavigate={onNavigate}
        title="Backlinks"
      />
      <OccurrenceSection
        emptyMessage="No ambiguous occurrence lists this entity subtree as a candidate."
        items={candidateMentions}
        onNavigate={onNavigate}
        title="Ambiguous Candidate Mentions"
      />
      <section className="internal-explanation">
        <h4>Internal Relationships Hidden by Current Collapse</h4>
        <p>
          {internal.length} reference{internal.length === 1 ? ' is' : 's are'}{' '}
          currently internal to this collapsed node. Expand sections to expose
          them as visible graph relationships.
        </p>
      </section>
      <OccurrenceSection
        emptyMessage="No exact reference occurrence is currently internal to this node."
        items={internal}
        onNavigate={onNavigate}
        title="Internal Occurrences"
      />
    </>
  );
}

function DiagnosticInspector({
  inspection,
  onNavigate,
}: {
  readonly inspection: Extract<ProjectedNodeInspection, { kind: 'diagnostic' }>;
  readonly onNavigate: (entityId: EntityId, origin: string) => void;
}) {
  return (
    <>
      <div className="inspector-identity">
        <span className={`status-badge status-${inspection.status}`}>
          {inspection.status}
        </span>
        <h4 translate="no">{inspection.rawTarget}</h4>
        <p>
          Projection-only diagnostic target · {inspection.occurrences.length}{' '}
          exact occurrence
          {inspection.occurrences.length === 1 ? '' : 's'}
        </p>
        {inspection.reasons.length === 0 ? null : (
          <ul className="diagnostic-reasons">
            {inspection.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}
        {inspection.candidates.length === 0 ? null : (
          <div className="diagnostic-candidates">
            <h4>Ambiguity Candidates</h4>
            <ul>
              {inspection.candidates.map((candidate) => (
                <li key={candidate.entityId}>
                  <EntityAction
                    entity={candidate}
                    label={`${candidate.displayName} — ${candidate.sourceProvenance}`}
                    onNavigate={onNavigate}
                    origin="Ambiguity Candidate"
                  />
                </li>
              ))}
            </ul>
            <p>No candidate is treated as the chosen resolution.</p>
          </div>
        )}
      </div>
      <OccurrenceSection
        emptyMessage="This diagnostic target has no canonical occurrence."
        items={inspection.occurrences.map((occurrence) => ({ occurrence }))}
        onNavigate={onNavigate}
        title="Source Occurrences"
      />
    </>
  );
}

function ReferenceEdgeInspector({
  inspection,
  onNavigate,
}: {
  readonly inspection: Extract<ProjectedEdgeInspection, { kind: 'reference' }>;
  readonly onNavigate: (entityId: EntityId, origin: string) => void;
}) {
  const targetLabel =
    inspection.projectedTarget.kind === 'diagnostic'
      ? inspection.projectedTarget.rawTarget
      : inspection.projectedTarget.displayName;
  return (
    <>
      <div className="inspector-identity">
        <span className={`status-badge status-${inspection.status}`}>
          {inspection.status}
        </span>
        <h4>
          {inspection.projectedSource.displayName} → {targetLabel}
        </h4>
        <p>
          Visible projected relationship · {inspection.occurrences.length}{' '}
          canonical occurrence
          {inspection.occurrences.length === 1 ? '' : 's'}
        </p>
      </div>
      <OccurrenceSection
        emptyMessage="This projected edge has no canonical reference provenance."
        items={inspection.occurrences.map(
          ({ occurrence, sourceRolledUp, targetRolledUp }) => ({
            occurrence,
            ...(!sourceRolledUp && !targetRolledUp
              ? {}
              : {
                  note: `Displayed through visible ${[
                    sourceRolledUp ? 'source' : '',
                    targetRolledUp ? 'target' : '',
                  ]
                    .filter(Boolean)
                    .join(
                      ' and ',
                    )} ancestor${sourceRolledUp && targetRolledUp ? 's' : ''}.`,
                }),
          }),
        )}
        onNavigate={onNavigate}
        title="Aggregated Provenance"
      />
    </>
  );
}

function EdgeInspector({
  inspection,
  onNavigate,
}: {
  readonly inspection: ProjectedEdgeInspection;
  readonly onNavigate: (entityId: EntityId, origin: string) => void;
}) {
  if (inspection.kind === 'reference') {
    return (
      <ReferenceEdgeInspector inspection={inspection} onNavigate={onNavigate} />
    );
  }
  return (
    <div className="inspector-identity">
      <span className="kind-tag kind-section">hierarchy</span>
      <h4>
        {inspection.parent.displayName} → {inspection.child.displayName}
      </h4>
      <p>Canonical structural containment. No Reference ID is fabricated.</p>
      <dl className="inspector-facts inspector-facts--stacked">
        <div>
          <dt>Parent</dt>
          <dd>
            <EntityAction
              entity={inspection.parent}
              onNavigate={onNavigate}
              origin="Hierarchy Parent"
            />
            <br />
            {sourceLocation(inspection.parent)}
          </dd>
        </div>
        <div>
          <dt>Child</dt>
          <dd>
            <EntityAction
              entity={inspection.child}
              onNavigate={onNavigate}
              origin="Hierarchy Child"
            />
            <br />
            {sourceLocation(inspection.child)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export const ProvenanceInspector = memo(function ProvenanceInspector({
  onClear,
  onNavigate,
  projection,
  selection,
  workspace,
}: ProvenanceInspectorProps) {
  const inspected = useMemo<
    | {
        readonly ok: true;
        readonly value: ProjectedNodeInspection | ProjectedEdgeInspection;
      }
    | { readonly ok: false; readonly message: string }
    | null
  >(() => {
    if (selection === null) return null;
    try {
      return {
        ok: true,
        value:
          selection.kind === 'node'
            ? inspectProjectedNode(workspace, projection, selection.id)
            : inspectProjectedEdge(workspace, projection, selection.id),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, message: `Inspection failed: ${message}` };
    }
  }, [projection, selection, workspace]);

  return (
    <aside className="selection-panel" aria-label="Provenance inspector">
      <div className="selection-panel__heading">
        <h3>Provenance Inspector</h3>
        {selection === null ? null : (
          <button onClick={onClear} type="button">
            Clear Selection
          </button>
        )}
      </div>
      {inspected === null ? (
        <div className="selection-empty">
          <strong>Nothing Selected</strong>
          <span>Select a node or edge to inspect its exact provenance.</span>
          <span>
            Use Find to reveal entities that are not currently visible.
          </span>
        </div>
      ) : !inspected.ok ? (
        <p className="inspector-error" role="alert">
          {inspected.message} Clear the selection and choose a visible graph
          element.
        </p>
      ) : inspected.value.kind === 'entity' ? (
        <EntityInspector inspection={inspected.value} onNavigate={onNavigate} />
      ) : inspected.value.kind === 'diagnostic' ? (
        <DiagnosticInspector
          inspection={inspected.value}
          onNavigate={onNavigate}
        />
      ) : (
        <EdgeInspector inspection={inspected.value} onNavigate={onNavigate} />
      )}
      <p className="source-limitation">
        Report mode includes paths and exact line/column spans, but no Markdown
        source text, snippets, or open-in-source action.
      </p>
    </aside>
  );
});
