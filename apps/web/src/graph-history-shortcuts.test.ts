import { describe, expect, it } from 'vitest';

import {
  graphHistoryShortcut,
  type GraphHistoryShortcutInput,
} from './graph-history-shortcuts';

const available: GraphHistoryShortcutInput = {
  key: 'ArrowLeft',
  altKey: true,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  repeat: false,
  editableTarget: false,
  graphContext: true,
  applicationOverlayOpen: false,
  canGoBack: true,
  canGoForward: true,
};

describe('graph history keyboard shortcuts', () => {
  it('supports exact Alt arrow shortcuts', () => {
    expect(graphHistoryShortcut(available)).toBe('back');
    expect(graphHistoryShortcut({ ...available, key: 'ArrowRight' })).toBe(
      'forward',
    );
  });

  it('supports guarded Ctrl/Meta Z aliases without Ctrl+Y', () => {
    expect(
      graphHistoryShortcut({
        ...available,
        key: 'z',
        altKey: false,
        ctrlKey: true,
      }),
    ).toBe('back');
    expect(
      graphHistoryShortcut({
        ...available,
        key: 'Z',
        altKey: false,
        metaKey: true,
        shiftKey: true,
      }),
    ).toBe('forward');
    expect(
      graphHistoryShortcut({
        ...available,
        key: 'y',
        altKey: false,
        ctrlKey: true,
      }),
    ).toBeNull();
  });

  it('never consumes unavailable directions or ineligible contexts', () => {
    expect(graphHistoryShortcut({ ...available, canGoBack: false })).toBeNull();
    expect(
      graphHistoryShortcut({ ...available, editableTarget: true }),
    ).toBeNull();
    expect(
      graphHistoryShortcut({ ...available, graphContext: false }),
    ).toBeNull();
    expect(
      graphHistoryShortcut({ ...available, applicationOverlayOpen: true }),
    ).toBeNull();
    expect(graphHistoryShortcut({ ...available, repeat: true })).toBeNull();
  });

  it('rejects extra or ambiguous modifiers', () => {
    expect(graphHistoryShortcut({ ...available, shiftKey: true })).toBeNull();
    expect(graphHistoryShortcut({ ...available, ctrlKey: true })).toBeNull();
    expect(
      graphHistoryShortcut({
        ...available,
        key: 'z',
        altKey: false,
        ctrlKey: true,
        metaKey: true,
      }),
    ).toBeNull();
    expect(
      graphHistoryShortcut({
        ...available,
        key: 'z',
        ctrlKey: true,
      }),
    ).toBeNull();
  });
});
