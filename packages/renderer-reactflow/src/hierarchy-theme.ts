import type { CSSProperties } from 'react';
import type { ResolvedTheme } from '@icarus-graph-explorer/theme';

/** Renderer-only semantic palette. It must never participate in graph geometry. */
export interface HierarchyTheme {
  readonly id: 'icarus-hierarchy-light' | 'icarus-hierarchy-dark';
  readonly canvasBackground: string;
  readonly canvasGlow: string;
  readonly canvasCompactOverlay: string;
  readonly canvasCompactBackground: string;
  readonly canvasGrid: string;
  readonly nodeSurface: string;
  readonly nodeText: string;
  readonly nodeMuted: string;
  readonly nodeBorder: string;
  readonly nodeShadow: string;
  readonly nodeContextSurface: string;
  readonly nodeContextText: string;
  readonly documentSurfaceEnd: string;
  readonly documentBorder: string;
  readonly documentAccent: string;
  readonly documentShadow: string;
  readonly sectionSurfaceEnd: string;
  readonly sectionBorder: string;
  readonly sectionAccent: string;
  readonly sectionShadow: string;
  readonly blockSurface: string;
  readonly blockBorder: string;
  readonly blockAccent: string;
  readonly compactSurface: string;
  readonly compactShadow: string;
  readonly compactDocumentSurface: string;
  readonly compactDocumentBorder: string;
  readonly compactSectionSurface: string;
  readonly compactBlockSurface: string;
  readonly markerDocument: string;
  readonly markerSection: string;
  readonly markerBlock: string;
  readonly markerDiagnostic: string;
  readonly disclosureHoverSurface: string;
  readonly disclosureHoverBorder: string;
  readonly selectedBorder: string;
  readonly selectedRing: string;
  readonly selectedShadow: string;
  readonly highlight: string;
  readonly focusOutline: string;
  readonly rootOutline: string;
  readonly rootShadow: string;
  readonly rootInvertedBorder: string;
  readonly rootInvertedSurface: string;
  readonly rootInvertedText: string;
  readonly rootInvertedHover: string;
  readonly rootInvertedHoverBorder: string;
  readonly referenceEdge: string;
  readonly hierarchyEdge: string;
  readonly compactHierarchyEdge: string;
  readonly resolvedEdge: string;
  readonly secondaryEdge: string;
  readonly fallbackEdge: string;
  readonly directRing: string;
  readonly unresolvedSurface: string;
  readonly unresolvedBorder: string;
  readonly unresolvedText: string;
  readonly ambiguousSurface: string;
  readonly ambiguousBorder: string;
  readonly ambiguousText: string;
  readonly invalidSurface: string;
  readonly invalidStripe: string;
  readonly invalidBorder: string;
  readonly invalidText: string;
  readonly diagnosticShadow: string;
  readonly edgeLabelBorder: string;
  readonly folderFill: string;
  readonly folderStroke: string;
  readonly folderRootFill: string;
  readonly folderRootStroke: string;
  readonly folderParentFill: string;
  readonly folderParentStroke: string;
  readonly folderNestedFill: string;
  readonly folderNestedStroke: string;
  readonly folderDepthTwoFill: string;
  readonly folderDepthTwoStroke: string;
  readonly folderDepthThreeFill: string;
  readonly folderDepthThreeStroke: string;
  readonly folderGuideStroke: string;
  readonly folderActiveFill: string;
  readonly folderActiveStroke: string;
  readonly folderCurrentParentFill: string;
  readonly folderCurrentParentStroke: string;
  readonly folderSiblingStroke: string;
  readonly folderText: string;
  readonly folderDepthTwoText: string;
  readonly folderDepthThreeText: string;
  readonly folderMutedText: string;
  readonly contextSurface: string;
  readonly contextBorder: string;
  readonly contextText: string;
  readonly contextShadow: string;
  readonly controlSurface: string;
  readonly controlBorder: string;
  readonly controlText: string;
  readonly controlHover: string;
  readonly controlDivider: string;
  readonly controlShadow: string;
  readonly statusSurface: string;
  readonly statusBorder: string;
  readonly statusText: string;
  readonly statusShadow: string;
  readonly warningSurface: string;
  readonly warningBorder: string;
  readonly warningText: string;
  readonly moduleSurface: string;
  readonly moduleBorder: string;
  readonly moduleInset: string;
  readonly moduleRootSurface: string;
  readonly moduleRootBorder: string;
  readonly moduleRootInset: string;
  readonly moduleHighlightSurface: string;
  readonly moduleHighlightBorder: string;
  readonly bridgeSurface: string;
  readonly bridgeBorder: string;
  readonly bridgeText: string;
  readonly internalReference: string;
}

