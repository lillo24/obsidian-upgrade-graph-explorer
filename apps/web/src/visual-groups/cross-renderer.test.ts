import type { AddressableEntity } from '@icarus-graph-explorer/core';
import { visualGroupAccentStyle } from '@icarus-graph-explorer/renderer-reactflow';
import {
  resolveGlobalNodeStyle,
  resolveGlobalLayoutSettings,
  resolveLocalNodeStyle,
  type GlobalNodeAttributes,
  type LocalNodeAttributes,
} from '@icarus-graph-explorer/renderer-sigma/core';
import { compileVisualGroups } from '@icarus-graph-explorer/visual-groups';
import { describe, expect, it } from 'vitest';

import { deriveVisualGroupPresentationMap } from './presentation';

const entity: AddressableEntity = {
  id: 'canonical-document',
  kind: 'document',
  source: {
    path: 'Research/Note.md',
    span: {
      start: { line: 1, column: 1 },
      end: { line: 2, column: 1 },
    },
  },
};

describe('cross-renderer Visual Group classification', () => {
  it('uses one canonical EntityId presentation in all four renderer modes', () => {
    const compilation = compileVisualGroups([
      {
        name: 'Research',
        query: 'path:"Research"',
        color: 'violet',
        enabled: true,
      },
    ]);
    if (!compilation.ok) throw new Error(compilation.issues[0]?.message);
    const styles = deriveVisualGroupPresentationMap(
      [entity.id],
      new Map([[entity.id, entity]]),
      compilation.value,
    );
    const presentation = styles.get(entity.id);
    if (presentation === undefined) throw new Error('Expected a group match.');

    const structureStyle = visualGroupAccentStyle(presentation);
    const localStructuredStyle = visualGroupAccentStyle(presentation);
    const globalAttributes: GlobalNodeAttributes = {
      x: 0,
      y: 0,
      size: 4,
      color: '#277b95',
      label: 'Note',
      nodeKind: 'document',
      entityId: entity.id,
      sourcePath: entity.source.path,
      status: null,
      folderKey: 'Research',
      revealableDescendantCount: 0,
    };
    const localAttributes: LocalNodeAttributes = {
      x: 0,
      y: 0,
      size: 4,
      color: '#176f8a',
      label: 'Note',
      nodeKind: 'document',
      entityId: entity.id,
      sourcePath: entity.source.path,
      status: null,
      root: false,
      revealableDescendantCount: 0,
    };
    const globalStyle = resolveGlobalNodeStyle(globalAttributes, {
      hovered: false,
      relatedToHover: true,
      selected: false,
      lod: 'near',
      settings: resolveGlobalLayoutSettings({
        folderClustering: true,
        spacingPreset: 'normal',
      }),
      visualGroup: presentation,
    });
    const localStyle = resolveLocalNodeStyle(localAttributes, {
      hovered: false,
      relatedToHover: true,
      selected: false,
      lod: 'near-local',
      visualGroup: presentation,
    });

    expect(presentation).toEqual({
      groupName: 'Research',
      color: 'violet',
      accent: '#7c3aed',
    });
    expect(structureStyle).toMatchObject({
      '--visual-group-accent': presentation.accent,
    });
    expect(localStructuredStyle).toEqual(structureStyle);
    expect(globalStyle.color).toBe(presentation.accent);
    expect(localStyle.color).toBe(presentation.accent);
  });
});
