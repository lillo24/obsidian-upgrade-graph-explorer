import { describe, expect, it } from 'vitest';

import {
  DEFAULT_FOCUS_SCHEMATIC_PRODUCT_LAYOUT_POLICIES,
  ENDPOINT_FIXTURES,
  FOCUS_SCHEMATIC_PRODUCTION_LAYOUT_SETTINGS,
  buildEndpointFixture,
  computeFocusSchematicComputedLayout,
  computeFocusSchematicComputedLayoutAttempt,
  computeFocusSchematicSoftClusterLayoutAttempt,
  applyFocusSchematicSoftRadialSpread,
  type FocusSchematicLayoutInput,
  type FocusSchematicProductLayoutPolicies,
} from '@icarus-graph-explorer/focus-schematic-layout';
import { focusSchematicNodeDimensions } from '@icarus-graph-explorer/renderer-reactflow/focus-schematic';

import {
  exactFocusSchematicLayoutCacheKey,
  FocusSchematicLayoutCache,
} from './focus-schematic-layout-cache';

function fixtureInput(index = 0): FocusSchematicLayoutInput {
  const fixture = buildEndpointFixture(ENDPOINT_FIXTURES[index]!);
  return {
    model: fixture.model,
    projection: fixture.projection,
    nodeDimensions: focusSchematicNodeDimensions(
      fixture.projection,
      fixture.model,
    ),
    settings: FOCUS_SCHEMATIC_PRODUCTION_LAYOUT_SETTINGS,
  };
}

