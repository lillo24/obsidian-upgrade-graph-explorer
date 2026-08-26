import eslint from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '.agents/**',
      '.codex/**',
    ],
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
  },
  {
    files: ['packages/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              message:
                'Core must remain independent from React and UI frameworks.',
            },
            {
              name: 'react-dom',
              message:
                'Core must remain independent from React and UI frameworks.',
            },
            {
              name: 'reactflow',
              message: 'React Flow belongs in a renderer package, not core.',
            },
            {
              name: 'sigma',
              message:
                'Renderer libraries belong in derived renderer packages, not core.',
            },
            {
              name: 'graphology',
              message:
                'Graphology may be a derived runtime index, never a core dependency.',
            },
            {
              name: 'obsidian',
              message:
                'Obsidian behavior belongs in an adapter outside generic core.',
            },
            {
              name: '@icarus-graph-explorer/web',
              message: 'Core cannot depend on the web application.',
            },
          ],
          patterns: [
            {
              group: [
                'react/*',
                'react-dom/*',
                '@xyflow/*',
                '@tauri-apps/*',
                '@react-sigma/*',
                'sigma/*',
                'graphology-*',
                'obsidian-*',
                '@obsidian/*',
              ],
              message:
                'Framework, renderer, platform, and source-specific imports are forbidden in core.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/parser-markdown/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              message: 'Markdown parsing must remain independent from React.',
            },
            {
              name: 'react-dom',
              message: 'Markdown parsing must remain independent from React.',
            },
            {
              name: 'reactflow',
              message: 'Renderers cannot be parser dependencies.',
            },
            {
              name: 'sigma',
              message: 'Renderers cannot be parser dependencies.',
            },
            {
              name: 'graphology',
              message: 'Graph indexes cannot be parser dependencies.',
            },
            {
              name: 'obsidian',
              message: 'Obsidian syntax belongs in the KG3 adapter.',
            },
            {
              name: '@icarus-graph-explorer/web',
              message: 'The parser cannot depend on the web application.',
            },
          ],
          patterns: [
            {
              group: [
                'react/*',
                'react-dom/*',
                '@xyflow/*',
                '@tauri-apps/*',
                '@react-sigma/*',
                'sigma/*',
                'graphology-*',
                'obsidian-*',
                '@obsidian/*',
                '@icarus-graph-explorer/web/*',
              ],
              message:
                'UI, renderer, platform, and source-specific imports are forbidden in the generic Markdown parser.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/adapter-obsidian/**/*.{ts,tsx}'],
    ignores: ['packages/adapter-obsidian/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              message: 'Source adapters must remain independent from React.',
            },
            {
              name: 'react-dom',
              message: 'Source adapters must remain independent from React.',
            },
            {
              name: 'reactflow',
              message: 'Renderers cannot be source-adapter dependencies.',
            },
            {
              name: 'sigma',
              message: 'Renderers cannot be source-adapter dependencies.',
            },
            {
              name: 'graphology',
              message: 'Graph indexes cannot be source-adapter dependencies.',
            },
            {
              name: 'obsidian',
              message:
                'This syntax adapter must not depend on the Obsidian application runtime.',
            },
            {
              name: '@icarus-graph-explorer/web',
              message: 'Source adapters cannot depend on the web application.',
            },
            {
              name: 'node:fs',
              message: 'The single-document adapter cannot read files.',
            },
            {
              name: 'node:fs/promises',
              message: 'The single-document adapter cannot read files.',
            },
          ],
          patterns: [
            {
              group: [
                'react/*',
                'react-dom/*',
                '@xyflow/*',
                '@tauri-apps/*',
                '@react-sigma/*',
                'sigma/*',
                'graphology-*',
                '@obsidian/*',
                '@icarus-graph-explorer/web/*',
                'node:fs/*',
              ],
              message:
                'UI, renderer, platform, runtime, and filesystem imports are forbidden in the Obsidian source adapter.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/resolver-obsidian/**/*.{ts,tsx}'],
    ignores: ['packages/resolver-obsidian/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              message:
                'Workspace resolvers must remain independent from React.',
            },
            {
              name: 'react-dom',
              message:
                'Workspace resolvers must remain independent from React.',
            },
            {
              name: 'reactflow',
              message: 'Renderers cannot be resolver dependencies.',
            },
            {
              name: 'sigma',
              message: 'Renderers cannot be resolver dependencies.',
            },
            {
              name: 'graphology',
              message: 'Graph indexes cannot be resolver dependencies.',
            },
            {
              name: 'obsidian',
              message:
                'The resolver consumes adapter IR, not the Obsidian application runtime.',
            },
            {
              name: '@icarus-graph-explorer/web',
              message: 'Resolvers cannot depend on the web application.',
            },
            {
              name: 'node:fs',
              message: 'The in-memory workspace resolver cannot read files.',
            },
            {
              name: 'node:fs/promises',
              message: 'The in-memory workspace resolver cannot read files.',
            },
          ],
          patterns: [
            {
              group: [
                'react/*',
                'react-dom/*',
                '@xyflow/*',
                '@tauri-apps/*',
                '@react-sigma/*',
                'sigma/*',
                'graphology-*',
                '@obsidian/*',
                '@icarus-graph-explorer/web/*',
                'node:fs/*',
              ],
              message:
                'UI, renderer, platform, runtime, and filesystem imports are forbidden in the Obsidian resolver.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/diagnostics-obsidian/**/*.{ts,tsx}'],
    ignores: ['packages/diagnostics-obsidian/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              message:
                'Diagnostic report logic must remain independent from React.',
            },
            {
              name: 'react-dom',
              message:
                'Diagnostic report logic must remain independent from React.',
            },
            {
              name: 'reactflow',
              message: 'Renderers cannot be diagnostic-report dependencies.',
            },
            {
              name: 'sigma',
              message: 'Renderers cannot be diagnostic-report dependencies.',
            },
            {
              name: 'graphology',
              message:
                'Graph indexes cannot be diagnostic-report dependencies.',
            },
            {
              name: 'obsidian',
              message:
                'Diagnostics consume parsed data, not the Obsidian application runtime.',
            },
            {
              name: '@icarus-graph-explorer/web',
              message:
                'Diagnostic report logic cannot depend on the web application.',
            },
            {
              name: 'node:fs',
              message:
                'Filesystem acquisition belongs in the development runner.',
            },
            {
              name: 'node:fs/promises',
              message:
                'Filesystem acquisition belongs in the development runner.',
            },
          ],
          patterns: [
            {
              group: [
                'react/*',
                'react-dom/*',
                '@xyflow/*',
                '@tauri-apps/*',
                '@react-sigma/*',
                'sigma/*',
                'graphology-*',
                '@obsidian/*',
                '@icarus-graph-explorer/web/*',
                'node:fs/*',
              ],
              message:
                'UI, renderer, platform, runtime, application, and filesystem imports are forbidden in diagnostic report logic.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/view-projection/**/*.{ts,tsx}'],
    ignores: ['packages/view-projection/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              message: 'View projection must remain renderer-independent.',
            },
            {
              name: 'react-dom',
              message: 'View projection must remain renderer-independent.',
            },
            {
              name: 'reactflow',
              message: 'Renderer types cannot define projection truth.',
            },
            {
              name: 'sigma',
              message: 'Renderer types cannot define projection truth.',
            },
            {
              name: 'graphology',
              message: 'KG6 uses its own small derived runtime indexes.',
            },
            {
              name: 'obsidian',
              message: 'Projection consumes source-neutral canonical data.',
            },
            {
              name: '@icarus-graph-explorer/adapter-obsidian',
              message: 'View projection may depend inward on core only.',
            },
            {
              name: '@icarus-graph-explorer/resolver-obsidian',
              message: 'View projection may depend inward on core only.',
            },
            {
              name: '@icarus-graph-explorer/diagnostics-obsidian',
              message: 'View projection may depend inward on core only.',
            },
            {
              name: '@icarus-graph-explorer/web',
              message: 'View projection cannot depend on the web application.',
            },
            {
              name: 'node:fs',
              message: 'Projection is an in-memory pure transformation.',
            },
            {
              name: 'node:fs/promises',
              message: 'Projection is an in-memory pure transformation.',
            },
          ],
          patterns: [
            {
              group: [
                'react/*',
                'react-dom/*',
                '@xyflow/*',
                '@tauri-apps/*',
                '@react-sigma/*',
                'sigma/*',
                'graphology-*',
                '@obsidian/*',
                '@icarus-graph-explorer/adapter-obsidian/*',
                '@icarus-graph-explorer/resolver-obsidian/*',
                '@icarus-graph-explorer/diagnostics-obsidian/*',
                '@icarus-graph-explorer/web/*',
                'node:fs/*',
              ],
              message:
                'Renderer, platform, source-specific, application, and filesystem imports are forbidden in view projection.',
            },
          ],
        },
      ],
    },
  },
);
