import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function writePrivateReport(
  outputPath: string,
  serializedReport: string,
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serializedReport, {
    encoding: 'utf8',
    flag: 'w',
  });
}
