import fs from 'node:fs/promises';
import path from 'node:path';

export async function discoverCommandFiles(
  rootDir: string,
  extension: '.js' | '.ts',
): Promise<string[]> {
  const files: string[] = [];
  const stack: string[] = [rootDir];
  const visitedDirectories = new Set<string>();

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    const stat = await fs.stat(current);
    if (stat.isDirectory()) {
      const realPath = await fs.realpath(current);
      if (visitedDirectories.has(realPath)) {
        continue;
      }
      visitedDirectories.add(realPath);

      const entries = await fs.readdir(current);
      for (const entry of entries) {
        stack.push(path.join(current, entry));
      }
      continue;
    }

    if (current.endsWith(extension)) {
      files.push(current);
    }
  }

  files.sort((a, b) => a.localeCompare(b));
  return files;
}
