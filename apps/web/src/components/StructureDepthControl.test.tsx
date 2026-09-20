import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { StructuralDepth } from '@icarus-graph-explorer/view-projection';

import { graphStateReducer, initialGraphState } from '../graph-state';
import { applyStructureDepthSelection } from './structure-depth-selection';
import { StructureDepthControl } from './StructureDepthControl';

describe('Hierarchy depth control', () => {
  it.each([
    ['0', 0],
    ['1', 1],
    ['2', 2],
    ['3', 3],
  ] as const)(
    'maps option %s to structural depth %i with one update',
    (value, expectedDepth) => {
      let state = initialGraphState();
      let updateCount = 0;

      applyStructureDepthSelection(value, (depth) => {
        updateCount += 1;
        state = graphStateReducer(state, { type: 'set-depth', depth });
      });

      expect(updateCount).toBe(1);
      expect(state.disclosure.defaultDepth).toBe(expectedDepth);
    },
  );

  it.each([0, 1, 2, 3] as const)(
    'renders structural depth %i as the selected option',
    (depth: StructuralDepth) => {
      const markup = renderToStaticMarkup(
        <StructureDepthControl
          custom={false}
          depth={depth}
          onChange={() => undefined}
        />,
      );

      expect(markup).toContain('aria-label="Hierarchy depth"');
      expect(markup).toContain('>Hierarchy depth<select');
      expect(markup).toContain(`<option value="${depth}" selected="">`);
      expect(markup.match(/<option /gu)).toHaveLength(4);
      expect(markup).not.toContain('<button');
    },
  );

  it('indicates manual disclosure overrides without changing the preset', () => {
    const markup = renderToStaticMarkup(
      <StructureDepthControl custom depth={2} onChange={() => undefined} />,
    );

    expect(markup).toContain('>Custom</span>');
    expect(markup).toContain('<option value="2" selected="">2 levels</option>');
    expect(markup).not.toContain('>All Files</button>');
  });

  it('offers All Files only for a custom Focus depth', () => {
    const custom = renderToStaticMarkup(
      <StructureDepthControl
        custom
        depth={1}
        onApplyToAllFiles={() => undefined}
        onChange={() => undefined}
      />,
    );
    const uniform = renderToStaticMarkup(
      <StructureDepthControl
        custom={false}
        depth={1}
        onApplyToAllFiles={() => undefined}
        onChange={() => undefined}
      />,
    );

    expect(custom).toContain('<option value="1" selected="">1 level</option>');
    expect(custom).toContain('>Custom</span>');
    expect(custom).toContain('>All Files</button>');
    expect(uniform).not.toContain('>All Files</button>');
  });
});
