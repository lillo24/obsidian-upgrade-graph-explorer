// @vitest-environment happy-dom

import { act, type ComponentProps, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ArgumentCompilerTunnelCapability } from './argument-compiler-tunnel';

const runtimeMocks = vi.hoisted(() => ({
  compilerTunnel: undefined as ArgumentCompilerTunnelCapability | undefined,
  detectCompilerTunnel: vi.fn(),
}));

vi.mock('./desktop-runtime', () => ({
  desktopArgumentCompilerTunnel: () => {
    runtimeMocks.detectCompilerTunnel();
    return runtimeMocks.compilerTunnel;
  },
  desktopSourceProvider: () => undefined,
}));

vi.mock('./components/GraphExplorer', () => ({
  GraphExplorer: ({
    onOpenArguments,
  }: {
    readonly onOpenArguments?: (trigger: HTMLElement) => void;
  }) => (
    <button
      onClick={(event) => onOpenArguments?.(event.currentTarget)}
      type="button"
    >
      Arguments
    </button>
  ),
}));

vi.mock('./features/workspace/WorkspaceOverlay', () => ({
  WorkspaceOverlay: ({
    area,
    argumentNotice,
    open,
  }: {
    readonly area: string;
    readonly argumentNotice?: ReactNode;
    readonly open: boolean;
  }) => (
    <section data-area={area} data-open={String(open)}>
      {open && area === 'arguments' ? argumentNotice : null}
    </section>
  ),
}));

import { App as AppComponent } from './App';
import { TEST_THEME_CONTROLLER } from './theme/test-controller';

function App(props: Omit<ComponentProps<typeof AppComponent>, 'theme'>) {
  return <AppComponent {...props} theme={TEST_THEME_CONTROLLER} />;
}

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const match = [
    ...container.querySelectorAll<HTMLButtonElement>('button'),
  ].find(({ textContent }) => textContent?.trim() === label);
  if (match === undefined) throw new Error(`Missing ${label} button.`);
  return match;
}

describe('Arguments Compiler tunnel ensure', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    runtimeMocks.compilerTunnel = undefined;
    runtimeMocks.detectCompilerTunnel.mockReset();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('opens Arguments immediately, triggers the ensure, and deduplicates overlapping opens', async () => {
    let finishEnsure!: () => void;
    const pendingEnsure = new Promise<void>((resolve) => {
      finishEnsure = resolve;
    });
    const ensureRunning = vi.fn(async () => {
      await pendingEnsure;
      return { status: 'already-running' as const };
    });
    await act(() =>
      root.render(<App argumentCompilerTunnel={{ ensureRunning }} />),
    );

    act(() => {
      button(container, 'Arguments').click();
      button(container, 'Arguments').click();
      button(container, 'Arguments').click();
    });

    expect(container.querySelector('section')?.dataset.open).toBe('true');
    expect(container.querySelector('section')?.dataset.area).toBe('arguments');
    expect(ensureRunning).toHaveBeenCalledOnce();

    finishEnsure();
    await act(async () => pendingEnsure);
  });

  it('keeps browser mode quiet when no native capability exists', async () => {
    await act(() => root.render(<App />));

    await act(async () => {
      button(container, 'Arguments').click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('section')?.dataset.open).toBe('true');
    expect(runtimeMocks.detectCompilerTunnel).toHaveBeenCalledOnce();
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.textContent).not.toContain('could not be started');
  });

  it('keeps Arguments open after failure and retries from a non-blocking warning', async () => {
    const ensureRunning = vi
      .fn<ArgumentCompilerTunnelCapability['ensureRunning']>()
      .mockRejectedValueOnce({
        code: 'task-query-failed',
        message: 'private native detail',
      })
      .mockResolvedValueOnce({ status: 'started' });
    await act(() =>
      root.render(<App argumentCompilerTunnel={{ ensureRunning }} />),
    );

    await act(async () => {
      button(container, 'Arguments').click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('section')?.dataset.open).toBe('true');
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      'Argument Compiler tunnel could not be started.',
    );
    expect(container.textContent).not.toContain('private native detail');

    await act(async () => {
      button(container, 'Retry').click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(ensureRunning).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.querySelector('section')?.dataset.open).toBe('true');
  });
});
