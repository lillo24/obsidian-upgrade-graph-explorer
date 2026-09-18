/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  hierarchyThemeFor,
  hierarchyThemeStyleFor,
  ICARUS_DARK_HIERARCHY_THEME,
  ICARUS_LIGHT_HIERARCHY_THEME,
} from './hierarchy-theme';

function luminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (match === null) throw new Error(`Expected a six-digit hex color: ${hex}`);
  const value = Number.parseInt(match[1]!, 16);
  const channels = [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
  const [red, green, blue] = channels.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

function contrast(foreground: string, background: string): number {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

describe('Hierarchy renderer theme adapter', () => {
  it('selects one immutable semantic palette from the app-resolved theme', () => {
    expect(hierarchyThemeFor('light')).toBe(ICARUS_LIGHT_HIERARCHY_THEME);
    expect(hierarchyThemeFor('dark')).toBe(ICARUS_DARK_HIERARCHY_THEME);
    expect(Object.isFrozen(ICARUS_LIGHT_HIERARCHY_THEME)).toBe(true);
    expect(Object.isFrozen(ICARUS_DARK_HIERARCHY_THEME)).toBe(true);
    expect(hierarchyThemeStyleFor('light')).toBe(
      hierarchyThemeStyleFor('light'),
    );
    expect(hierarchyThemeStyleFor('dark')).toBe(hierarchyThemeStyleFor('dark'));
  });

  it.each([
    ['light', ICARUS_LIGHT_HIERARCHY_THEME],
    ['dark', ICARUS_DARK_HIERARCHY_THEME],
  ] as const)(
    '%s keeps core node, diagnostic, and inverted text readable',
    (_, theme) => {
      for (const [foreground, background] of [
        [theme.nodeText, theme.nodeSurface],
        [theme.nodeMuted, theme.nodeSurface],
        [theme.unresolvedText, theme.unresolvedSurface],
        [theme.ambiguousText, theme.ambiguousSurface],
        [theme.invalidText, theme.invalidSurface],
        [theme.rootInvertedText, theme.rootInvertedSurface],
      ] as const) {
        expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
      }
      expect(
        contrast(theme.focusOutline, theme.canvasBackground),
      ).toBeGreaterThanOrEqual(3);
    },
  );

  it('defines every renderer CSS role and leaves palette literals at the adapter boundary', () => {
    const styles = readFileSync(
      new URL('./styles.css', import.meta.url),
      'utf8',
    );
    const canvas = readFileSync(
      new URL('./GraphCanvas.tsx', import.meta.url),
      'utf8',
    );
    const references = new Set(
      [...styles.matchAll(/var\((--hierarchy-[a-z-]+)/g)].map(
        (match) => match[1]!,
      ),
    );
    const lightStyle = hierarchyThemeStyleFor('light') as Record<
      string,
      string
    >;
    const darkStyle = hierarchyThemeStyleFor('dark') as Record<string, string>;
    for (const variable of references) {
      expect(lightStyle[variable], `light ${variable}`).toBeTruthy();
      expect(darkStyle[variable], `dark ${variable}`).toBeTruthy();
    }
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
    expect(canvas).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
    expect(styles).not.toContain('prefers-color-scheme');
  });
});