export const ICARUS_LIGHT_HIERARCHY_THEME: HierarchyTheme = Object.freeze({
  id: 'icarus-hierarchy-light',
  canvasBackground: '#edf2f3',
  canvasGlow: 'rgb(255 255 255 / 90%)',
  canvasCompactOverlay: 'rgb(255 255 255 / 42%)',
  canvasCompactBackground: '#e9eff1',
  canvasGrid: '#cbd5da',
  nodeSurface: '#ffffff',
  nodeText: '#142631',
  nodeMuted: '#607682',
  nodeBorder: '#95aab5',
  nodeShadow: 'rgb(31 58 72 / 12%)',
  nodeContextSurface: '#f0f3f4',
  nodeContextText: '#536873',
  documentSurfaceEnd: '#e7f4f6',
  documentBorder: '#789ca9',
  documentAccent: '#245e74',
  documentShadow: 'rgb(28 72 88 / 16%)',
  sectionSurfaceEnd: '#eeeafa',
  sectionBorder: '#8b82ae',
  sectionAccent: '#756b9b',
  sectionShadow: 'rgb(75 65 117 / 13%)',
  blockSurface: '#fffcf2',
  blockBorder: '#85703f',
  blockAccent: '#89713f',
  compactSurface: '#fbfdfd',
  compactShadow: 'rgb(22 46 58 / 12%)',
  compactDocumentSurface: '#eef7f8',
  compactDocumentBorder: '#4f7584',
  compactSectionSurface: '#f3f1fa',
  compactBlockSurface: '#fffdf5',
  markerDocument: '#2c5363',
  markerSection: '#695d91',
  markerBlock: '#80672f',
  markerDiagnostic: '#9a5d24',
  disclosureHoverSurface: 'rgb(231 242 244 / 78%)',
  disclosureHoverBorder: '#9db1ba',
  selectedBorder: '#101723',
  selectedRing: 'rgb(247 211 106 / 90%)',
  selectedShadow: 'rgb(16 23 35 / 18%)',
  highlight: '#286e8d',
  focusOutline: '#a86700',
  rootOutline: '#194f68',
  rootShadow: 'rgb(24 76 98 / 22%)',
  rootInvertedBorder: '#071d28',
  rootInvertedSurface: '#173d4d',
  rootInvertedText: '#f7fbfc',
  rootInvertedHover: 'rgb(255 255 255 / 12%)',
  rootInvertedHoverBorder: '#9fc5d2',
  referenceEdge: '#63808e',
  hierarchyEdge: '#a7b4ba',
  compactHierarchyEdge: '#71838b',
  resolvedEdge: '#2b765f',
  secondaryEdge: '#71838b',
  fallbackEdge: '#7b6f8f',
  directRing: 'rgb(68 92 103 / 62%)',
  unresolvedSurface: '#fff8df',
  unresolvedBorder: '#a97a19',
  unresolvedText: '#765310',
  ambiguousSurface: '#fff0e2',
  ambiguousBorder: '#b35d25',
  ambiguousText: '#8b451d',
  invalidSurface: '#fff0f1',
  invalidStripe: '#fbe4e6',
  invalidBorder: '#a63845',
  invalidText: '#8a2f38',
  diagnosticShadow: 'rgb(74 51 22 / 13%)',
  edgeLabelBorder: '#718792',
  folderFill: 'rgb(73 126 149 / 5%)',
  folderStroke: 'rgb(55 109 132 / 38%)',
  folderRootFill: 'rgb(36 94 116 / 9%)',
  folderRootStroke: 'rgb(36 94 116 / 58%)',
  folderParentFill: 'rgb(73 126 149 / 3%)',
  folderParentStroke: 'rgb(55 109 132 / 30%)',
  folderNestedFill: 'rgb(73 126 149 / 6%)',
  folderNestedStroke: 'rgb(55 109 132 / 45%)',
  folderDepthTwoFill: 'rgb(91 117 155 / 6%)',
  folderDepthTwoStroke: 'rgb(68 92 130 / 55%)',
  folderDepthThreeFill: 'rgb(112 102 151 / 7%)',
  folderDepthThreeStroke: 'rgb(83 70 128 / 62%)',
  folderGuideStroke: 'rgb(55 109 132 / 18%)',
  folderActiveFill: 'rgb(73 126 149 / 10%)',
  folderActiveStroke: 'rgb(36 94 116 / 88%)',
  folderCurrentParentFill: 'rgb(73 126 149 / 7%)',
  folderCurrentParentStroke: 'rgb(36 94 116 / 66%)',
  folderSiblingStroke: 'rgb(78 123 143 / 70%)',
  folderText: '#214f61',
  folderDepthTwoText: '#445c7d',
  folderDepthThreeText: '#55477c',
  folderMutedText: '#60737d',
  contextSurface: 'rgb(255 255 255 / 98%)',
  contextBorder: '#8eb0be',
  contextText: '#173743',
  contextShadow: 'rgb(31 58 72 / 20%)',
  controlSurface: '#ffffff',
  controlBorder: '#a8b8c0',
  controlText: '#183b4b',
  controlHover: '#e8f1f3',
  controlDivider: '#d4dde1',
  controlShadow: 'rgb(16 23 35 / 14%)',
  statusSurface: 'rgb(255 255 255 / 92%)',
  statusBorder: '#8ca7b2',
  statusText: '#294b5a',
  statusShadow: 'rgb(16 35 45 / 12%)',
  warningSurface: '#fff4d2',
  warningBorder: '#b4781b',
  warningText: '#553a0d',
  moduleSurface: 'rgb(244 248 249 / 54%)',
  moduleBorder: 'rgb(73 103 116 / 28%)',
  moduleInset: 'rgb(255 255 255 / 70%)',
  moduleRootSurface: 'rgb(226 239 243 / 64%)',
  moduleRootBorder: 'rgb(28 82 103 / 58%)',
  moduleRootInset: 'rgb(28 82 103 / 12%)',
  moduleHighlightSurface: 'rgb(232 243 246 / 72%)',
  moduleHighlightBorder: 'rgb(36 94 116 / 82%)',
  bridgeSurface: 'rgb(247 250 251 / 92%)',
  bridgeBorder: '#879ca5',
  bridgeText: '#526b77',
  internalReference: '#21604b',
});

