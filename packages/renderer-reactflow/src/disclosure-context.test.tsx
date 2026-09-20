import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  EntityDisclosureProvider,
  useEntityDisclosure,
} from './disclosure-context';

function DisclosureProbe() {
  const disclosure = useEntityDisclosure();
  return (
    <button className="entity-disclosure" disabled={disclosure.disabled}>
      <span>2</span>
    </button>
  );
}

describe('entity disclosure transition safety', () => {
  it.each([
    ['ready', false, false],
    ['pending', true, true],
  ] as const)(
    'renders a %s control with native disabled=%s',
    (_, disabled, expected) => {
      const markup = renderToStaticMarkup(
        <EntityDisclosureProvider
          disabled={disabled}
          onToggleEntity={() => undefined}
        >
          <DisclosureProbe />
        </EntityDisclosureProvider>,
      );

      expect(markup.includes('disabled=""')).toBe(expected);
      expect(markup).toContain('class="entity-disclosure"');
      expect(markup).toContain('>2<');
    },
  );
});
