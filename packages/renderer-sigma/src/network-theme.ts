import type { ResolvedTheme } from '@icarus-graph-explorer/theme';

export interface NetworkTheme {
  readonly id: 'obsidian-light' | 'obsidian-dark';
  readonly background: string;
  readonly edge: string;
  readonly hierarchyEdge: string;
  readonly label: string;
  readonly node: string;
  readonly sectionNode: string;
  readonly blockNode: string;
  readonly dimmedNode: string;
  readonly dimmedEdge: string;
  readonly unresolvedNodeBase: string;
  readonly unresolvedNode: string;
  readonly focusedNode: string;
  readonly highlight: string;
  readonly tagNode: string;
  readonly attachmentNode: string;
  readonly diagnosticAmbiguous: string;
  readonly diagnosticInvalid: string;
  readonly scopeShadowed: string;
  readonly scopeExcluded: string;
  readonly scopeInactive: string;
}

/** Obsidian 1.11.5 default-light Graph View values resolved from app.css. */
export const OBSIDIAN_LIGHT_NETWORK_THEME: NetworkTheme = {
  id: 'obsidian-light',
  background: '#ffffff',
  edge: '#d4d4d4',
  hierarchyEdge: '#ababab',
  label: '#222222',
  node: '#5c5c5c',
  sectionNode: '#7852ee',
  blockNode: '#707070',
  dimmedNode: 'rgba(92, 92, 92, 0.2)',
  dimmedEdge: 'rgba(212, 212, 212, 0.2)',
  unresolvedNodeBase: '#ababab',
  unresolvedNode: 'rgba(171, 171, 171, 0.5)',
  focusedNode: '#8a5cf5',
  highlight: '#9873f7',
  tagNode: '#08b94e',
  attachmentNode: '#e0ac00',
  diagnosticAmbiguous: '#ec7500',
  diagnosticInvalid: '#e93147',
  scopeShadowed: '#52658a',
  scopeExcluded: '#bdbdbd',
  scopeInactive: '#e0e0e0',
};

/** Obsidian 1.11.5 default-dark Graph View colors resolved from app.css. */
export const OBSIDIAN_DARK_NETWORK_THEME: NetworkTheme = {
  id: 'obsidian-dark',
  background: '#1e1e1e',
  edge: '#3f3f3f',
  hierarchyEdge: '#666666',
  label: '#dadada',
  node: '#b3b3b3',
  sectionNode: '#a882ff',
  blockNode: '#999999',
  dimmedNode: 'rgba(179, 179, 179, 0.2)',
  dimmedEdge: 'rgba(63, 63, 63, 0.2)',
  unresolvedNodeBase: '#666666',
  unresolvedNode: 'rgba(102, 102, 102, 0.5)',
  focusedNode: '#a68af9',
  highlight: '#8a5cf5',
  tagNode: '#44cf6e',
  attachmentNode: '#e0de71',
  diagnosticAmbiguous: '#e9973f',
  diagnosticInvalid: '#fb464c',
  scopeShadowed: '#7486aa',
  scopeExcluded: '#555555',
  scopeInactive: '#363636',
};

export function networkThemeFor(theme: ResolvedTheme): NetworkTheme {
  return theme === 'light'
    ? OBSIDIAN_LIGHT_NETWORK_THEME
    : OBSIDIAN_DARK_NETWORK_THEME;
}

export const NETWORK_LABEL_FONT_FAMILY =
  'ui-sans-serif, -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, Inter, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Microsoft YaHei Light", sans-serif';

const DARK_INCIDENT_EDGE_LIGHTENING = 0.28;
const LIGHT_INCIDENT_EDGE_DARKENING = 0.18;

/** Preserve semantic edge hues while improving contrast against this theme. */
export function resolveIncidentEdgeColor(
  color: string,
  theme: NetworkTheme = OBSIDIAN_DARK_NETWORK_THEME,
): string {
  const normalized = color.toLowerCase();
  if (
    normalized === theme.edge.toLowerCase() ||
    normalized === theme.hierarchyEdge.toLowerCase()
  ) {
    return theme.highlight;
  }
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (match === null) return theme.highlight;
  const value = Number.parseInt(match[1]!, 16);
  const adjust =
    theme.id === 'obsidian-light'
      ? (channel: number) =>
          Math.round(channel * (1 - LIGHT_INCIDENT_EDGE_DARKENING))
      : (channel: number) =>
          Math.round(channel + (255 - channel) * DARK_INCIDENT_EDGE_LIGHTENING);
  const red = adjust((value >> 16) & 0xff);
  const green = adjust((value >> 8) & 0xff);
  const blue = adjust(value & 0xff);
  return `#${[red, green, blue]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`;
}

function parseHexColor(
  color: string,
): readonly [number, number, number] | null {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (match === null) return null;
  const value = Number.parseInt(match[1]!, 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

/** Interpolate the six-digit hex colors used by production Network edges. */
export function interpolateNetworkEdgeColor(
  baseColor: string,
  progress: number,
  theme: NetworkTheme = OBSIDIAN_DARK_NETWORK_THEME,
): string {
  const amount = Math.min(1, Math.max(0, progress));
  if (amount === 0) return baseColor;
  const targetColor = resolveIncidentEdgeColor(baseColor, theme);
  if (amount === 1) return targetColor;
  const base = parseHexColor(baseColor);
  const target = parseHexColor(targetColor);
  if (base === null || target === null) return baseColor;
  return `#${base
    .map((channel, index) =>
      Math.round(channel + (target[index]! - channel) * amount)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}
