import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type { EntityId } from '@icarus-graph-explorer/core';
import type { PerformanceInstrumentation } from '@icarus-graph-explorer/performance';
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
  readonly onClose: () => void;
  readonly onNavigate: (entityId: EntityId, origin: string) => void;
  readonly performance?: PerformanceInstrumentation;
}

interface BoundedSectionProps<Item> {
  readonly emptyMessage: string;
  readonly itemKey: (item: Item) => string;
  readonly items: readonly Item[];
  readonly renderItem: (item: Item) => ReactNode;
  readonly title: string;
}

const PAGE_SIZE = 20;

function humanKind(kind: EntityDescriptor['kind']): string {
  switch (kind) {
    case 'document':
      return 'File';
    case 'section':
      return 'Section';
    case 'block':
      return 'Block';
  }
}

function breadcrumbText(entity: EntityDescriptor): string {
  return entity.breadcrumb.map(({ label }) => label).join(' › ');
}

function issueTitle(
  status: Exclude<ReferenceOccurrenceDescriptor['status'], 'resolved'>,
): string {
  switch (status) {
    case 'unresolved':
      return 'Broken link';
    case 'ambiguous':
      return 'Uncertain link';
    case 'invalid':
      return 'Invalid link';
  }
}

const EntityAction = memo(function EntityAction({
  entity,
  onNavigate,
  origin,
}: {
  readonly entity: EntityDescriptor;
  readonly onNavigate: (entityId: EntityId, origin: string) => void;
  readonly origin: string;
}) {
  return (
    <button
      aria-label={`Navigate to ${entity.displayName} at ${breadcrumbText(entity)}`}
      className="entity-navigation"
      onClick={() => onNavigate(entity.entityId, origin)}
      type="button"
    >
      {entity.displayName}
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
    <nav aria-label="Location">
      <ol className="inspector-breadcrumbs">
        {breadcrumb.map((part) => (
          <li key={part.entityId}>
            <button
              aria-label={`Navigate to ${part.label}`}
              onClick={() => onNavigate(part.entityId, 'Breadcrumb')}
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

function EntityLocation({
  entity,
  onNavigate,
}: {
  readonly entity: EntityDescriptor;
  readonly onNavigate: (entityId: EntityId, origin: string) => void;
}) {
  return <Breadcrumbs breadcrumb={entity.breadcrumb} onNavigate={onNavigate} />;
}

function BoundedSection<Item>({
  emptyMessage,
  itemKey,
  items,
  renderItem,
  title,
}: BoundedSectionProps<Item>) {
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
        <div className="relationship-list">
          {visibleItems.map((item) => (
            <div key={itemKey(item)}>{renderItem(item)}</div>
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
          Show {Math.min(PAGE_SIZE, remaining)} more
        </button>
      )}
    </section>
  );
}

function ResolvedOutgoingCard({
  occurrence,
  showSource,
  onNavigate,
}: {
  readonly occurrence: ReferenceOccurrenceDescriptor;
  readonly showSource: boolean;
  readonly onNavigate: (entityId: EntityId, origin: string) => void;
}) {
  if (occurrence.resolution.status !== 'resolved') return null;
  return (
    <article className="relationship-card">
      <div className="relationship-card__main">
        <span aria-hidden="true" className="relationship-arrow">
          →
        </span>
        <div>
          <div className="relationship-card__title">
            <EntityAction
              entity={occurrence.resolution.target}
              onNavigate={onNavigate}
              origin="Outgoing Link"
            />
            {occurrence.kind === 'embed' ? (
              <span className="relationship-kind">Embed</span>
            ) : null}
          </div>
          <EntityLocation
            entity={occurrence.resolution.target}
            onNavigate={onNavigate}
          />
        </div>
      </div>
      {showSource ? (
        <div className="relationship-context">
          <span>From</span>
          <EntityLocation entity={occurrence.source} onNavigate={onNavigate} />
        </div>
      ) : null}
    </article>
  );
}

function ProblemOutgoingCard({
  occurrence,
  showSource,
  onNavigate,
}: {
  readonly occurrence: ReferenceOccurrenceDescriptor;
  readonly showSource: boolean;
  readonly onNavigate: (entityId: EntityId, origin: string) => void;
}) {
  if (occurrence.status === 'resolved') return null;
  return (
    <article
      className={`relationship-card relationship-card--${occurrence.status}`}
    >
      <span className="relationship-problem-label">
        {issueTitle(occurrence.status)}
      </span>
      <strong className="relationship-raw-target" translate="no">
        {occurrence.rawTarget}
      </strong>
      {showSource ? (
        <div className="relationship-context">
          <span>From</span>
          <EntityLocation entity={occurrence.source} onNavigate={onNavigate} />
        </div>
      ) : null}
    </article>
  );
}

function BacklinkCard({
  occurrence,
  onNavigate,
}: {
  readonly occurrence: ReferenceOccurrenceDescriptor;
  readonly onNavigate: (entityId: EntityId, origin: string) => void;
}) {
  return (
    <article className="relationship-card">
      <EntityAction
        entity={occurrence.source}
        onNavigate={onNavigate}
        origin="Backlink"
      />
      <EntityLocation entity={occurrence.source} onNavigate={onNavigate} />
    </article>
  );
}

function TechnicalFacts({
  rows,
}: {
  readonly rows: readonly {
    readonly label: string;
    readonly value: ReactNode;
  }[];
}) {
  return (
    <dl className="technical-facts">
      {rows.map(({ label, value }) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function TechnicalOccurrenceCard({
  occurrence,
}: {
  readonly occurrence: ReferenceOccurrenceDescriptor;
}) {
  const resolution = occurrence.resolution;
  return (
    <article className="technical-occurrence">
      <TechnicalFacts
        rows={[
          {
            label: 'Reference ID',
            value: <span translate="no">{occurrence.referenceId}</span>,
          },
          { label: 'Resolution state', value: occurrence.status },
          {
            label: 'Raw target',
            value: <span translate="no">{occurrence.rawTarget}</span>,
          },
          {
            label: 'Exact source',
            value: <span translate="no">{occurrence.sourceProvenance}</span>,
          },
          ...(resolution.reason === null
            ? []
            : [{ label: 'Resolution reason', value: resolution.reason }]),
          ...(resolution.status === 'resolved'
            ? [
                {
                  label: 'Destination entity ID',
                  value: (
                    <span translate="no">{resolution.target.entityId}</span>
                  ),
                },
              ]
            : []),
          ...(resolution.status === 'ambiguous'
            ? [
                {
                  label: 'Candidate entity IDs',
                  value: (
                    <span translate="no">
                      {resolution.candidates
                        .map(({ entityId }) => entityId)
                        .join(', ')}
                    </span>
                  ),
                },
              ]
            : []),
        ]}
      />
    </article>
  );
}

function TechnicalOccurrenceSection({
  items,
  title,
}: {
  readonly items: readonly ReferenceOccurrenceDescriptor[];
  readonly title: string;
}) {
  if (items.length === 0) return null;
  return (
    <BoundedSection
      emptyMessage=""
      itemKey={({ referenceId }) => referenceId}
      items={items}
      renderItem={(occurrence) => (
        <TechnicalOccurrenceCard occurrence={occurrence} />
      )}
      title={title}
    />
  );
}

function TechnicalDetails({ children }: { readonly children: ReactNode }) {
  return (
    <details className="technical-details">
      <summary>Technical details</summary>
      <div className="technical-details__body">
        {children}
        <p className="technical-note">
          Report mode provides paths and source ranges, but not Markdown source
          text or an open-in-source action.
        </p>
      </div>
    </details>
  );
}

function uniqueOccurrences(
  occurrences: readonly ReferenceOccurrenceDescriptor[],
): readonly ReferenceOccurrenceDescriptor[] {
  return [
    ...new Map(occurrences.map((item) => [item.referenceId, item])).values(),
  ];
}

function EntityInspector({
  inspection,
  onNavigate,
}: {
  readonly inspection: Extract<ProjectedNodeInspection, { kind: 'entity' }>;
  readonly onNavigate: (entityId: EntityId, origin: string) => void;
}) {
  const scoped = inspection.entity;
  const outgoing = scoped.outgoingReferences;
  const backlinks = scoped.backlinks;
  const candidateMentions = scoped.ambiguousCandidateMentions;
  const internal = inspection.internalRelationships;
  const relationshipMetadata = uniqueOccurrences([
    ...outgoing.map(({ occurrence }) => occurrence),
    ...backlinks.map(({ occurrence }) => occurrence),
  ]);

  return (
    <>
      <div className="inspector-identity">
        <span className={`kind-tag kind-${scoped.entity.kind}`}>
          {humanKind(scoped.entity.kind)}
        </span>
        <h4>{scoped.entity.displayName}</h4>
        <EntityLocation entity={scoped.entity} onNavigate={onNavigate} />
      </div>
      <p className="relationship-summary" aria-label="Relationship summary">
        {outgoing.length} outgoing · {backlinks.length} backlinks
      </p>
      <BoundedSection
        emptyMessage="No outgoing links."
        itemKey={({ occurrence }) => occurrence.referenceId}
        items={outgoing}
        renderItem={({ occurrence, sourceIsDescendant }) =>
          occurrence.status === 'resolved' ? (
            <ResolvedOutgoingCard
              occurrence={occurrence}
              onNavigate={onNavigate}
              showSource={sourceIsDescendant}
            />
          ) : (
            <ProblemOutgoingCard
              occurrence={occurrence}
              onNavigate={onNavigate}
              showSource={sourceIsDescendant}
            />
          )
        }
        title="Outgoing"
      />
      <BoundedSection
        emptyMessage="No backlinks."
        itemKey={({ occurrence }) => occurrence.referenceId}
        items={backlinks}
        renderItem={({ occurrence }) => (
          <BacklinkCard occurrence={occurrence} onNavigate={onNavigate} />
        )}
        title="Backlinks"
      />
      {internal.length === 0 ? null : (
        <p className="collapsed-links-hint">
          {internal.length} additional link
          {internal.length === 1 ? ' is' : 's are'} inside collapsed sections.
        </p>
      )}
      <TechnicalDetails>
        <TechnicalFacts
          rows={[
            {
              label: 'Entity ID',
              value: <span translate="no">{scoped.entity.entityId}</span>,
            },
            { label: 'Projection role', value: inspection.role },
            {
              label: 'Focus distance',
              value: inspection.focusDistance ?? 'Not in focus mode',
            },
            {
              label: 'Exact source',
              value: (
                <span translate="no">{scoped.entity.sourceProvenance}</span>
              ),
            },
            { label: 'Descendants', value: scoped.descendantCount },
            {
              label: 'Descendants revealed by Expand',
              value: inspection.revealableDescendantCount,
            },
            {
              label: 'Possible matches from uncertain links',
              value: candidateMentions.length,
            },
            {
              label: 'Links inside collapsed sections',
              value: internal.length,
            },
          ]}
        />
        {candidateMentions.length === 0 ? null : (
          <section className="technical-section">
            <h5>Possible matches from uncertain links</h5>
            <ul className="technical-candidate-list">
              {candidateMentions.map(({ occurrence, relevantCandidates }) => (
                <li key={occurrence.referenceId}>
                  <strong translate="no">{occurrence.rawTarget}</strong>
                  <span> from {breadcrumbText(occurrence.source)}</span>
                  <ul>
                    {relevantCandidates.map((candidate) => (
                      <li key={candidate.entityId}>
                        <EntityAction
                          entity={candidate}
                          onNavigate={onNavigate}
                          origin="Possible Match"
                        />
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        )}
        <TechnicalOccurrenceSection
          items={relationshipMetadata}
          title="Link metadata"
        />
        <TechnicalOccurrenceSection
          items={internal}
          title="Links inside collapsed sections"
        />
      </TechnicalDetails>
    </>
  );
}

function DiagnosticSourceCard({
  occurrence,
  onNavigate,
}: {
  readonly occurrence: ReferenceOccurrenceDescriptor;
  readonly onNavigate: (entityId: EntityId, origin: string) => void;
}) {
  return (
    <article className="relationship-card">
      <EntityAction
        entity={occurrence.source}
        onNavigate={onNavigate}
        origin="Link Source"
      />
      <EntityLocation entity={occurrence.source} onNavigate={onNavigate} />
    </article>
  );
}

function DiagnosticInspector({
  inspection,
  onNavigate,
}: {
  readonly inspection: Extract<ProjectedNodeInspection, { kind: 'diagnostic' }>;
  readonly onNavigate: (entityId: EntityId, origin: string) => void;
}) {
  const title = issueTitle(inspection.status);
  return (
    <>
      <div className={`link-issue link-issue--${inspection.status}`}>
        <span className="link-issue__title">{title}</span>
        <h4>
          Target: <span translate="no">{inspection.rawTarget}</span>
        </h4>
        <p>
          {inspection.status === 'unresolved'
            ? 'No matching destination was found.'
            : inspection.status === 'ambiguous'
              ? 'More than one possible destination exists.'
              : 'This link could not be interpreted as a valid destination.'}
        </p>
        {inspection.status !== 'invalid' ||
        inspection.reasons.length === 0 ? null : (
          <p className="link-issue__reason">{inspection.reasons.join(' ')}</p>
        )}
      </div>
      {inspection.status !== 'ambiguous' ? null : (
        <section className="candidate-destinations">
          <h4>Possible destinations</h4>
          <ul>
            {inspection.candidates.map((candidate) => (
              <li key={candidate.entityId}>
                <EntityAction
                  entity={candidate}
                  onNavigate={onNavigate}
                  origin="Possible Destination"
                />
                <EntityLocation entity={candidate} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
          <p>No destination has been selected.</p>
        </section>
      )}
      <BoundedSection
        emptyMessage="No source location is available."
        itemKey={({ referenceId }) => referenceId}
        items={inspection.occurrences}
        renderItem={(occurrence) => (
          <DiagnosticSourceCard
            occurrence={occurrence}
            onNavigate={onNavigate}
          />
        )}
        title="From"
      />
      <TechnicalDetails>
        <TechnicalFacts
          rows={[
            {
              label: 'Projection node ID',
              value: <span translate="no">{inspection.projectionNodeId}</span>,
            },
            { label: 'Resolution state', value: inspection.status },
            {
              label: 'Raw target',
              value: <span translate="no">{inspection.rawTarget}</span>,
            },
            {
              label: 'Resolution reasons',
              value:
                inspection.reasons.length === 0
                  ? 'None provided'
                  : inspection.reasons.join(' '),
            },
            {
              label: 'Candidate entity IDs',
              value:
                inspection.candidates.length === 0 ? (
                  'None'
                ) : (
                  <span translate="no">
                    {inspection.candidates
                      .map(({ entityId }) => entityId)
                      .join(', ')}
                  </span>
                ),
            },
          ]}
        />
        <TechnicalOccurrenceSection
          items={inspection.occurrences}
          title="Source occurrence metadata"
        />
      </TechnicalDetails>
    </>
  );
}

function ConnectionOccurrenceCard({
  occurrence,
  onNavigate,
}: {
  readonly occurrence: ReferenceOccurrenceDescriptor;
  readonly onNavigate: (entityId: EntityId, origin: string) => void;
}) {
  return (
    <article className="connection-occurrence">
      <div>
        <EntityAction
          entity={occurrence.source}
          onNavigate={onNavigate}
          origin="Connection Source"
        />
        <EntityLocation entity={occurrence.source} onNavigate={onNavigate} />
      </div>
      <span aria-hidden="true" className="connection-arrow">
        →
      </span>
      {occurrence.resolution.status === 'resolved' ? (
        <div>
          <EntityAction
            entity={occurrence.resolution.target}
            onNavigate={onNavigate}
            origin="Connection Destination"
          />
          <EntityLocation
            entity={occurrence.resolution.target}
            onNavigate={onNavigate}
          />
        </div>
      ) : (
        <div className="connection-problem">
          <span>{issueTitle(occurrence.resolution.status)}</span>
          <strong translate="no">{occurrence.rawTarget}</strong>
        </div>
      )}
    </article>
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
  const isGrouped = inspection.occurrences.length > 1;
  const groupedByCollapse =
    isGrouped &&
    inspection.occurrences.some(
      ({ sourceRolledUp, targetRolledUp }) => sourceRolledUp || targetRolledUp,
    );
  return (
    <>
      <div className="inspector-identity">
        <span className="inspector-type">Connection</span>
        <h4>
          {inspection.projectedSource.displayName} → {targetLabel}
        </h4>
        <p className="connection-summary">
          This visible connection represents {inspection.occurrences.length}{' '}
          link{inspection.occurrences.length === 1 ? '' : 's'}.
        </p>
        {isGrouped ? (
          <p className="connection-grouping-hint">
            {inspection.occurrences.length} links are grouped into this
            connection
            {groupedByCollapse
              ? ' because some sections are currently collapsed.'
              : '.'}
          </p>
        ) : null}
      </div>
      <BoundedSection
        emptyMessage="No underlying links are available."
        itemKey={({ occurrence }) => occurrence.referenceId}
        items={inspection.occurrences}
        renderItem={({ occurrence }) => (
          <ConnectionOccurrenceCard
            occurrence={occurrence}
            onNavigate={onNavigate}
          />
        )}
        title="Links in this connection"
      />
      <TechnicalDetails>
        <TechnicalFacts
          rows={[
            {
              label: 'Projection edge ID',
              value: <span translate="no">{inspection.projectionEdgeId}</span>,
            },
            { label: 'Resolution state', value: inspection.status },
            {
              label: 'Projected source entity ID',
              value: (
                <span translate="no">
                  {inspection.projectedSource.entityId}
                </span>
              ),
            },
            {
              label: 'Rolled-up occurrences',
              value: inspection.occurrences.filter(
                ({ sourceRolledUp, targetRolledUp }) =>
                  sourceRolledUp || targetRolledUp,
              ).length,
            },
          ]}
        />
        <TechnicalOccurrenceSection
          items={inspection.occurrences.map(({ occurrence }) => occurrence)}
          title="Connection occurrence metadata"
        />
      </TechnicalDetails>
    </>
  );
}

function HierarchyEdgeInspector({
  inspection,
  onNavigate,
}: {
  readonly inspection: Extract<ProjectedEdgeInspection, { kind: 'hierarchy' }>;
  readonly onNavigate: (entityId: EntityId, origin: string) => void;
}) {
  return (
    <>
      <div className="inspector-identity">
        <span className="inspector-type">Structure</span>
        <h4>{inspection.parent.displayName}</h4>
      </div>
      <div className="structure-relationship">
        <div>
          <EntityAction
            entity={inspection.parent}
            onNavigate={onNavigate}
            origin="Containing Item"
          />
          <EntityLocation entity={inspection.parent} onNavigate={onNavigate} />
        </div>
        <span>contains</span>
        <div>
          <EntityAction
            entity={inspection.child}
            onNavigate={onNavigate}
            origin="Contained Item"
          />
          <EntityLocation entity={inspection.child} onNavigate={onNavigate} />
        </div>
      </div>
      <TechnicalDetails>
        <TechnicalFacts
          rows={[
            {
              label: 'Projection edge ID',
              value: <span translate="no">{inspection.projectionEdgeId}</span>,
            },
            {
              label: 'Parent entity ID',
              value: <span translate="no">{inspection.parent.entityId}</span>,
            },
            {
              label: 'Child entity ID',
              value: <span translate="no">{inspection.child.entityId}</span>,
            },
          ]}
        />
      </TechnicalDetails>
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
  return inspection.kind === 'reference' ? (
    <ReferenceEdgeInspector inspection={inspection} onNavigate={onNavigate} />
  ) : (
    <HierarchyEdgeInspector inspection={inspection} onNavigate={onNavigate} />
  );
}

export const ProvenanceInspector = memo(function ProvenanceInspector({
  onClear,
  onClose,
  onNavigate,
  performance,
  projection,
  selection,
  workspace,
}: ProvenanceInspectorProps) {
  const collapseButtonRef = useRef<HTMLButtonElement>(null);
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
      const inspect = () =>
        selection.kind === 'node'
          ? inspectProjectedNode(workspace, projection, selection.id)
          : inspectProjectedEdge(workspace, projection, selection.id);
      return {
        ok: true,
        value:
          performance === undefined
            ? inspect()
            : performance.measure('inspection', 'inspections', inspect),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, message: `Inspection failed: ${message}` };
    }
  }, [performance, projection, selection, workspace]);
  const contentKey =
    selection === null ? 'empty' : `${selection.kind}:${selection.id}`;

  useEffect(() => {
    collapseButtonRef.current?.focus();
  }, []);

  return (
    <aside className="selection-panel" aria-label="Inspector">
      <div className="selection-panel__heading">
        <button
          aria-label="Close Inspector"
          className="selection-panel__collapse"
          onClick={onClose}
          ref={collapseButtonRef}
          title="Close Inspector"
          type="button"
        >
          <span aria-hidden="true">›</span>
        </button>
        <h3>Inspector</h3>
        <div className="selection-panel__actions">
          {selection === null ? null : (
            <button onClick={onClear} type="button">
              Clear selection
            </button>
          )}
        </div>
      </div>
      <div className="selection-panel__body" key={contentKey}>
        {inspected === null ? (
          <p className="selection-empty">
            Select a file, section, or connection.
          </p>
        ) : !inspected.ok ? (
          <p className="inspector-error" role="alert">
            {inspected.message} Clear the selection and choose a visible graph
            element.
          </p>
        ) : inspected.value.kind === 'entity' ? (
          <EntityInspector
            inspection={inspected.value}
            onNavigate={onNavigate}
          />
        ) : inspected.value.kind === 'diagnostic' ? (
          <DiagnosticInspector
            inspection={inspected.value}
            onNavigate={onNavigate}
          />
        ) : (
          <EdgeInspector inspection={inspected.value} onNavigate={onNavigate} />
        )}
      </div>
    </aside>
  );
});
