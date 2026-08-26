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
);
