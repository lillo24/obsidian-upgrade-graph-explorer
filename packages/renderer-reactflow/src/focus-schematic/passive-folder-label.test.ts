/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

function rule(selector: string): string {
  const escaped = selector.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(styles);
  if (match?.[1] === undefined)
    throw new Error(`Missing CSS rule ${selector}.`);
  return match[1];
}

describe('Soft folder label presentation', () => {
  it('has plain default styling and quiet parent context', () => {
    const label = rule('.focus-schematic-folder-guide-controls__chip');
    expect(label).toMatch(/background:\s*transparent;/);
    expect(label).toMatch(/border:\s*0;/);
    expect(label).toMatch(/border-radius:\s*0;/);
    expect(label).toMatch(/box-shadow:\s*none;/);
    expect(label).toMatch(/cursor:\s*default;/);

    const parent = rule('.focus-schematic-folder-guide-controls__parent');
    expect(parent).toMatch(/font-size:\s*9px;/);
    expect(parent).toMatch(/font-weight:\s*600;/);
  });

  it('keeps subtle hover emphasis and a clear keyboard focus indicator', () => {
    expect(rule('.focus-schematic-folder-guide-controls__chip:hover')).toMatch(
      /text-decoration:\s*underline;/,
    );
    const focus = rule(
      '.focus-schematic-folder-guide-controls__chip:focus-visible',
    );
    expect(focus).toMatch(/outline:\s*2px solid/);
    expect(focus).toMatch(/outline-offset:\s*3px;/);
  });

  it('keeps repeated SVG labels visually aligned with the primary label', () => {
    const repeated = rule('.focus-schematic-folder-guide__label');
    const primary = rule('.focus-schematic-folder-guide-controls__chip');
    expect(repeated).toMatch(/font-size:\s*12px;/);
    expect(repeated).toMatch(/font-weight:\s*700;/);
    expect(primary).toMatch(/font-size:\s*12px;/);
    expect(primary).toMatch(/font-weight:\s*700;/);
  });
});