export const ICARUS_DARK_HIERARCHY_THEME: HierarchyTheme = Object.freeze({
  id: 'icarus-hierarchy-dark',
  canvasBackground: '#10171c',
  canvasGlow: 'rgb(48 78 91 / 38%)',
  canvasCompactOverlay: 'rgb(5 12 16 / 18%)',
  canvasCompactBackground: '#162129',
  canvasGrid: '#3b515c',
  nodeSurface: '#1b2a32',
  nodeText: '#e7eef1',
  nodeMuted: '#b9cbd3',
  nodeBorder: '#67818d',
  nodeShadow: 'rgb(0 0 0 / 34%)',
  nodeContextSurface: '#18242b',
  nodeContextText: '#9fb0b8',
  documentSurfaceEnd: '#223b46',
  documentBorder: '#6f95a4',
  documentAccent: '#7bb5c9',
  documentShadow: 'rgb(0 0 0 / 42%)',
  sectionSurfaceEnd: '#302f4d',
  sectionBorder: '#8c82b4',
  sectionAccent: '#a68af9',
  sectionShadow: 'rgb(0 0 0 / 38%)',
  blockSurface: '#302a1d',
  blockBorder: '#a58c54',
  blockAccent: '#d1ad57',
  compactSurface: '#1b2a32',
  compactShadow: 'rgb(0 0 0 / 30%)',
  compactDocumentSurface: '#1c303a',
  compactDocumentBorder: '#6f95a4',
  compactSectionSurface: '#29283f',
  compactBlockSurface: '#302a1d',
  markerDocument: '#9bcbd9',
  markerSection: '#c9c0f5',
  markerBlock: '#e0c27c',
  markerDiagnostic: '#e9973f',
  disclosureHoverSurface: 'rgb(41 70 83 / 78%)',
  disclosureHoverBorder: '#7694a2',
  selectedBorder: '#edf4f6',
  selectedRing: 'rgb(242 184 102 / 92%)',
  selectedShadow: 'rgb(0 0 0 / 48%)',
  highlight: '#9bcbd9',
  focusOutline: '#f2b866',
  rootOutline: '#7bb5c9',
  rootShadow: 'rgb(0 0 0 / 48%)',
  rootInvertedBorder: '#dceff0',
  rootInvertedSurface: '#dceff0',
  rootInvertedText: '#102b36',
  rootInvertedHover: 'rgb(16 43 54 / 12%)',
  rootInvertedHoverBorder: '#315766',
  referenceEdge: '#86a3af',
  hierarchyEdge: '#60737d',
  compactHierarchyEdge: '#8da0a9',
  resolvedEdge: '#75c3a6',
  secondaryEdge: '#718995',
  fallbackEdge: '#a89bc9',
  directRing: 'rgb(185 203 211 / 66%)',
  unresolvedSurface: '#3a311d',
  unresolvedBorder: '#d0a75b',
  unresolvedText: '#ffe5ad',
  ambiguousSurface: '#3e291b',
  ambiguousBorder: '#e9973f',
  ambiguousText: '#ffd9bd',
  invalidSurface: '#43262a',
  invalidStripe: '#362024',
  invalidBorder: '#ff8791',
  invalidText: '#ffd9dc',
  diagnosticShadow: 'rgb(0 0 0 / 38%)',
  edgeLabelBorder: '#67818d',
  folderFill: 'rgb(123 181 201 / 10%)',
  folderStroke: 'rgb(155 203 217 / 48%)',
  folderRootFill: 'rgb(123 181 201 / 16%)',
  folderRootStroke: 'rgb(155 203 217 / 72%)',
  folderParentFill: 'rgb(123 181 201 / 7%)',
  folderParentStroke: 'rgb(155 203 217 / 36%)',
  folderNestedFill: 'rgb(123 181 201 / 12%)',
  folderNestedStroke: 'rgb(155 203 217 / 56%)',
  folderDepthTwoFill: 'rgb(166 138 249 / 10%)',
  folderDepthTwoStroke: 'rgb(190 171 248 / 58%)',
  folderDepthThreeFill: 'rgb(176 145 218 / 12%)',
  folderDepthThreeStroke: 'rgb(206 182 237 / 64%)',
  folderGuideStroke: 'rgb(155 203 217 / 26%)',
  folderActiveFill: 'rgb(123 181 201 / 18%)',
  folderActiveStroke: 'rgb(155 203 217 / 92%)',
  folderCurrentParentFill: 'rgb(123 181 201 / 13%)',
  folderCurrentParentStroke: 'rgb(155 203 217 / 76%)',
  folderSiblingStroke: 'rgb(185 203 211 / 72%)',
  folderText: '#c6edf3',
  folderDepthTwoText: '#c9c0f5',
  folderDepthThreeText: '#d7c2ed',
  folderMutedText: '#9fb0b8',
  contextSurface: 'rgb(27 42 50 / 98%)',
  contextBorder: '#67818d',
  contextText: '#e7eef1',
  contextShadow: 'rgb(0 0 0 / 52%)',
  controlSurface: '#1b2a32',
  controlBorder: '#67818d',
  controlText: '#edf4f6',
  controlHover: '#294653',
  controlDivider: '#3b515c',
  controlShadow: 'rgb(0 0 0 / 44%)',
  statusSurface: 'rgb(27 42 50 / 94%)',
  statusBorder: '#67818d',
  statusText: '#dce7eb',
  statusShadow: 'rgb(0 0 0 / 42%)',
  warningSurface: '#3c301b',
  warningBorder: '#8d7240',
  warningText: '#ffe5ad',
  moduleSurface: 'rgb(38 57 67 / 56%)',
  moduleBorder: 'rgb(143 174 187 / 40%)',
  moduleInset: 'rgb(255 255 255 / 6%)',
  moduleRootSurface: 'rgb(45 79 91 / 64%)',
  moduleRootBorder: 'rgb(155 203 217 / 66%)',
  moduleRootInset: 'rgb(155 203 217 / 12%)',
  moduleHighlightSurface: 'rgb(50 88 103 / 74%)',
  moduleHighlightBorder: 'rgb(155 203 217 / 88%)',
  bridgeSurface: 'rgb(27 42 50 / 94%)',
  bridgeBorder: '#7694a2',
  bridgeText: '#b9cbd3',
  internalReference: '#75c3a6',
});

