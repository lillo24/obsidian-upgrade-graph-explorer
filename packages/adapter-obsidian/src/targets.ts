import type { ParsedInternalTarget } from './types';

export const BLOCK_ID_PATTERN = /^[A-Za-z0-9-]+$/u;

export type TargetParseFailure =
  'malformed' | 'invalid-block-id' | 'unsupported-search-shortcut';

export type TargetParseResult =
  | { readonly ok: true; readonly target: ParsedInternalTarget }
  | { readonly ok: false; readonly failure: TargetParseFailure };

/** Split syntax only. Normalization and workspace matching belong to KG4. */
export function parseInternalTarget(rawTarget: string): TargetParseResult {
  if (rawTarget.length === 0) {
    return { ok: false, failure: 'malformed' };
  }

  if (rawTarget.startsWith('##') || rawTarget.startsWith('^^')) {
    return { ok: false, failure: 'unsupported-search-shortcut' };
  }

  const hashOffset = rawTarget.indexOf('#');
  if (hashOffset < 0) {
    return {
      ok: true,
      target: { kind: 'file', file: rawTarget },
    };
  }

  const file = rawTarget.slice(0, hashOffset);
  const fragment = rawTarget.slice(hashOffset + 1);
  if (fragment.length === 0) {
    return { ok: false, failure: 'malformed' };
  }

  if (fragment.startsWith('^')) {
    const blockId = fragment.slice(1);
    if (!BLOCK_ID_PATTERN.test(blockId)) {
      return { ok: false, failure: 'invalid-block-id' };
    }

    return file.length === 0
      ? { ok: true, target: { kind: 'block', blockId } }
      : { ok: true, target: { kind: 'block', file, blockId } };
  }

  const headings = fragment.split('#');
  if (headings.some((heading) => heading.length === 0)) {
    return { ok: false, failure: 'malformed' };
  }

  return file.length === 0
    ? { ok: true, target: { kind: 'heading', headings } }
    : { ok: true, target: { kind: 'heading', file, headings } };
}

export function isObviousExternalTarget(target: string): boolean {
  return target.startsWith('//') || /^[A-Za-z][A-Za-z\d+.-]*:/u.test(target);
}
