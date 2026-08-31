import type { GraphSelection } from '@icarus-graph-explorer/renderer-reactflow';

/** Prevent renderer selection echoes from churning controlled node arrays. */
export function retainGraphSelection(
  current: GraphSelection | null,
  next: GraphSelection | null,
): GraphSelection | null {
  return current?.kind === next?.kind && current?.id === next?.id
    ? current
    : next;
}
