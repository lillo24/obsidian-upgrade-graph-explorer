import type { EdgeTypes, NodeTypes } from '@xyflow/react';

import { GraphEdge } from './edges';
import {
  DiagnosticNode,
  EntityNode,
  FilteredBridgeNode,
  ModuleBoundaryNode,
} from './nodes';

export const GRAPH_NODE_TYPES = {
  entity: EntityNode,
  diagnostic: DiagnosticNode,
  module: ModuleBoundaryNode,
  'filtered-bridge': FilteredBridgeNode,
} satisfies NodeTypes;

export const GRAPH_EDGE_TYPES = {
  graph: GraphEdge,
} satisfies EdgeTypes;