type HierarchyThemeRole = Exclude<keyof HierarchyTheme, 'id'>;
type HierarchyThemeVariable = `--hierarchy-${string}`;

const HIERARCHY_THEME_VARIABLES = {
  canvasBackground: '--hierarchy-canvas-background',
  canvasGlow: '--hierarchy-canvas-glow',
  canvasCompactOverlay: '--hierarchy-canvas-compact-overlay',
  canvasCompactBackground: '--hierarchy-canvas-compact-background',
  canvasGrid: '--hierarchy-canvas-grid',
  nodeSurface: '--hierarchy-node-surface',
  nodeText: '--hierarchy-node-text',
  nodeMuted: '--hierarchy-node-muted',
  nodeBorder: '--hierarchy-node-border',
  nodeShadow: '--hierarchy-node-shadow',
  nodeContextSurface: '--hierarchy-node-context-surface',
  nodeContextText: '--hierarchy-node-context-text',
  documentSurfaceEnd: '--hierarchy-document-surface-end',
  documentBorder: '--hierarchy-document-border',
  documentAccent: '--hierarchy-document-accent',
  documentShadow: '--hierarchy-document-shadow',
  sectionSurfaceEnd: '--hierarchy-section-surface-end',
  sectionBorder: '--hierarchy-section-border',
  sectionAccent: '--hierarchy-section-accent',
  sectionShadow: '--hierarchy-section-shadow',
  blockSurface: '--hierarchy-block-surface',
  blockBorder: '--hierarchy-block-border',
  blockAccent: '--hierarchy-block-accent',
  compactSurface: '--hierarchy-compact-surface',
  compactShadow: '--hierarchy-compact-shadow',
  compactDocumentSurface: '--hierarchy-compact-document-surface',
  compactDocumentBorder: '--hierarchy-compact-document-border',
  compactSectionSurface: '--hierarchy-compact-section-surface',
  compactBlockSurface: '--hierarchy-compact-block-surface',
  markerDocument: '--hierarchy-marker-document',
  markerSection: '--hierarchy-marker-section',
  markerBlock: '--hierarchy-marker-block',
  markerDiagnostic: '--hierarchy-marker-diagnostic',
  disclosureHoverSurface: '--hierarchy-disclosure-hover-surface',
  disclosureHoverBorder: '--hierarchy-disclosure-hover-border',
  selectedBorder: '--hierarchy-selected-border',
  selectedRing: '--hierarchy-selected-ring',
  selectedShadow: '--hierarchy-selected-shadow',
  highlight: '--hierarchy-highlight',
  focusOutline: '--hierarchy-focus-outline',
  rootOutline: '--hierarchy-root-outline',
  rootShadow: '--hierarchy-root-shadow',
  rootInvertedBorder: '--hierarchy-root-inverted-border',
  rootInvertedSurface: '--hierarchy-root-inverted-surface',
  rootInvertedText: '--hierarchy-root-inverted-text',
  rootInvertedHover: '--hierarchy-root-inverted-hover',
  rootInvertedHoverBorder: '--hierarchy-root-inverted-hover-border',
  referenceEdge: '--hierarchy-reference-edge',
  hierarchyEdge: '--hierarchy-hierarchy-edge',
  compactHierarchyEdge: '--hierarchy-compact-hierarchy-edge',
  resolvedEdge: '--hierarchy-resolved-edge',
  secondaryEdge: '--hierarchy-secondary-edge',
  fallbackEdge: '--hierarchy-fallback-edge',
  directRing: '--hierarchy-direct-ring',
  unresolvedSurface: '--hierarchy-unresolved-surface',
  unresolvedBorder: '--hierarchy-unresolved-border',
  unresolvedText: '--hierarchy-unresolved-text',
  ambiguousSurface: '--hierarchy-ambiguous-surface',
  ambiguousBorder: '--hierarchy-ambiguous-border',
  ambiguousText: '--hierarchy-ambiguous-text',
  invalidSurface: '--hierarchy-invalid-surface',
  invalidStripe: '--hierarchy-invalid-stripe',
  invalidBorder: '--hierarchy-invalid-border',
  invalidText: '--hierarchy-invalid-text',
  diagnosticShadow: '--hierarchy-diagnostic-shadow',
  edgeLabelBorder: '--hierarchy-edge-label-border',
  folderFill: '--hierarchy-folder-fill',
  folderStroke: '--hierarchy-folder-stroke',
  folderRootFill: '--hierarchy-folder-root-fill',
  folderRootStroke: '--hierarchy-folder-root-stroke',
  folderParentFill: '--hierarchy-folder-parent-fill',
  folderParentStroke: '--hierarchy-folder-parent-stroke',
  folderNestedFill: '--hierarchy-folder-nested-fill',
  folderNestedStroke: '--hierarchy-folder-nested-stroke',
  folderDepthTwoFill: '--hierarchy-folder-depth-two-fill',
  folderDepthTwoStroke: '--hierarchy-folder-depth-two-stroke',
  folderDepthThreeFill: '--hierarchy-folder-depth-three-fill',
  folderDepthThreeStroke: '--hierarchy-folder-depth-three-stroke',
  folderGuideStroke: '--hierarchy-folder-guide-stroke',
  folderActiveFill: '--hierarchy-folder-active-fill',
  folderActiveStroke: '--hierarchy-folder-active-stroke',
  folderCurrentParentFill: '--hierarchy-folder-current-parent-fill',
  folderCurrentParentStroke: '--hierarchy-folder-current-parent-stroke',
  folderSiblingStroke: '--hierarchy-folder-sibling-stroke',
  folderText: '--hierarchy-folder-text',
  folderDepthTwoText: '--hierarchy-folder-depth-two-text',
  folderDepthThreeText: '--hierarchy-folder-depth-three-text',
  folderMutedText: '--hierarchy-folder-muted-text',
  contextSurface: '--hierarchy-context-surface',
  contextBorder: '--hierarchy-context-border',
  contextText: '--hierarchy-context-text',
  contextShadow: '--hierarchy-context-shadow',
  controlSurface: '--hierarchy-control-surface',
  controlBorder: '--hierarchy-control-border',
  controlText: '--hierarchy-control-text',
  controlHover: '--hierarchy-control-hover',
  controlDivider: '--hierarchy-control-divider',
  controlShadow: '--hierarchy-control-shadow',
  statusSurface: '--hierarchy-status-surface',
  statusBorder: '--hierarchy-status-border',
  statusText: '--hierarchy-status-text',
  statusShadow: '--hierarchy-status-shadow',
  warningSurface: '--hierarchy-warning-surface',
  warningBorder: '--hierarchy-warning-border',
  warningText: '--hierarchy-warning-text',
  moduleSurface: '--hierarchy-module-surface',
  moduleBorder: '--hierarchy-module-border',
  moduleInset: '--hierarchy-module-inset',
  moduleRootSurface: '--hierarchy-module-root-surface',
  moduleRootBorder: '--hierarchy-module-root-border',
  moduleRootInset: '--hierarchy-module-root-inset',
  moduleHighlightSurface: '--hierarchy-module-highlight-surface',
  moduleHighlightBorder: '--hierarchy-module-highlight-border',
  bridgeSurface: '--hierarchy-bridge-surface',
  bridgeBorder: '--hierarchy-bridge-border',
  bridgeText: '--hierarchy-bridge-text',
  internalReference: '--hierarchy-internal-reference',
} as const satisfies Record<HierarchyThemeRole, HierarchyThemeVariable>;

