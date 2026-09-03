import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { NodeSizeControl } from './NodeSizeControl';

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useId: () => 'node-size-control-test',
}));

function element(
  tree: ReactNode,
  type: string,
): ReactElement<Record<string, unknown>> {
  for (const child of Children.toArray(tree)) {
    if (!isValidElement<{ children?: ReactNode }>(child)) continue;
    if (child.type === type)
      return child as ReactElement<Record<string, unknown>>;
    try {
      return element(child.props.children, type);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'not found')
        throw error;
    }
  }
  throw new Error('not found');
}

describe('controlled per-File Network size editor', () => {
  it.each([undefined, 0.5, 1, 2.5])(
    'reflects current %s scale with native labelled controls',
    (sizeScale) => {
      const markup = renderToStaticMarkup(
        <NodeSizeControl
          disabled={false}
          onChange={() => undefined}
          sizeScale={sizeScale}
          status="Session only — workspace identity is not stable"
        />,
      );
      expect(markup).toContain('<legend>Network size</legend>');
      expect(markup).toContain('Session only');
      expect(markup).toContain(
        `value="${sizeScale === undefined ? 'auto' : 'custom'}" selected=""`,
      );
      if (sizeScale === undefined) expect(markup).not.toContain('type="range"');
      else {
        expect(markup).toContain('Size multiplier');
        expect(markup).toContain(`${sizeScale.toFixed(2)}×`);
        expect(markup).toContain(`value="${sizeScale}"`);
        expect(markup).toContain('min="0.5"');
        expect(markup).toContain('max="2.5"');
        expect(markup).toContain('aria-valuetext=');
      }
    },
  );

  it('emits exactly one mutation for Custom, slider movement, and Auto reset', () => {
    const onChange = vi.fn();
    const render = (sizeScale: number | undefined) =>
      NodeSizeControl({
        sizeScale,
        disabled: false,
        status: 'Saved for this workspace',
        onChange,
      });
    const select = element(render(undefined), 'select').props
      .onChange as (event: { target: { value: string } }) => void;
    select({ target: { value: 'custom' } });
    expect(onChange.mock.calls).toEqual([[1]]);
    const slider = element(render(1), 'input').props.onChange as (event: {
      currentTarget: { valueAsNumber: number };
    }) => void;
    slider({ currentTarget: { valueAsNumber: 1.65 } });
    expect(onChange.mock.calls).toEqual([[1], [1.65]]);
    const reset = element(render(1.65), 'select').props
      .onChange as typeof select;
    reset({ target: { value: 'auto' } });
    expect(onChange.mock.calls).toEqual([[1], [1.65], [undefined]]);
  });

  it('disables all mutations when durable editing is blocked', () => {
    const markup = renderToStaticMarkup(
      <NodeSizeControl
        disabled
        onChange={() => undefined}
        sizeScale={1.5}
        status="Saved Network sizes could not be loaded"
      />,
    );
    expect(markup).toContain('<fieldset class="network-node-size" disabled=""');
    expect(markup).toContain('Saved Network sizes could not be loaded');
  });
});
