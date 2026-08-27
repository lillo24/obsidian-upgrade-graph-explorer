import type { EdgeTypes, NodeTypes } from '@xyflow/react';

import { GraphEdge } from './edges';
import { DiagnosticNode, EntityNode } from './nodes';

export const GRAPH_NODE_TYPES = {
  entity: EntityNode,
  diagnostic: DiagnosticNode,
} satisfies NodeTypes;

export const GRAPH_EDGE_TYPES = {
  graph: GraphEdge,
} satisfies EdgeTypes;
