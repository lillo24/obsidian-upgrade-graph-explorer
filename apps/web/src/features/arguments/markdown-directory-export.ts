import type { MarkdownExportFile } from '@icarus-graph-explorer/argument-workspace';

interface WritableFile {
  write(value: string): Promise<void>;
  close(): Promise<void>;
}

interface SelectedFileHandle {
  createWritable(): Promise<WritableFile>;
}

export interface SelectedDirectoryHandle {
  getDirectoryHandle(
    name: string,
    options: { readonly create: true },
  ): Promise<SelectedDirectoryHandle>;
  getFileHandle(
    name: string,
    options: { readonly create: true },
  ): Promise<SelectedFileHandle>;
}

export type DirectoryPicker = () => Promise<SelectedDirectoryHandle>;

function parts(path: string): readonly string[] {
  if (
    path.startsWith('/') ||
    path.startsWith('\\') ||
    /^[a-z]:/iu.test(path) ||
    path.includes('\\')
  ) {
    throw new Error(
      `Markdown export path must be portable and relative: ${path}`,
    );
  }
  const result = path.split('/');
  if (
    result.length < 2 ||
    result.some((part) => part === '' || part === '.' || part === '..') ||
    !path.endsWith('.md')
  ) {
    throw new Error(`Markdown export path is unsafe: ${path}`);
  }
  return result;
}

/** Writes only validated relative export paths beneath an explicitly selected directory. */
export async function saveMarkdownDirectory(
  files: readonly MarkdownExportFile[],
  pickDirectory: DirectoryPicker,
): Promise<number> {
  const root = await pickDirectory();
  for (const file of files) {
    const pathParts = parts(file.path);
    let directory = root;
    for (const folder of pathParts.slice(0, -1)) {
      directory = await directory.getDirectoryHandle(folder!, { create: true });
    }
    const handle = await directory.getFileHandle(pathParts.at(-1)!, {
      create: true,
    });
    const writable = await handle.createWritable();
    await writable.write(file.text);
    await writable.close();
  }
  return files.length;
}
