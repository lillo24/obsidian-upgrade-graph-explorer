import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|(?:rgb|rgba|hsl|hsla)\([^)]*\)/g;
const appCss = readFileSync(new URL('../App.css', import.meta.url), 'utf8');
const argumentsCss = readFileSync(
  new URL('../features/arguments/arguments.css', import.meta.url),
  'utf8',
);
const reviewCss = readFileSync(
  new URL('../features/ai-review/review.css', import.meta.url),
  'utf8',
);
const workspaceCss = readFileSync(
  new URL('../features/workspace/workspace.css', import.meta.url),
  'utf8',
);
const indexCss = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const tokensCss = readFileSync(
  new URL('./tokens.css', import.meta.url),
  'utf8',
);
const FEATURE_CSS = [appCss, workspaceCss, argumentsCss, reviewCss];

function colorLiterals(css: string): string[] {
  return css.match(COLOR_LITERAL) ?? [];
}

function tokenDefinitionCount(token: string): number {
  return tokensCss.match(new RegExp(`${token}\\s*:`, 'g'))?.length ?? 0;
}

function themeTokens(theme: 'light' | 'dark'): ReadonlyMap<string, string> {
  const selector =
    theme === 'light'
      ? /:root,\s*:root\[data-theme='light'\]\s*\{([^}]*)\}/
      : /:root\[data-theme='dark'\]\s*\{([^}]*)\}/;
  const block = selector.exec(tokensCss)?.[1];
  if (!block) throw new Error(`Missing ${theme} token block.`);
  const tokens = new Map<string, string>();
  for (const match of block.matchAll(/(--color-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    const name = match[1];
    const value = match[2];
    if (name && value) tokens.set(name, value.trim());
  }
  return tokens;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16),
  );
  const linear = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

function contrast(foreground: string, background: string): number {
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

describe('application theme CSS contract', () => {
  it('keeps explicit theme ownership out of component and feature CSS', () => {
    for (const css of FEATURE_CSS) {
      expect(css).not.toContain('prefers-color-scheme');
      expect(css).not.toContain(':root[data-theme');
    }

    expect(workspaceCss).toContain('var(--color-surface-workspace)');
    expect(argumentsCss).toContain('var(--color-surface-workspace)');
    expect(reviewCss).toContain('var(--color-surface-workspace)');
  });

  it('defines complete light and dark roles used by interactive DOM states', () => {
    const requiredRoles = [
      '--color-surface-app',
      '--color-surface-workspace',
      '--color-surface-toolbar',
      '--color-surface-sidebar',
      '--color-surface-panel',
      '--color-surface-elevated',
      '--color-surface-input',
      '--color-surface-hover',
      '--color-surface-selected',
      '--color-surface-backdrop',
      '--color-text-primary',
      '--color-text-secondary',
      '--color-text-muted',
      '--color-text-faint',
      '--color-text-inverse',
      '--color-text-accent',
      '--color-text-link',
      '--color-border-subtle',
      '--color-border-default',
      '--color-border-strong',
      '--color-border-focus',
      '--color-focus-ring',
      '--color-control-foreground',
      '--color-control-background',
      '--color-control-hover',
      '--color-control-selected-foreground',
      '--color-control-selected-background',
      '--color-control-disabled-foreground',
      '--color-control-disabled-background',
      '--color-status-info-foreground',
      '--color-status-success-foreground',
      '--color-status-warning-foreground',
      '--color-status-error-foreground',
      '--color-status-development-foreground',
    ];

    for (const role of requiredRoles)
      expect(tokenDefinitionCount(role)).toBe(2);

    const combined = FEATURE_CSS.join('\n');
    expect(combined).toContain('var(--color-control-hover)');
    expect(combined).toContain('var(--color-control-selected-background)');
    expect(indexCss).toContain('var(--color-control-disabled-background)');
    expect(indexCss).toContain('var(--color-focus-ring)');
  });

  it('allows only documented semantic-data and development-lab literals', () => {
    expect(colorLiterals(workspaceCss)).toEqual([]);
    expect(colorLiterals(argumentsCss)).toEqual([]);
    expect(colorLiterals(reviewCss)).toEqual([]);
    expect(colorLiterals(appCss)).toEqual([
      '#275675',
      '#e7f1f8',
      '#4b476f',
      '#efedf8',
      '#645028',
      '#f8f0db',
    ]);
    expect(colorLiterals(indexCss)).toEqual([
      '#e8eef2',
      '#10171c',
      '#8ed5c9',
      '#1d2a32',
      '#48606d',
      '#162129',
      '#334650',
      '#aee9dd',
      '#0d1418',
      '#0b1115',
      '#536873',
      '#73c8bb',
      '#d8fff8',
      '#f2b866',
      '#aebbc2',
    ]);
    expect(indexCss).toContain('Intentional diagnostic visualization palette');
    expect(appCss).toContain('entity-kind data colors stay explicit');
  });

  it.each(['light', 'dark'] as const)(
    'keeps %s text, state, and focus contrasts legible',
    (theme) => {
      const tokens = themeTokens(theme);
      const value = (name: string) => {
        const token = tokens.get(name);
        if (!token) throw new Error(`Missing ${theme} token ${name}.`);
        return token;
      };
      const textPairs = [
        ['--color-text-primary', '--color-surface-app'],
        ['--color-text-secondary', '--color-surface-panel'],
        ['--color-text-muted', '--color-surface-panel'],
        [
          '--color-control-selected-foreground',
          '--color-control-selected-background',
        ],
        ['--color-status-info-foreground', '--color-status-info-background'],
        [
          '--color-status-success-foreground',
          '--color-status-success-background',
        ],
        [
          '--color-status-warning-foreground',
          '--color-status-warning-background',
        ],
        ['--color-status-error-foreground', '--color-status-error-background'],
        [
          '--color-status-development-foreground',
          '--color-status-development-background',
        ],
      ] as const;

      for (const [foreground, background] of textPairs) {
        expect(
          contrast(value(foreground), value(background)),
        ).toBeGreaterThanOrEqual(4.5);
      }
      expect(
        contrast(
          value('--color-control-disabled-foreground'),
          value('--color-control-disabled-background'),
        ),
      ).toBeGreaterThanOrEqual(3);
      expect(
        contrast(value('--color-focus-ring'), value('--color-surface-panel')),
      ).toBeGreaterThanOrEqual(3);
    },
  );
});
