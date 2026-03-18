import { config as loadEnv } from '@dotenvx/dotenvx';
import fs from 'node:fs';
import path from 'node:path';

function resolveEnvPath(): string {
  const baseDir = path.resolve(process.cwd());
  const defaultFile =
    process.env.NODE_ENV === 'production'
      ? '.env.production'
      : '.env.development';
  const explicitFile = process.env.ENV_FILE?.trim();

  if (explicitFile) {
    const rejectExplicitFile = (reason: string): void => {
      console.warn(
        `[Config] Ignoring ENV_FILE value "${explicitFile}": ${reason}. Using default "${defaultFile}".`,
      );
    };

    if (path.isAbsolute(explicitFile)) {
      rejectExplicitFile('ignored absolute path');
      return path.resolve(baseDir, defaultFile);
    }

    const hasTraversal = /(^|[\\/])\.\.([\\/]|$)/.test(explicitFile);
    if (hasTraversal) {
      rejectExplicitFile('ignored path containing traversal segments');
      return path.resolve(baseDir, defaultFile);
    }

    const resolved = path.resolve(baseDir, path.normalize(explicitFile));
    const relative = path.relative(baseDir, resolved);
    const isInBaseDir =
      relative !== '' &&
      !relative.startsWith('..') &&
      !path.isAbsolute(relative);
    if (!isInBaseDir) {
      rejectExplicitFile('ignored path outside base directory');
      return path.resolve(baseDir, defaultFile);
    }

    try {
      const baseRealPath = fs.realpathSync.native(baseDir);
      const resolvedRealPath = fs.realpathSync.native(resolved);
      const resolvedRelativeToBase = path.relative(
        baseRealPath,
        resolvedRealPath,
      );
      const isRealPathInBaseDir =
        !resolvedRelativeToBase.startsWith('..') &&
        !path.isAbsolute(resolvedRelativeToBase);
      if (!isRealPathInBaseDir) {
        rejectExplicitFile(
          'ignored path resolving outside baseDir or symlink traversal',
        );
        return path.resolve(baseDir, defaultFile);
      }

      return resolved;
    } catch {
      rejectExplicitFile(
        'ignored path resolving outside baseDir or symlink traversal',
      );
      return path.resolve(baseDir, defaultFile);
    }
  }

  return path.resolve(baseDir, defaultFile);
}

const envPath = resolveEnvPath();

if (fs.existsSync(envPath)) {
  try {
    loadEnv({ path: envPath });
  } catch (error) {
    console.error(
      `[Config] Failed to load environment via loadEnv from "${envPath}".`,
      error,
    );
    throw error;
  }
} else {
  console.debug(
    `[Config] No .env file found at "${envPath}", skipping loadEnv.`,
  );
}
