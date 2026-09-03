import type { ReactElement, ReactNode } from 'react';

type Dependencies = readonly unknown[];
interface Slot {
  value?: unknown;
  dependencies?: Dependencies;
  cleanup?: (() => void) | undefined;
}
let active: CanvasTestHarness;
function same(left: Dependencies | undefined, right: Dependencies): boolean {
  return (
    left !== undefined &&
    left.length === right.length &&
    left.every((value, i) => Object.is(value, right[i]))
  );
}

/** Deterministic hook/effect driver: runs the real canvas and its dependency lists.
 * No DOM/WebGL package is needed; not a replacement for production-browser QA.
 */
export class CanvasTestHarness {
  private slots: Slot[] = [];
  private cursor = 0;
  private effects: (() => void)[] = [];
  private layoutEffects: (() => void)[] = [];
  private dirty = true;
  constructor(private readonly component: () => ReactNode) {}
  slot(): Slot {
    return this.slots[this.cursor] ?? (this.slots[this.cursor] = {});
  }
  next(): void {
    this.cursor++;
  }
  invalidate(): void {
    this.dirty = true;
  }
  effect(
    callback: () => void | (() => void),
    dependencies: Dependencies,
    layout: boolean,
  ): void {
    const slot = this.slot();
    this.next();
    if (same(slot.dependencies, dependencies)) return;
    slot.dependencies = dependencies;
    (layout ? this.layoutEffects : this.effects).push(() => {
      slot.cleanup?.();
      slot.cleanup = callback() ?? undefined;
    });
  }
  private attach(tree: ReactNode): void {
    if (Array.isArray(tree)) {
      for (const child of tree) this.attach(child);
      return;
    }
    if (tree === null || typeof tree !== 'object' || !('props' in tree)) return;
    const { props } = tree as ReactElement<{
      ref?: { current: unknown };
      children?: ReactNode;
    }>;
    if (props.ref != null && props.ref.current === null)
      props.ref.current = { setAttribute: () => undefined };
    this.attach(props.children);
  }
  async flush(): Promise<void> {
    for (let turn = 0; turn < 30; turn++) {
      if (this.dirty) {
        this.dirty = false;
        this.cursor = 0;
        // Dispatch hooks to the harness whose real canvas function is rendering.
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        active = this;
        this.attach(this.component());
        for (const callback of this.layoutEffects.splice(0)) callback();
        for (const callback of this.effects.splice(0)) callback();
      }
      // Drain resolved layout/ready/process microtasks between effect commits.
      await Promise.resolve();
    }
    if (this.dirty) throw new Error('Canvas effects did not settle.');
  }
  destroy(): void {
    for (const slot of this.slots) slot.cleanup?.();
  }
}

export const canvasTestHooks = {
  useRef<T>(initial: T): { current: T } {
    const slot = active.slot();
    active.next();
    if (!('value' in slot)) slot.value = { current: initial };
    return slot.value as { current: T };
  },
  useState<T>(
    initial: T | (() => T),
  ): [T, (value: T | ((current: T) => T)) => void] {
    const owner = active;
    const slot = owner.slot();
    owner.next();
    if (!('value' in slot))
      slot.value =
        typeof initial === 'function' ? (initial as () => T)() : initial;
    return [
      slot.value as T,
      (value) => {
        const next =
          typeof value === 'function'
            ? (value as (current: T) => T)(slot.value as T)
            : value;
        if (!Object.is(slot.value, next)) {
          slot.value = next;
          owner.invalidate();
        }
      },
    ];
  },
  useMemo<T>(calculate: () => T, dependencies: Dependencies): T {
    const slot = active.slot();
    active.next();
    if (!same(slot.dependencies, dependencies)) {
      slot.value = calculate();
      slot.dependencies = dependencies;
    }
    return slot.value as T;
  },
  useCallback<T>(callback: T, dependencies: Dependencies): T {
    return canvasTestHooks.useMemo(() => callback, dependencies);
  },
  useEffect(
    callback: () => void | (() => void),
    dependencies: Dependencies,
  ): void {
    active.effect(callback, dependencies, false);
  },
  useLayoutEffect(
    callback: () => void | (() => void),
    dependencies: Dependencies,
  ): void {
    active.effect(callback, dependencies, true);
  },
};
