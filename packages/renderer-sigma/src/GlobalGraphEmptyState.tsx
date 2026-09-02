export function GlobalGraphEmptyState() {
  return (
    <div className="global-graph-canvas global-graph-canvas--empty">
      <div className="global-graph-empty" role="status">
        <strong>No nodes match this view.</strong>
        <span>Adjust Filters to restore files.</span>
      </div>
    </div>
  );
}
