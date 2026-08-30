import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

export const WORKER_SAFE_NAMED_REFERENCE_MODULE = fileURLToPath(
  import.meta.resolve('decode-named-character-reference'),
);

const FORBIDDEN_WORKER_DOM_PATTERNS = [
  {
    label: 'document.createElement',
    pattern: /\bdocument\s*\.\s*createElement(?:NS)?\s*\(/,
  },
  {
    label: 'window.document',
    pattern: /\bwindow\s*\.\s*document\b/,
  },
] as const;

export function assertWorkerChunkIsDomFree(
  fileName: string,
  code: string,
): void {
  const forbidden = FORBIDDEN_WORKER_DOM_PATTERNS.find(({ pattern }) =>
    pattern.test(code),
  );
  if (forbidden === undefined) return;
  throw new Error(
    `Worker bundle ${fileName} contains forbidden DOM runtime ${forbidden.label}. Use a worker-safe conditional export or move the dependency outside the worker.`,
  );
}

export function workerRuntimeBoundary(): Plugin {
  return {
    name: 'icarus-worker-runtime-boundary',
    enforce: 'pre',
    resolveId: (source) =>
      source === 'decode-named-character-reference'
        ? WORKER_SAFE_NAMED_REFERENCE_MODULE
        : null,
    generateBundle: (_options, bundle) => {
      for (const output of Object.values(bundle)) {
        if (output.type === 'chunk') {
          assertWorkerChunkIsDomFree(output.fileName, output.code);
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react()],
  worker: {
    plugins: () => [workerRuntimeBoundary()],
  },
});
