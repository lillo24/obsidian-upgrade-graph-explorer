import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createBrowserNetworkStartupTraceSession,
  networkStartupCapabilityDelayMs,
  summarizeNetworkStartupStability,
} from './network-startup-trace';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Network startup trace browser boundary', () => {
  const stableEntry = (
    timestampMs: number,
    reason: 'surface-reveal' | 'animation-frame' | 'observation-complete',
  ) => ({
    timestampMs,
    frame: timestampMs,
    reason,
    dom: {
      toolbar: { x: 0, y: 50, width: 1280, height: 60 },
      stage: { x: 0, y: 110, width: 1280, height: 610 },
      canvas: { x: 0, y: 110, width: 1280, height: 610 },
      surface: { x: 0, y: 110, width: 1280, height: 610 },
    },
    rendererDimensions: { width: 1280, height: 610 },
    camera: { x: 0.5, y: 0.5, ratio: 1, angle: 0 },
    cameraOwnership: 'auto' as const,
    customBBox: { x: [-1, 1] as const, y: [-2, 2] as const },
    nodes: [
      {
        key: 'center',
        raw: { x: 0, y: 0 },
        viewport: { x: 640, y: 305 },
        radius: 6,
      },
    ],
    lod: 'regional',
  });

  it('is absent without the explicit QA query flag', () => {
    expect(createBrowserNetworkStartupTraceSession('')).toBeUndefined();
  });

  it('stores bounded-session entries relative to the first renderer event', () => {
    const browser = {} as Window;
    vi.stubGlobal('window', browser);
    const session = createBrowserNetworkStartupTraceSession(
      '?network-startup-trace=1',
    )!;

    session.trace({ timestampMs: 40, frame: 0, reason: 'session-created' });
    session.trace({
      timestampMs: 548,
      frame: 31,
      reason: 'observation-complete',
    });

    expect(session.api.entries.map(({ relativeMs }) => relativeMs)).toEqual([
      0, 508,
    ]);
    expect(session.api.complete).toBe(true);
    expect(browser.icarusNetworkStartupTrace).toBe(session.api);
    expect(session.api.summary?.complete).toBe(false);
  });

  it('starts a fresh bounded trace when All Network remounts', () => {
    const session = createBrowserNetworkStartupTraceSession(
      '?network-startup-trace=1',
    )!;
    session.trace(stableEntry(100, 'surface-reveal'));
    session.trace(stableEntry(405, 'observation-complete'));
    session.trace({
      timestampMs: 500,
      frame: 10,
      reason: 'camera-command:fit',
    });

    expect(session.api.entries).toHaveLength(2);
    session.trace({ timestampMs: 900, frame: 0, reason: 'session-created' });

    expect(session.api.complete).toBe(false);
    expect(session.api.summary).toBeUndefined();
    expect(session.api.entries).toHaveLength(1);
    expect(session.api.entries[0]?.relativeMs).toBe(0);
  });

  it('keeps the capability delay behind the trace flag and bounds it', () => {
    expect(
      networkStartupCapabilityDelayMs(
        '?network-startup-capability-delay-ms=150',
      ),
    ).toBe(0);
    expect(
      networkStartupCapabilityDelayMs(
        '?network-startup-trace=1&network-startup-capability-delay-ms=150',
      ),
    ).toBe(150);
    expect(
      networkStartupCapabilityDelayMs(
        '?network-startup-trace=1&network-startup-capability-delay-ms=9000',
      ),
    ).toBe(2_000);
  });

  it('passes a stable 300 ms post-reveal observation', () => {
    const summary = summarizeNetworkStartupStability([
      stableEntry(100, 'surface-reveal'),
      stableEntry(116, 'animation-frame'),
      stableEntry(405, 'observation-complete'),
    ]);

    expect(summary).toMatchObject({
      complete: true,
      pass: true,
      cameraCommandCount: 0,
      customBBoxChanged: false,
      rawNodeMaxDelta: 0,
      shellMaxDeltaPx: 0,
      nodeViewportMaxDeltaPx: 0,
    });
  });

  it('fails when a toolbar status transition resizes the stage after reveal', () => {
    const shifted = stableEntry(250, 'animation-frame');
    const summary = summarizeNetworkStartupStability([
      stableEntry(100, 'surface-reveal'),
      {
        ...shifted,
        dom: {
          ...shifted.dom,
          toolbar: { x: 0, y: 50, width: 1280, height: 106 },
          stage: { x: 0, y: 156, width: 1280, height: 564 },
          canvas: { x: 0, y: 156, width: 1280, height: 564 },
          surface: { x: 0, y: 156, width: 1280, height: 564 },
        },
      },
      stableEntry(405, 'observation-complete'),
    ]);

    expect(summary.pass).toBe(false);
    expect(summary.shellMaxDeltaPx).toBe(46);
  });

  it('distinguishes an explicitly allowed external resize from camera movement', () => {
    const resized = stableEntry(250, 'animation-frame');
    const entries = [
      stableEntry(100, 'surface-reveal'),
      {
        ...resized,
        reason: 'window-resize' as const,
        dom: {
          ...resized.dom,
          toolbar: { x: 0, y: 50, width: 1100, height: 60 },
          stage: { x: 0, y: 110, width: 1100, height: 610 },
          canvas: { x: 0, y: 110, width: 1100, height: 610 },
          surface: { x: 0, y: 110, width: 1100, height: 610 },
        },
        rendererDimensions: { width: 1100, height: 610 },
      },
      stableEntry(405, 'observation-complete'),
    ];

    expect(summarizeNetworkStartupStability(entries).pass).toBe(false);
    expect(
      summarizeNetworkStartupStability(entries, {
        allowExternalResize: true,
      }).pass,
    ).toBe(true);
  });
});