export type HierarchyThemeStyle = CSSProperties &
  Readonly<Record<HierarchyThemeVariable, string>>;

function createHierarchyThemeStyle(theme: HierarchyTheme): HierarchyThemeStyle {
  const style: Record<string, string> = {};
  for (const role of Object.keys(
    HIERARCHY_THEME_VARIABLES,
  ) as HierarchyThemeRole[]) {
    style[HIERARCHY_THEME_VARIABLES[role]] = theme[role];
  }
  return Object.freeze(style) as HierarchyThemeStyle;
}

const LIGHT_HIERARCHY_STYLE = createHierarchyThemeStyle(
  ICARUS_LIGHT_HIERARCHY_THEME,
);
const DARK_HIERARCHY_STYLE = createHierarchyThemeStyle(
  ICARUS_DARK_HIERARCHY_THEME,
);

export function hierarchyThemeFor(theme: ResolvedTheme): HierarchyTheme {
  return theme === 'light'
    ? ICARUS_LIGHT_HIERARCHY_THEME
    : ICARUS_DARK_HIERARCHY_THEME;
}

export function hierarchyThemeStyleFor(
  theme: ResolvedTheme,
): HierarchyThemeStyle {
  return theme === 'light' ? LIGHT_HIERARCHY_STYLE : DARK_HIERARCHY_STYLE;
}
