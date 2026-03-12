import { TroopRow } from '../src/types/index.js';

export function createMockRow(data: Record<string, unknown>): TroopRow {
  const headers = Object.keys(data);
  const values = Object.values(data);
  return new TroopRow(headers, values);
}
