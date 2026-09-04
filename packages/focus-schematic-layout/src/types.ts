import type { EntityId } from '@icarus-graph-explorer/core';
import type {
  FocusSchematicLayoutCandidate,
  FocusSchematicLayoutQuality,
  FocusSchematicModel,
} from '@icarus-graph-explorer/focus-schematic';
import type {
  ProjectionNodeId,
  ViewProjection,
} from '@icarus-graph-explorer/view-projection';

export const FOCUS_SCHEMATIC_LAYOUT_PLAN_SCHEMA_VERSION = 1 as const;

export type FocusSchematicFilteredModulePolicy =
  'compact-bridge' | 'context-card';

export interface FocusSchematicNodeDimension {
  readonly projectionNodeId: ProjectionNodeId;
  readonly width: number;
  readonly height: number;
}

export interface FocusSchematicPrototypeSettings {
  readonly filteredModulePolicy: FocusSchematicFilteredModulePolicy;
  readonly modulePaddingX: number;
  readonly modulePaddingY: number;
  readonly diagnosticReserveHeight: number;
  readonly internalNodeSeparation: number;
  readonly internalRankSeparation: number;
  readonly macroNodeSeparation: number;
  readonly macroRankSeparation: number;
  readonly ranker: 'network-simplex' | 'tight-tree' | 'longest-path';
}

export interface FocusSchematicLayoutInput {
  readonly model: FocusSchematicModel;
  readonly projection: ViewProjection;
  readonly nodeDimensions: readonly FocusSchematicNodeDimension[];
  readonly settings: FocusSchematicPrototypeSettings;
}

export interface FocusSchematicLayoutPlanModule {
  readonly moduleId: EntityId;
  readonly side: 'center' | 'left' | 'right';
  readonly signedRank: -3 | -2 | -1 | 0 | 1 | 2 | 3;
  readonly parentModuleId: EntityId | null;
  readonly parentRelationshipId: string | null;
}

export interface FocusSchematicLayoutPlan {
  readonly schemaVersion: typeof FOCUS_SCHEMATIC_LAYOUT_PLAN_SCHEMA_VERSION;
  readonly rootModuleId: EntityId;
  readonly modules: readonly FocusSchematicLayoutPlanModule[];
  readonly arbitraryTieBreakCount: number;
}

export interface FocusSchematicLayoutPhaseTimings {
  readonly inputMs: number;
  readonly planningMs: number;
  readonly internalMs: number;
  readonly macroMs: number;
  readonly postMs: number;
  readonly validateMs: number;
  readonly qualityMs: number;
  readonly serializeMs: number;
  readonly totalMs: number;
}

export interface FocusSchematicNativeRoute {
  readonly relationshipId: string;
  readonly points: readonly { readonly x: number; readonly y: number }[];
}

export type FocusSchematicLayoutAttempt =
  | {
      readonly status: 'success';
      readonly strategyId: string;
      readonly configId: string;
      readonly plan: FocusSchematicLayoutPlan;
      readonly candidate: FocusSchematicLayoutCandidate;
      readonly quality: FocusSchematicLayoutQuality;
      readonly nativeRoutes: readonly FocusSchematicNativeRoute[];
      readonly routeCoverage: number;
      readonly warnings: readonly string[];
      readonly timings: FocusSchematicLayoutPhaseTimings;
    }
  | {
      readonly status: 'unsupported' | 'failure' | 'timeout';
      readonly strategyId: string;
      readonly configId: string;
      readonly reason: string;
      readonly timings: FocusSchematicLayoutPhaseTimings;
    };

export interface FocusSchematicLayoutInputValidationIssue {
  readonly path: string;
  readonly message: string;
}

export type FocusSchematicLayoutInputValidationResult =
  | {
      readonly valid: true;
      readonly value: FocusSchematicLayoutInput;
      readonly issues: readonly [];
    }
  | {
      readonly valid: false;
      readonly issues: readonly FocusSchematicLayoutInputValidationIssue[];
    };

export interface FocusSchematicLayoutPlanValidationIssue {
  readonly path: string;
  readonly message: string;
}

export type FocusSchematicLayoutPlanValidationResult =
  | {
      readonly valid: true;
      readonly value: FocusSchematicLayoutPlan;
      readonly issues: readonly [];
    }
  | {
      readonly valid: false;
      readonly issues: readonly FocusSchematicLayoutPlanValidationIssue[];
    };
