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
      '**/src-tauri/gen/schemas/**',
      '**/src-tauri/target/**',
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
    files: ['packages/explorer-inspection/**/*.{ts,tsx}'],
    ignores: ['packages/explorer-inspection/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              message: 'Inspection read models must remain UI-independent.',
            },
            {
              name: 'react-dom',
              message: 'Inspection read models must remain UI-independent.',
            },
            {
              name: '@xyflow/react',
              message: 'Renderer libraries cannot define inspection truth.',
            },
            {
              name: '@dagrejs/dagre',
              message: 'Layout is outside source-neutral inspection.',
            },
            {
              name: '@icarus-graph-explorer/renderer-reactflow',
              message:
                'Inspection consumes projection contracts, not renderers.',
            },
            {
              name: '@icarus-graph-explorer/adapter-obsidian',
              message: 'Inspection must remain source-neutral.',
            },
            {
              name: '@icarus-graph-explorer/resolver-obsidian',
              message: 'Inspection consumes canonical resolution results only.',
            },
            {
              name: '@icarus-graph-explorer/diagnostics-obsidian',
              message:
                'Primary inspection cannot depend on diagnostic reports.',
            },
            {
              name: '@icarus-graph-explorer/web',
              message: 'Inspection packages cannot depend on an application.',
            },
            {
              name: 'node:fs',
              message: 'Inspection is an in-memory pure read-model boundary.',
            },
            {
              name: 'node:fs/promises',
              message: 'Inspection is an in-memory pure read-model boundary.',
            },
          ],
          patterns: [
            {
              group: [
                'react/*',
                'react-dom/*',
                '@xyflow/*',
                '@dagrejs/*',
                '@tauri-apps/*',
                '@react-sigma/*',
                'sigma/*',
                'graphology-*',
                'obsidian-*',
                '@obsidian/*',
                '@icarus-graph-explorer/renderer-reactflow/*',
                '@icarus-graph-explorer/adapter-obsidian/*',
                '@icarus-graph-explorer/resolver-obsidian/*',
                '@icarus-graph-explorer/diagnostics-obsidian/*',
                '@icarus-graph-explorer/web/*',
                'node:fs/*',
              ],
              message:
                'Inspection production code may depend only on core and view-projection.',
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
  {
    files: ['packages/view-state/**/*.{ts,tsx}'],
    ignores: ['packages/view-state/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              message: 'Saved-view reconciliation must remain UI-independent.',
            },
            {
              name: 'react-dom',
              message: 'Saved-view reconciliation must remain UI-independent.',
            },
            {
              name: '@icarus-graph-explorer/stable-identity',
              message:
                'View state consumes stable canonical IDs, not identity catalogs.',
            },
            {
              name: '@icarus-graph-explorer/diagnostics-obsidian',
              message:
                'Report eligibility belongs to an outer application adapter.',
            },
            {
              name: '@icarus-graph-explorer/renderer-reactflow',
              message:
                'Saved-view contracts cannot depend on renderer details.',
            },
            {
              name: '@icarus-graph-explorer/web',
              message: 'Pure view state cannot depend on an application.',
            },
            {
              name: 'node:fs',
              message: 'Storage belongs in a platform adapter.',
            },
            {
              name: 'node:fs/promises',
              message: 'Storage belongs in a platform adapter.',
            },
          ],
          patterns: [
            {
              group: [
                'react/*',
                'react-dom/*',
                '@xyflow/*',
                '@dagrejs/*',
                '@tauri-apps/*',
                '@react-sigma/*',
                'sigma/*',
                'graphology-*',
                'obsidian-*',
                '@obsidian/*',
                '@icarus-graph-explorer/adapter-obsidian/*',
                '@icarus-graph-explorer/resolver-obsidian/*',
                '@icarus-graph-explorer/diagnostics-obsidian/*',
                '@icarus-graph-explorer/stable-identity/*',
                '@icarus-graph-explorer/explorer-inspection/*',
                '@icarus-graph-explorer/renderer-reactflow/*',
                '@icarus-graph-explorer/web/*',
                'node:fs/*',
              ],
              message:
                'View-state production code may depend only on core and view-projection.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/snapshot-delta/**/*.{ts,tsx}'],
    ignores: ['packages/snapshot-delta/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react/*',
                'react-dom',
                'react-dom/*',
                '@xyflow/*',
                '@dagrejs/*',
                '@tauri-apps/*',
                '@react-sigma/*',
                'sigma',
                'sigma/*',
                'graphology-*',
                'obsidian-*',
                '@obsidian/*',
                '@icarus-graph-explorer/adapter-obsidian',
                '@icarus-graph-explorer/adapter-obsidian/*',
                '@icarus-graph-explorer/parser-markdown',
                '@icarus-graph-explorer/parser-markdown/*',
                '@icarus-graph-explorer/resolver-obsidian',
                '@icarus-graph-explorer/resolver-obsidian/*',
                '@icarus-graph-explorer/stable-identity',
                '@icarus-graph-explorer/stable-identity/*',
                '@icarus-graph-explorer/diagnostics-obsidian',
                '@icarus-graph-explorer/diagnostics-obsidian/*',
                '@icarus-graph-explorer/view-projection',
                '@icarus-graph-explorer/view-projection/*',
                '@icarus-graph-explorer/explorer-inspection',
                '@icarus-graph-explorer/explorer-inspection/*',
                '@icarus-graph-explorer/renderer-reactflow',
                '@icarus-graph-explorer/renderer-reactflow/*',
                '@icarus-graph-explorer/web',
                '@icarus-graph-explorer/web/*',
                'node:fs',
                'node:fs/*',
              ],
              message:
                'Snapshot-delta production code may depend only on source-neutral core.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/workspace-engine-obsidian/**/*.{ts,tsx}'],
    ignores: ['packages/workspace-engine-obsidian/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react/*',
                'react-dom',
                'react-dom/*',
                '@xyflow/*',
                '@dagrejs/*',
                '@tauri-apps/*',
                '@react-sigma/*',
                'sigma',
                'sigma/*',
                'graphology-*',
                'obsidian',
                'obsidian-*',
                '@obsidian/*',
                '@icarus-graph-explorer/parser-markdown',
                '@icarus-graph-explorer/parser-markdown/*',
                '@icarus-graph-explorer/diagnostics-obsidian',
                '@icarus-graph-explorer/diagnostics-obsidian/*',
                '@icarus-graph-explorer/view-projection',
                '@icarus-graph-explorer/view-projection/*',
                '@icarus-graph-explorer/explorer-inspection',
                '@icarus-graph-explorer/explorer-inspection/*',
                '@icarus-graph-explorer/renderer-reactflow',
                '@icarus-graph-explorer/renderer-reactflow/*',
                '@icarus-graph-explorer/web',
                '@icarus-graph-explorer/web/*',
                'node:fs',
                'node:fs/*',
                'node:crypto',
                'node:crypto/*',
              ],
              message:
                'The workspace engine is an in-memory source adapter/resolver/identity/delta orchestrator, not a platform or UI boundary.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/workspace-worker/**/*.{ts,tsx}'],
    ignores: ['packages/workspace-worker/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react/*',
                'react-dom',
                'react-dom/*',
                '@xyflow/*',
                '@dagrejs/*',
                '@tauri-apps/*',
                '@icarus-graph-explorer/source-provider-tauri',
                '@icarus-graph-explorer/source-provider-tauri/*',
                '@icarus-graph-explorer/renderer-reactflow',
                '@icarus-graph-explorer/renderer-reactflow/*',
                '@icarus-graph-explorer/web',
                '@icarus-graph-explorer/web/*',
                'node:*',
              ],
              message:
                'The workspace-worker package is a platform-independent protocol/state machine; browser Worker, Tauri, UI, and filesystem concerns belong outside it.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/stable-identity/**/*.{ts,tsx}'],
    ignores: ['packages/stable-identity/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              message: 'Stable identity must remain UI-independent.',
            },
            {
              name: 'react-dom',
              message: 'Stable identity must remain UI-independent.',
            },
            {
              name: '@icarus-graph-explorer/adapter-obsidian',
              message:
                'Stable identity consumes source-neutral canonical data.',
            },
            {
              name: '@icarus-graph-explorer/resolver-obsidian',
              message: 'Stable identity runs after source-specific resolution.',
            },
            {
              name: '@icarus-graph-explorer/diagnostics-obsidian',
              message: 'Diagnostics consume stable snapshots, not the reverse.',
            },
            {
              name: '@icarus-graph-explorer/view-projection',
              message:
                'View projection consumes stable snapshots, not the reverse.',
            },
            {
              name: 'node:fs',
              message:
                'Identity-catalog persistence belongs in a platform adapter.',
            },
            {
              name: 'node:fs/promises',
              message:
                'Identity-catalog persistence belongs in a platform adapter.',
            },
            {
              name: 'node:crypto',
              message:
                'Opaque workspace-ID generation belongs in the outer application.',
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
                '@icarus-graph-explorer/adapter-obsidian/*',
                '@icarus-graph-explorer/resolver-obsidian/*',
                '@icarus-graph-explorer/diagnostics-obsidian/*',
                '@icarus-graph-explorer/view-projection/*',
                '@icarus-graph-explorer/explorer-inspection/*',
                '@icarus-graph-explorer/renderer-reactflow/*',
                '@icarus-graph-explorer/web/*',
                'node:fs/*',
              ],
              message:
                'Stable-identity production code may depend only on source-neutral core.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/vault-discovery-policy/**/*.{ts,tsx}'],
    ignores: ['packages/vault-discovery-policy/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react/*',
                'react-dom',
                'react-dom/*',
                '@tauri-apps/*',
                '@xyflow/*',
                '@dagrejs/*',
                '@icarus-graph-explorer/adapter-obsidian',
                '@icarus-graph-explorer/adapter-obsidian/*',
                '@icarus-graph-explorer/resolver-obsidian',
                '@icarus-graph-explorer/resolver-obsidian/*',
                '@icarus-graph-explorer/stable-identity',
                '@icarus-graph-explorer/stable-identity/*',
                '@icarus-graph-explorer/diagnostics-obsidian',
                '@icarus-graph-explorer/diagnostics-obsidian/*',
                '@icarus-graph-explorer/workspace-engine-obsidian',
                '@icarus-graph-explorer/workspace-engine-obsidian/*',
                '@icarus-graph-explorer/view-projection',
                '@icarus-graph-explorer/view-projection/*',
                '@icarus-graph-explorer/explorer-inspection',
                '@icarus-graph-explorer/explorer-inspection/*',
                '@icarus-graph-explorer/renderer-reactflow',
                '@icarus-graph-explorer/renderer-reactflow/*',
                '@icarus-graph-explorer/web',
                '@icarus-graph-explorer/web/*',
                'node:*',
              ],
              message:
                'Vault discovery policy is a source-neutral pure helper boundary and may depend only on core.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/source-provider-tauri/**/*.{ts,tsx}'],
    ignores: ['packages/source-provider-tauri/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react/*',
                'react-dom',
                'react-dom/*',
                '@xyflow/*',
                '@dagrejs/*',
                '@icarus-graph-explorer/adapter-obsidian',
                '@icarus-graph-explorer/adapter-obsidian/*',
                '@icarus-graph-explorer/resolver-obsidian',
                '@icarus-graph-explorer/resolver-obsidian/*',
                '@icarus-graph-explorer/diagnostics-obsidian',
                '@icarus-graph-explorer/diagnostics-obsidian/*',
                '@icarus-graph-explorer/workspace-engine-obsidian',
                '@icarus-graph-explorer/workspace-engine-obsidian/*',
                '@icarus-graph-explorer/view-projection',
                '@icarus-graph-explorer/view-projection/*',
                '@icarus-graph-explorer/explorer-inspection',
                '@icarus-graph-explorer/explorer-inspection/*',
                '@icarus-graph-explorer/renderer-reactflow',
                '@icarus-graph-explorer/renderer-reactflow/*',
                '@icarus-graph-explorer/web',
                '@icarus-graph-explorer/web/*',
                'node:*',
              ],
              message:
                'The Tauri source provider acquires sources and private identity state; processing and UI belong outside it.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/performance/**/*.{ts,tsx}'],
    ignores: ['packages/performance/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react/*',
                'react-dom',
                'react-dom/*',
                '@xyflow/*',
                '@dagrejs/*',
                '@tauri-apps/*',
                '@icarus-graph-explorer/*',
                'node:*',
              ],
              message:
                'Performance contracts and statistics must remain source-neutral and platform-independent.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/renderer-reactflow/**/*.{ts,tsx}'],
    ignores: ['packages/renderer-reactflow/**/*.test.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@icarus-graph-explorer/core',
              message:
                'The renderer consumes the KG6 projection contract, not canonical truth.',
            },
            {
              name: '@icarus-graph-explorer/adapter-obsidian',
              message:
                'Source-specific interpretation is outside the renderer.',
            },
            {
              name: '@icarus-graph-explorer/resolver-obsidian',
              message: 'Canonical resolution is outside the renderer.',
            },
            {
              name: '@icarus-graph-explorer/diagnostics-obsidian',
              message: 'Report handling is an application responsibility.',
            },
            {
              name: '@icarus-graph-explorer/web',
              message: 'Renderer packages cannot depend on an application.',
            },
            {
              name: 'node:fs',
              message: 'The renderer is an in-memory projection consumer.',
            },
            {
              name: 'node:fs/promises',
              message: 'The renderer is an in-memory projection consumer.',
            },
          ],
          patterns: [
            {
              group: [
                '@icarus-graph-explorer/core/*',
                '@icarus-graph-explorer/adapter-obsidian/*',
                '@icarus-graph-explorer/resolver-obsidian/*',
                '@icarus-graph-explorer/diagnostics-obsidian/*',
                '@icarus-graph-explorer/web/*',
                '@tauri-apps/*',
                '@react-sigma/*',
                'sigma/*',
                'graphology-*',
                'obsidian-*',
                '@obsidian/*',
                'node:fs/*',
              ],
              message:
                'Renderer production code may depend only on projection and renderer-layer libraries.',
            },
          ],
        },
      ],
    },
  },
);
