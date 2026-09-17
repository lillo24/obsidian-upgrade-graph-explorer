/** Obsidian 1.11.5 default-dark Graph View colors resolved from app.css. */
export const OBSIDIAN_DARK_NETWORK_THEME = {
  background: '#1e1e1e',
  edge: '#3f3f3f',
  hierarchyEdge: '#666666',
  label: '#dadada',
  node: '#b3b3b3',
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
} as const;

export const NETWORK_GRAPH_THEME_ID = 'obsidian-dark';

export const NETWORK_LABEL_FONT_FAMILY =
  'ui-sans-serif, -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, Inter, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Microsoft YaHei Light", sans-serif';

const INCIDENT_EDGE_LIGHTENING = 0.28;

/** Preserve semantic edge hues while making direct hover relationships legible. */
export function resolveIncidentEdgeColor(color: string): string {
  const normalized = color.toLowerCase();
  if (
    normalized === OBSIDIAN_DARK_NETWORK_THEME.edge ||
    normalized === OBSIDIAN_DARK_NETWORK_THEME.hierarchyEdge
  ) {
    return OBSIDIAN_DARK_NETWORK_THEME.highlight;
  }
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (match === null) return OBSIDIAN_DARK_NETWORK_THEME.highlight;
  const value = Number.parseInt(match[1]!, 16);
  const brighten = (channel: number) =>
    Math.round(channel + (255 - channel) * INCIDENT_EDGE_LIGHTENING);
  const red = brighten((value >> 16) & 0xff);
  const green = brighten((value >> 8) & 0xff);
  const blue = brighten(value & 0xff);
  return `#${[red, green, blue]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`;
}