describe('page-lifetime Focus Schematic layout cache', () => {
  it('uses the exact algorithm/model/projection/dimension/settings input', () => {
    const input = fixtureInput();
    const key = exactFocusSchematicLayoutCacheKey(input);
    expect(key).toContain('modular-focus-hierarchy');
    expect(key).toContain('"algorithmVersion":4');
    expect(key).toContain('"protocolVersion":14');
    expect(
      key.replace('"protocolVersion":14', '"protocolVersion":13'),
    ).not.toBe(key);
    expect(exactFocusSchematicLayoutCacheKey(input, 1)).not.toBe(key);
    expect(key).toContain('nodeDimensions');
    expect(key).toContain('settings');
    expect(key).toContain('"internalLayoutVariant":"adaptive-compass"');
    expect(exactFocusSchematicLayoutCacheKey(input)).toBe(key);
    expect(
      exactFocusSchematicLayoutCacheKey({
        ...input,
        model: {
          ...input.model,
          focus: { ...input.model.focus, hops: 2 },
        },
      }),
    ).not.toBe(key);
    expect(exactFocusSchematicLayoutCacheKey(fixtureInput(1))).not.toBe(key);
    expect(exactFocusSchematicLayoutCacheKey(fixtureInput(2))).not.toBe(key);
    expect(
      exactFocusSchematicLayoutCacheKey({
        ...input,
        settings: { ...input.settings, directionalFolderBandsEnabled: false },
      }),
    ).not.toBe(key);
    expect(
      exactFocusSchematicLayoutCacheKey({
        ...input,
        settings: {
          ...input.settings,
          directionalFolderHierarchy: 'nested-one-level',
        },
      }),
    ).not.toBe(key);
  });

  it('distinguishes and restores all four product policy combinations exactly', () => {
    const input = fixtureInput(4);
    const snapshot = JSON.stringify(input);
    const cache = new FocusSchematicLayoutCache();
    const policies: FocusSchematicProductLayoutPolicies[] = [
      {
        ...DEFAULT_FOCUS_SCHEMATIC_PRODUCT_LAYOUT_POLICIES,
        internalLayoutVariant: 'adaptive-compass',
        endpointOrderPolicy: 'crossing-optimized',
      },
      {
        ...DEFAULT_FOCUS_SCHEMATIC_PRODUCT_LAYOUT_POLICIES,
        internalLayoutVariant: 'adaptive-compass',
        endpointOrderPolicy: 'document-order',
      },
      {
        ...DEFAULT_FOCUS_SCHEMATIC_PRODUCT_LAYOUT_POLICIES,
        internalLayoutVariant: 'vertical-spine',
        endpointOrderPolicy: 'crossing-optimized',
      },
      {
        ...DEFAULT_FOCUS_SCHEMATIC_PRODUCT_LAYOUT_POLICIES,
        internalLayoutVariant: 'vertical-spine',
        endpointOrderPolicy: 'document-order',
      },
    ];
    expect(
      new Set(
        policies.map((policy) =>
          exactFocusSchematicLayoutCacheKey(input, policy),
        ),
      ).size,
    ).toBe(4);

    const results = policies.map((policy) => {
      const attempt = computeFocusSchematicComputedLayoutAttempt(input, policy);
      if (attempt.status !== 'success') throw new Error(attempt.reason);
      cache.set(input, policy, attempt.result);
      expect(cache.get(input, policy)).toMatchObject({
        status: 'hit',
        value: attempt.result,
      });
      return attempt.result;
    });

    for (const [index, policy] of policies.entries())
      expect(cache.get(input, policy).value).toEqual(results[index]);
    expect(JSON.stringify(input)).toBe(snapshot);
    expect(
      cache.get(input, DEFAULT_FOCUS_SCHEMATIC_PRODUCT_LAYOUT_POLICIES).value,
    ).toEqual(results[0]);
  });

  it('re-enters unchanged semantics from cache with zero additional compute', () => {
    const cache = new FocusSchematicLayoutCache();
    const input = fixtureInput(4);
    let workerComputes = 0;
    const load = () => {
      const cached = cache.get(input);
      if (cached.status === 'hit') return cached.value!;
      workerComputes += 1;
      const computed = computeFocusSchematicComputedLayout(input);
      cache.set(input, computed);
      return computed;
    };

    const first = load();
    const afterClassicRoundTrip = load();
    expect(afterClassicRoundTrip.candidate).toEqual(first.candidate);
    expect(workerComputes).toBe(1);

    const layoutRelevantChange = fixtureInput(5);
    expect(cache.get(layoutRelevantChange).status).toBe('miss');
    expect(exactFocusSchematicLayoutCacheKey(layoutRelevantChange)).not.toBe(
      exactFocusSchematicLayoutCacheKey(input),
    );
  });

  it('keys Soft strength only when Soft Clusters is active and restores prior strengths', () => {
    const directionalInput = fixtureInput(4);
    const softInput = {
      ...directionalInput,
      settings: {
        ...directionalInput.settings,
        directionalFolderBandsEnabled: false,
      },
    };
    const directionalLow = {
      ...DEFAULT_FOCUS_SCHEMATIC_PRODUCT_LAYOUT_POLICIES,
      softFolderStrength: 0,
    };
    const directionalHigh = {
      ...DEFAULT_FOCUS_SCHEMATIC_PRODUCT_LAYOUT_POLICIES,
      softFolderStrength: 100,
    };
    expect(
      exactFocusSchematicLayoutCacheKey(directionalInput, directionalLow),
    ).toBe(
      exactFocusSchematicLayoutCacheKey(directionalInput, directionalHigh),
    );

    const cache = new FocusSchematicLayoutCache();
    const policiesAt = (softFolderStrength: number) =>
      ({
        ...DEFAULT_FOCUS_SCHEMATIC_PRODUCT_LAYOUT_POLICIES,
        macroLayout: 'soft-folder-clusters',
        softFolderStrength,
      }) as const;
    expect(
      exactFocusSchematicLayoutCacheKey(softInput, policiesAt(50)),
    ).toContain('"algorithmVersion":12');
    expect(
      exactFocusSchematicLayoutCacheKey(
        directionalInput,
        DEFAULT_FOCUS_SCHEMATIC_PRODUCT_LAYOUT_POLICIES,
      ),
    ).toContain('"algorithmVersion":4');
    const at25 = computeFocusSchematicSoftClusterLayoutAttempt(softInput, {
      strength: 25,
    });
    const at75 = computeFocusSchematicSoftClusterLayoutAttempt(softInput, {
      strength: 75,
    });
    if (at25.status !== 'success' || at75.status !== 'success')
      throw new Error('Expected Soft Cluster cache fixtures to compute.');
    cache.set(softInput, policiesAt(25), at25.result);
    cache.set(softInput, policiesAt(75), at75.result);
    expect(cache.get(softInput, policiesAt(25))).toMatchObject({
      status: 'hit',
      value: at25.result,
    });
    expect(cache.get(softInput, policiesAt(75))).toMatchObject({
      status: 'hit',
      value: at75.result,
    });
    expect(
      exactFocusSchematicLayoutCacheKey(softInput, policiesAt(25)),
    ).not.toBe(exactFocusSchematicLayoutCacheKey(softInput, policiesAt(75)));
    expect(
      exactFocusSchematicLayoutCacheKey(
        directionalInput,
        DEFAULT_FOCUS_SCHEMATIC_PRODUCT_LAYOUT_POLICIES,
      ),
    ).not.toBe(exactFocusSchematicLayoutCacheKey(softInput, policiesAt(50)));
  });

  it('keys nested decay, canonicalizes Direct-only decay, and excludes radial spread', () => {
    const directionalInput = fixtureInput(4);
    const softInput = {
      ...directionalInput,
      settings: {
        ...directionalInput.settings,
        directionalFolderBandsEnabled: false,
      },
    };
    const policiesAt = (
      softFolderScopeMode: 'nested' | 'nearest-only',
      softAncestorDecayBase: 3 | 4,
      macroLayout:
        'soft-folder-clusters' | 'directional-bands' = 'soft-folder-clusters',
    ) => ({
      ...DEFAULT_FOCUS_SCHEMATIC_PRODUCT_LAYOUT_POLICIES,
      macroLayout,
      softFolderScopeMode,
      softAncestorDecayBase,
    });
    expect(
      exactFocusSchematicLayoutCacheKey(
        directionalInput,
        policiesAt('nested', 3, 'directional-bands'),
      ),
    ).toBe(
      exactFocusSchematicLayoutCacheKey(
        directionalInput,
        policiesAt('nearest-only', 4, 'directional-bands'),
      ),
    );
    expect(
      exactFocusSchematicLayoutCacheKey(softInput, policiesAt('nested', 3)),
    ).not.toBe(
      exactFocusSchematicLayoutCacheKey(softInput, policiesAt('nested', 4)),
    );
    expect(
      exactFocusSchematicLayoutCacheKey(
        softInput,
        policiesAt('nearest-only', 3),
      ),
    ).toBe(
      exactFocusSchematicLayoutCacheKey(
        softInput,
        policiesAt('nearest-only', 4),
      ),
    );

    const nested = computeFocusSchematicSoftClusterLayoutAttempt(softInput, {
      folderScopeMode: 'nested',
      ancestorDecayBase: 3,
    });
    const direct = computeFocusSchematicSoftClusterLayoutAttempt(softInput, {
      folderScopeMode: 'nearest-only',
      ancestorDecayBase: 4,
    });
    if (nested.status !== 'success' || direct.status !== 'success')
      throw new Error('Expected Soft scope cache fixtures to compute.');
    const cache = new FocusSchematicLayoutCache();
    cache.set(softInput, policiesAt('nested', 3), nested.result);
    cache.set(softInput, policiesAt('nearest-only', 4), direct.result);
    expect(cache.get(softInput, policiesAt('nested', 3))).toMatchObject({
      status: 'hit',
      value: nested.result,
    });
    expect(cache.get(softInput, policiesAt('nearest-only', 3))).toMatchObject({
      status: 'hit',
      value: direct.result,
    });
  });

  it('reuses one structural Soft compute across many radial spread values', () => {
    const input = fixtureInput(4);
    const softInput = {
      ...input,
      settings: { ...input.settings, directionalFolderBandsEnabled: false },
    };
    const policies = {
      ...DEFAULT_FOCUS_SCHEMATIC_PRODUCT_LAYOUT_POLICIES,
      macroLayout: 'soft-folder-clusters',
    } as const;
    const cache = new FocusSchematicLayoutCache();
    let structuralComputeCount = 0;
    const structural = () => {
      const lookup = cache.get(softInput, policies);
      if (lookup.status === 'hit') return lookup.value!;
      structuralComputeCount += 1;
      const attempt = computeFocusSchematicSoftClusterLayoutAttempt(softInput);
      if (attempt.status !== 'success') throw new Error(attempt.reason);
      cache.set(softInput, policies, attempt.result);
      return attempt.result;
    };
    const base = structural();
    for (const spacing of [0, 25, 50, 71, 72, 73, 75, 100])
      expect(
        applyFocusSchematicSoftRadialSpread(softInput, structural(), spacing)
          .candidate.modules,
      ).toHaveLength(base.candidate.modules.length);
    expect(structuralComputeCount).toBe(1);
    expect(cache.size).toBe(1);
  });

  it('keys canonical manual display intent only in Soft mode', () => {
    const input = fixtureInput(4);
    const displayIntent = {
      fileParentOverrides: [
        { fileId: 'a', displayParentFolderKey: 'A' },
        { fileId: 'z', displayParentFolderKey: 'Z' },
      ],
      flattenedFolderKeys: ['A/Child', 'Z/Child'],
    } as const;
    const directional = DEFAULT_FOCUS_SCHEMATIC_PRODUCT_LAYOUT_POLICIES;
    const directionalWithScope = {
      ...directional,
      softFolderDisplayIntent: displayIntent,
    };
    expect(exactFocusSchematicLayoutCacheKey(input, directionalWithScope)).toBe(
      exactFocusSchematicLayoutCacheKey(input, directional),
    );

    const soft = {
      ...directional,
      macroLayout: 'soft-folder-clusters' as const,
    };
    expect(
      exactFocusSchematicLayoutCacheKey(input, {
        ...soft,
        softFolderDisplayIntent: displayIntent,
      }),
    ).not.toBe(exactFocusSchematicLayoutCacheKey(input, soft));
    expect(
      exactFocusSchematicLayoutCacheKey(input, {
        ...soft,
        softFolderDisplayIntent: {
          fileParentOverrides: [...displayIntent.fileParentOverrides].reverse(),
          flattenedFolderKeys: [...displayIntent.flattenedFolderKeys].reverse(),
        },
      }),
    ).toBe(
      exactFocusSchematicLayoutCacheKey(input, {
        ...soft,
        softFolderDisplayIntent: displayIntent,
      }),
    );
  });

  it('keeps selection, hover, visual style, viewport, and secondary display outside the key', () => {
    const input = fixtureInput(3);
    const keyBefore = exactFocusSchematicLayoutCacheKey(input);
    const presentationOnlyState = {
      selection: 'selected-projection-id',
      hover: 'hovered-projection-id',
      visualGroupColor: '#f59e0b',
      viewport: { x: 12, y: 24, zoom: 1.3 },
      secondaryRelationshipsVisible: true,
    };
    expect(presentationOnlyState.secondaryRelationshipsVisible).toBe(true);
    expect(exactFocusSchematicLayoutCacheKey(input)).toBe(keyBefore);
  });

  it('validates exact hits and rejects corrupt memory entries as misses', () => {
    const cache = new FocusSchematicLayoutCache();
    const input = fixtureInput();
    const computed = computeFocusSchematicComputedLayout(input);
    expect(cache.get(input).status).toBe('miss');
    cache.set(input, computed);
    expect(cache.get(input)).toMatchObject({ status: 'hit', value: computed });
    cache.replaceForTesting(input, { ...computed, attachments: [] });
    expect(cache.get(input).status).toBe('invalid');
    expect(cache.get(input).status).toBe('miss');
  });

  it('evicts the least-recent exact entry at the configured bound', () => {
    const cache = new FocusSchematicLayoutCache(2);
    const first = fixtureInput(0);
    const second = fixtureInput(1);
    const third = fixtureInput(2);
    cache.set(first, computeFocusSchematicComputedLayout(first));
    cache.set(second, computeFocusSchematicComputedLayout(second));
    expect(cache.get(first).status).toBe('hit');
    cache.set(third, computeFocusSchematicComputedLayout(third));
    expect(cache.size).toBe(2);
    expect(cache.get(second).status).toBe('miss');
    expect(cache.get(first).status).toBe('hit');
    expect(cache.get(third).status).toBe('hit');
  });
});
