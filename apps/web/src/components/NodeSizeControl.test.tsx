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
  it.each([undefined, 0.5, 1, 1.3, 2.5])(
    'always shows the native range at current %s scale without a mode selector',
    (sizeScale) => {
      const markup = renderToStaticMarkup(
        <NodeSizeControl
          disabled={false}
          onChange={() => undefined}
          sizeScale={sizeScale}
          status="Session only — workspace identity is not stable"
        />,
      );
      const value = sizeScale ?? 1;
      expect(markup).toContain('<legend>Size</legend>');
      expect(markup).toContain('Session only');
      expect(markup).not.toContain('<select');
      expect(markup).not.toMatch(/Auto|Custom|automatic/u);
      expect(markup).toContain('type="range"');
      expect(markup).toContain('aria-label="File size"');
      expect(markup).toContain(`${value.toFixed(2)}×`);
      expect(markup).toContain(`value="${value}"`);
      expect(markup).toContain('min="0.5"');
      expect(markup).toContain('max="2.5"');
      expect(markup).toContain('step="0.05"');
      expect(markup).toContain(
        `aria-valuetext="${value.toFixed(2)} times calculated Network size"`,
      );
      expect(markup).toContain('aria-label="Reset size"');
      expect(markup).toContain('type="button">Reset</button>');
      expect(markup).toContain(
        'class="visually-hidden" id="node-size-control-test-help"',
      );
    },
  );

  it('emits one mutation per range change/reset and reflects the next controlled value', () => {
    let sizeScale: number | undefined;
    const onChange = vi.fn((next: number | undefined) => {
      sizeScale = next;
    });
    const render = () =>
      NodeSizeControl({
        sizeScale,
        disabled: false,
        status: 'Saved for this workspace',
        onChange,
      });
    expect(element(render(), 'input').props.value).toBe(1);
    const slider = element(render(), 'input').props.onChange as (event: {
      currentTarget: { valueAsNumber: number };
    }) => void;
    slider({ currentTarget: { valueAsNumber: 1.65 } });
    expect(onChange.mock.calls).toEqual([[1.65]]);
    expect(element(render(), 'input').props.value).toBe(1.65);
    const reset = element(render(), 'button').props.onClick as () => void;
    reset();
    expect(onChange.mock.calls).toEqual([[1.65], [undefined]]);
    expect(element(render(), 'input').props.value).toBe(1);
    expect(element(render(), 'output').props.children).toEqual(['1.00', '×']);
    // A deliberate 1.00 is still a valid stored multiplier, not a mode change.
    slider({ currentTarget: { valueAsNumber: 1 } });
    expect(onChange.mock.calls).toEqual([[1.65], [undefined], [1]]);
  });

  it('leaves range and Reset keyboard behavior native', () => {
    const tree = NodeSizeControl({
      sizeScale: undefined,
      disabled: false,
      status: 'Saved for this workspace',
      onChange: () => undefined,
    });
    expect(element(tree, 'input').props).toMatchObject({
      type: 'range',
      step: '0.05',
    });
    expect(element(tree, 'input').props.onKeyDown).toBeUndefined();
    expect(element(tree, 'input').props.tabIndex).toBeUndefined();
    expect(element(tree, 'button').props).toMatchObject({
      type: 'button',
      'aria-label': 'Reset size',
    });
    expect(element(tree, 'button').props.tabIndex).toBeUndefined();
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
