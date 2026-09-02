import { describe, expect, it, vi } from 'vitest';

vi.mock('sigma', () => ({ default: class {} }));

import { GLOBAL_INTERACTION_OPERATION_CONTRACTS } from './interaction-contract';
import { LOCAL_INTERACTION_OPERATION_CONTRACTS } from './local-interaction-contract';
import { LocalRendererSession } from './local-session';
import { resolveLocalEdgeStyle, resolveLocalNodeStyle } from './local-style';
import { resolveGlobalLayoutSettings } from './settings';
import { GlobalRendererSession } from './session';
import { resolveGlobalNodeStyle } from './style';
import type {
  GlobalNodeAttributes,
  LocalEdgeAttributes,
  LocalNodeAttributes,
} from './types';

const presentation = {
  groupName: 'Research',
  color: 'violet',
  accent: '#7c3aed',
} as const;

const globalDocument: GlobalNodeAttributes = {
  x: 14,
  y: -9,
  size: 4,
  color: '#277b95',
  label: 'Document',
  nodeKind: 'document',
  entityId: 'document',
  sourcePath: 'Document.md',
  status: null,
  folderKey: '.',
  revealableDescendantCount: 0,
};
const globalDiagnostic: GlobalNodeAttributes = {
  ...globalDocument,
  color: '#d6a23f',
  nodeKind: 'diagnostic',
  entityId: null,
  sourcePath: null,
  status: 'unresolved',
  folderKey: null,
};
const localEntity = (
  nodeKind: 'document' | 'section' | 'block',
): LocalNodeAttributes => ({
  x: 8,
  y: 3,
  size: 4,
  color: '#176f8a',
  label: nodeKind,
  nodeKind,
  entityId: nodeKind,
  sourcePath: `${nodeKind}.md`,
  status: null,
  root: nodeKind === 'document',
  revealableDescendantCount: 0,
});
const localDiagnostic: LocalNodeAttributes = {
  ...localEntity('block'),
  color: '#c45b50',
  nodeKind: 'diagnostic',
  entityId: null,
  sourcePath: null,
  status: 'invalid',
  root: false,
};

