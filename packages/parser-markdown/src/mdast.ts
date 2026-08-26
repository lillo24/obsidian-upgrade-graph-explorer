/**
 * Narrow parser-integration API for packages that already own an mdast tree.
 *
 * This subpath is infrastructure for source adapters, not canonical domain API.
 */
export { deriveMarkdownStructureFromMdast } from './structure';
export type { MarkdownStructureInput } from './structure';
