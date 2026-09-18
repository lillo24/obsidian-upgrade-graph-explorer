const NETWORK_HOVER_LABEL_MAX_OFFSET_PX = 3.75;
const NETWORK_HOVER_LABEL_RADIUS_FACTOR = 0.55;
const NETWORK_HOVER_EDGE_WIDTH_INCREASE = 0.3;

export const NETWORK_HOVER_DURATION_MS = 220;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export interface NetworkHoverProgressInput {
  readonly elapsedMs: number;
  readonly durationMs?: number;
  readonly from: number;
  readonly reducedMotion?: boolean;
  readonly to: number;
}

/** Calm cubic ease-out shared by label motion and incident-edge emphasis. */
export function resolveNetworkHoverProgress({
  elapsedMs,
  durationMs = NETWORK_HOVER_DURATION_MS,
  from,
  reducedMotion = false,
  to,
}: NetworkHoverProgressInput): number {
  if (reducedMotion || durationMs <= 0) return clamp(to, 0, 1);
  const time = clamp(elapsedMs / durationMs, 0, 1);
  const eased = 1 - (1 - time) ** 3;
  return clamp(from + (to - from) * eased, 0, 1);
}

export function resolveNetworkHoverLabelOffset(
  renderedNodeSize: number,
  progress: number,
): number {
  const radius = Math.max(0, renderedNodeSize);
  return (
    Math.min(
      NETWORK_HOVER_LABEL_MAX_OFFSET_PX,
      radius * NETWORK_HOVER_LABEL_RADIUS_FACTOR,
    ) * clamp(progress, 0, 1)
  );
}

export function resolveNetworkHoverEdgeWidthMultiplier(
  progress: number,
): number {
  return 1 + NETWORK_HOVER_EDGE_WIDTH_INCREASE * clamp(progress, 0, 1);
}

type HoverTransition = {
  readonly from: number;
  readonly startedAt: number;
  readonly to: number;
};

export interface NetworkHoverTransitionControllerOptions {
  readonly cancelFrame?: (handle: number) => void;
  readonly durationMs?: number;
  readonly now?: () => number;
  /** Refresh only the nodes and incident edges associated with these keys. */
  readonly onFrame: (nodeKeys: readonly string[]) => void;
  readonly reducedMotion?: () => boolean;
  readonly requestFrame?: (callback: () => void) => number;
}

/** Renderer-local transient presentation state; graph and camera state stay untouched. */
export class NetworkHoverTransitionController {
  private readonly transitions = new Map<string, HoverTransition>();
  private readonly durationMs: number;
  private readonly now: () => number;
  private readonly requestFrame: (callback: () => void) => number;
  private readonly cancelFrame: (handle: number) => void;
  private frameHandle: number | undefined;

  constructor(
    private readonly options: NetworkHoverTransitionControllerOptions,
  ) {
    this.durationMs = options.durationMs ?? NETWORK_HOVER_DURATION_MS;
    this.now = options.now ?? (() => performance.now());
    this.requestFrame =
      options.requestFrame ??
      ((callback) => {
        const host = globalThis as unknown as {
          readonly requestAnimationFrame?: (callback: () => void) => number;
          readonly setTimeout?: (callback: () => void, delay: number) => number;
        };
        if (host.requestAnimationFrame !== undefined) {
          return host.requestAnimationFrame(callback);
        }
        if (host.setTimeout !== undefined) return host.setTimeout(callback, 16);
        throw new Error('Network hover frame scheduling is unavailable.');
      });
    this.cancelFrame =
      options.cancelFrame ??
      ((handle) => {
        const host = globalThis as unknown as {
          readonly cancelAnimationFrame?: (handle: number) => void;
          readonly clearTimeout?: (handle: number) => void;
        };
        if (host.cancelAnimationFrame !== undefined) {
          host.cancelAnimationFrame(handle);
          return;
        }
        if (host.clearTimeout !== undefined) host.clearTimeout(handle);
      });
  }

  setHovered(
    previousNodeKey: string | undefined,
    nextNodeKey: string | undefined,
  ): readonly string[] {
    if (previousNodeKey === nextNodeKey) return [];
    const now = this.now();
    const reducedMotion = this.options.reducedMotion?.() === true;
    const affected = new Set<string>();
    if (previousNodeKey !== undefined) {
      affected.add(previousNodeKey);
      this.start(previousNodeKey, 0, now, reducedMotion);
    }
    if (nextNodeKey !== undefined) {
      affected.add(nextNodeKey);
      this.start(nextNodeKey, 1, now, reducedMotion);
    }
    this.ensureFrame();
    return [...affected];
  }

  progress(nodeKey: string): number {
    const transition = this.transitions.get(nodeKey);
    if (transition === undefined) return 0;
    return this.sample(transition, this.now());
  }

  ownsLabelLayer(nodeKey: string): boolean {
    return this.transitions.has(nodeKey);
  }

  isHovered(nodeKey: string): boolean {
    return this.transitions.get(nodeKey)?.to === 1;
  }

  hasOverlay(nodeKey: string): boolean {
    return this.transitions.has(nodeKey);
  }

  dispose(): void {
    if (this.frameHandle !== undefined) this.cancelFrame(this.frameHandle);
    this.frameHandle = undefined;
    this.transitions.clear();
  }

  private start(
    nodeKey: string,
    to: number,
    now: number,
    reducedMotion: boolean,
  ): void {
    const existing = this.transitions.get(nodeKey);
    const from = existing === undefined ? 0 : this.sample(existing, now);
    if (reducedMotion) {
      if (to === 0) this.transitions.delete(nodeKey);
      else this.transitions.set(nodeKey, { from: 1, startedAt: now, to: 1 });
      return;
    }
    if (from === to) {
      if (to === 0) this.transitions.delete(nodeKey);
      else this.transitions.set(nodeKey, { from: to, startedAt: now, to });
      return;
    }
    this.transitions.set(nodeKey, { from, startedAt: now, to });
  }

  private sample(transition: HoverTransition, now: number): number {
    return resolveNetworkHoverProgress({
      elapsedMs: now - transition.startedAt,
      durationMs: this.durationMs,
      from: transition.from,
      to: transition.to,
    });
  }

  private ensureFrame(): void {
    if (this.frameHandle !== undefined || !this.hasAnimatingTransition())
      return;
    this.frameHandle = this.requestFrame(this.tick);
  }

  private hasAnimatingTransition(): boolean {
    for (const transition of this.transitions.values()) {
      if (transition.from !== transition.to) return true;
    }
    return false;
  }

  private readonly tick = (): void => {
    this.frameHandle = undefined;
    const now = this.now();
    const affected: string[] = [];
    for (const [nodeKey, transition] of this.transitions) {
      affected.push(nodeKey);
      if (now - transition.startedAt < this.durationMs) continue;
      if (transition.to === 0) this.transitions.delete(nodeKey);
      else this.transitions.set(nodeKey, { from: 1, startedAt: now, to: 1 });
    }
    if (affected.length > 0) this.options.onFrame(affected);
    this.ensureFrame();
  };
}