describe('cross-Sigma Visual Group style contract', () => {
  it('layers Global group accent below hover, selection, deemphasis, and LOD labels', () => {
    const settings = resolveGlobalLayoutSettings({
      folderClustering: true,
      spacingPreset: 'normal',
    });
    const base = resolveGlobalNodeStyle(globalDocument, {
      hovered: false,
      relatedToHover: true,
      selected: false,
      lod: 'far',
      settings,
      visualGroup: presentation,
    });
    expect(base).toMatchObject({
      color: presentation.accent,
      label: '',
      x: 14,
      y: -9,
      size: 4,
      folderKey: '.',
    });
    expect(
      resolveGlobalNodeStyle(globalDocument, {
        hovered: true,
        relatedToHover: true,
        selected: false,
        lod: 'near',
        settings,
        visualGroup: presentation,
      }).color,
    ).toBe('#55a8c2');
    expect(
      resolveGlobalNodeStyle(globalDocument, {
        hovered: false,
        relatedToHover: true,
        selected: true,
        lod: 'near',
        settings,
        visualGroup: presentation,
      }).color,
    ).toBe('#d7a126');
    expect(
      resolveGlobalNodeStyle(globalDocument, {
        hovered: false,
        relatedToHover: false,
        selected: false,
        lod: 'near',
        settings,
        visualGroup: presentation,
      }).color,
    ).toBe('#d8e0e3');
    expect(
      resolveGlobalNodeStyle(globalDiagnostic, {
        hovered: false,
        relatedToHover: true,
        selected: false,
        lod: 'near',
        settings,
        visualGroup: presentation,
      }).color,
    ).toBe(globalDiagnostic.color);
  });

  it.each(['document', 'section', 'block'] as const)(
    'applies the same Local Free accent to %s without moving it',
    (kind) => {
      const attributes = localEntity(kind);
      expect(
        resolveLocalNodeStyle(attributes, {
          hovered: false,
          relatedToHover: true,
          selected: false,
          lod: 'normal-local',
          visualGroup: presentation,
        }),
      ).toMatchObject({
        color: presentation.accent,
        x: attributes.x,
        y: attributes.y,
        size: attributes.size,
      });
    },
  );

  it('keeps Local diagnostics, edges, root, hover, and selection authoritative', () => {
    expect(
      resolveLocalNodeStyle(localDiagnostic, {
        hovered: false,
        relatedToHover: true,
        selected: false,
        lod: 'near-local',
        visualGroup: presentation,
      }).color,
    ).toBe(localDiagnostic.color);
    const root = localEntity('document');
    expect(
      resolveLocalNodeStyle(root, {
        hovered: false,
        relatedToHover: true,
        selected: false,
        lod: 'far-local',
        visualGroup: presentation,
      }),
    ).toMatchObject({ forceLabel: true, zIndex: 2 });
    expect(
      resolveLocalNodeStyle(root, {
        hovered: true,
        relatedToHover: true,
        selected: false,
        lod: 'near-local',
        visualGroup: presentation,
      }).color,
    ).toBe('#38a5c2');
    expect(
      resolveLocalNodeStyle(root, {
        hovered: false,
        relatedToHover: true,
        selected: true,
        lod: 'near-local',
        visualGroup: presentation,
      }).color,
    ).toBe('#d29b22');
    const edge: LocalEdgeAttributes = {
      size: 1,
      color: '#91aab2',
      edgeKind: 'reference',
      weight: 1,
      referenceCount: 1,
    };
    expect(
      resolveLocalEdgeStyle(edge, {
        relatedToHover: true,
        hoverActive: false,
        lod: 'near-local',
      }),
    ).toEqual({ ...edge, hidden: false, size: 1, zIndex: 0 });
  });

  it('updates the actual Global session through one style refresh only', () => {
    const refresh = vi.fn();
    const count = vi.fn();
    const session = Object.create(
      GlobalRendererSession.prototype,
    ) as GlobalRendererSession;
    Reflect.set(session, 'graph', { nodes: () => ['document', 'other'] });
    Reflect.set(session, 'renderer', { refresh });
    Reflect.set(session, 'options', { instrumentation: { count } });

    session.setVisualGroupStyles(new Map([['document', presentation]]));

    expect(refresh).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledWith({
      partialGraph: { nodes: ['document', 'other'] },
      skipIndexation: true,
      schedule: true,
    });
    expect(count).toHaveBeenCalledWith('global-style-updates');
    expect(
      GLOBAL_INTERACTION_OPERATION_CONTRACTS['visual-group-style-change'],
    ).toEqual({
      projection: 0,
      graphReconciliation: 0,
      layoutRequest: 0,
      visualRefresh: 1,
    });
  });

  it('queues a Global style refresh while changed topology is being indexed', () => {
    const refresh = vi.fn();
    const count = vi.fn();
    const session = Object.create(
      GlobalRendererSession.prototype,
    ) as GlobalRendererSession;
    Reflect.set(session, 'graph', { nodes: () => ['document'] });
    Reflect.set(session, 'renderer', { refresh });
    Reflect.set(session, 'options', { instrumentation: { count } });
    Reflect.set(session, 'topologyRefreshPending', Promise.resolve());

    session.setVisualGroupStyles(new Map([['document', presentation]]));

    expect(refresh).not.toHaveBeenCalled();
    expect(count).toHaveBeenCalledWith('global-style-updates');
    expect(Reflect.get(session, 'visualStyleRefreshPending')).toBe(true);
  });

  it('updates the actual Local session through one style refresh only', () => {
    const refresh = vi.fn();
    const count = vi.fn();
    const session = Object.create(
      LocalRendererSession.prototype,
    ) as LocalRendererSession;
    Reflect.set(session, 'graph', { nodes: () => ['document', 'section'] });
    Reflect.set(session, 'renderer', { refresh });
    Reflect.set(session, 'options', { instrumentation: { count } });

    session.setVisualGroupStyles(new Map([['section', presentation]]));

    expect(refresh).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledWith({
      partialGraph: { nodes: ['document', 'section'] },
      skipIndexation: true,
      schedule: true,
    });
    expect(count).toHaveBeenCalledWith('local-style-updates');
    expect(
      LOCAL_INTERACTION_OPERATION_CONTRACTS['visual-group-style-change'],
    ).toEqual({
      projection: 0,
      topologyReconciliation: 0,
      layoutRequest: 0,
      globalLayoutRequest: 0,
      visualRefresh: 1,
    });
  });
});
