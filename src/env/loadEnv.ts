import { config as loadEnv } from '@dotenvx/dotenvx';
import fs from 'node:fs';
import path from 'node:path';

function resolveEnvPath(): string {
  const baseDir = path.resolve(process.cwd());
  const defaultFile =
    process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
  const explicitFile = process.env.ENV_FILE?.trim();

  if (explicitFile) {
    const hasTraversal = /(^|[\\/])\.\.([\\/]|$)/.test(explicitFile);
    if (!path.isAbsolute(explicitFile) && !hasTraversal) {
      const resolved = path.resolve(baseDir, path.normalize(explicitFile));
      const relative = path.relative(baseDir, resolved);
      const isInBaseDir =
        relative !== '' &&
        !relative.startsWith('..') &&
        !path.isAbsolute(relative);
      if (isInBaseDir) {
        return resolved;
      }
    }

    console.warn(
      `[Config] Ignoring unsafe ENV_FILE value "${explicitFile}", using default "${defaultFile}".`,
    );
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
