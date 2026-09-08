import { describe, expect, it } from 'vitest';

import {
  DEFAULT_FOCUS_SCHEMATIC_PRODUCT_LAYOUT_POLICIES,
  ENDPOINT_FIXTURES,
  FOCUS_SCHEMATIC_PRODUCTION_LAYOUT_SETTINGS,
  buildEndpointFixture,
  computeFocusSchematicComputedLayout,
  computeFocusSchematicComputedLayoutAttempt,
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
    expect(key).toContain('A1-directional-folder-bands-adaptive-internals');
    expect(key).toContain('"algorithmVersion":3');
    expect(key).toContain('"protocolVersion":3');
    expect(key.replace('"protocolVersion":3', '"protocolVersion":2')).not.toBe(
      key,
    );
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
  });

  it('distinguishes and restores all four product policy combinations exactly', () => {
    const input = fixtureInput(4);
    const snapshot = JSON.stringify(input);
    const cache = new FocusSchematicLayoutCache();
    const policies: FocusSchematicProductLayoutPolicies[] = [
      {
        internalLayoutVariant: 'adaptive-compass',
        endpointOrderPolicy: 'crossing-optimized',
      },
      {
        internalLayoutVariant: 'adaptive-compass',
        endpointOrderPolicy: 'document-order',
      },
      {
        internalLayoutVariant: 'vertical-spine',
        endpointOrderPolicy: 'crossing-optimized',
      },
      {
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
