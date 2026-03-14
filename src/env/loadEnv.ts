import { config as loadEnv } from '@dotenvx/dotenvx';
import fs from 'node:fs';
import path from 'node:path';

const envPath = path.join(process.cwd(), '.env');

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
