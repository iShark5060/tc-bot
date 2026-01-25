import { describe, expect, it } from 'vitest';
import { calculateKills } from '../src/commands/aow/its.js';
import { TroopRow } from '../src/types/index.js';

function createMockRow(data: Record<string, unknown>): TroopRow {
  const headers = Object.keys(data);
  const values = Object.values(data);
  return new TroopRow(headers, values);
}

describe('calculateKills', () => {
  const mockRows: TroopRow[] = [
    createMockRow({
      troopTier: '12',
      troopUnits: '100',
      troopName: 'Test Infantry',
      troopType: 'Infantry',
      isNPC: 'N',
    }),
    createMockRow({
      troopTier: '12',
      troopUnits: '50',
      troopName: 'Test Walker',
      troopType: 'Walker',
      isNPC: 'N',
    }),
    createMockRow({
      troopTier: '10',
      troopUnits: '100',
      troopName: 'Lower Tier Infantry',
      troopType: 'Infantry',
      isNPC: 'N',
    }),
    createMockRow({
      troopTier: '12',
      troopUnits: '100',
      troopName: 'NPC Unit',
      troopType: 'Infantry',
      isNPC: 'Y',
    }),
  ];

  it('filters by target tier', () => {
    const kills = calculateKills(mockRows, 12, 30, 500000, 0);

    const names = kills.map((k) => k.name);
    expect(names).toContain('Test Infantry');
    expect(names).toContain('Test Walker');
    expect(names).not.toContain('Lower Tier Infantry');
  });

  it('excludes NPC units', () => {
    const kills = calculateKills(mockRows, 12, 30, 500000, 0);

    const names = kills.map((k) => k.name);
    expect(names).not.toContain('NPC Unit');
  });

  it('calculates kill count using damage coefficient', () => {
    const kills = calculateKills(mockRows, 12, 30, 500000, 0);

    const infantry = kills.find((k) => k.name === 'Test Infantry');
    expect(infantry?.count).toBe(750);
  });

  it('applies TDR reduction correctly', () => {
    const kills = calculateKills(mockRows, 12, 30, 500000, 20);

    const infantry = kills.find((k) => k.name === 'Test Infantry');
    expect(infantry?.count).toBe(600);
  });

  it('sorts results by kill count descending', () => {
    const kills = calculateKills(mockRows, 12, 30, 500000, 0);

    expect(kills[0].name).toBe('Test Walker');
    expect(kills[0].count).toBe(1500);
    expect(kills[1].name).toBe('Test Infantry');
    expect(kills[1].count).toBe(750);
  });

  it('returns empty array when no troops match', () => {
    const kills = calculateKills(mockRows, 99, 30, 500000, 0);

    expect(kills).toEqual([]);
  });

  it('handles zero kills correctly', () => {
    const kills = calculateKills(mockRows, 12, 1, 1, 0);

    expect(kills.length).toBe(0);
  });

  it('abbreviates troop types correctly', () => {
    const kills = calculateKills(mockRows, 12, 30, 500000, 0);

    const infantry = kills.find((k) => k.name === 'Test Infantry');
    const walker = kills.find((k) => k.name === 'Test Walker');

    expect(infantry?.type).toBe('INF');
    expect(walker?.type).toBe('WLK');
  });

  it('handles rows with missing units', () => {
    const rowsWithInvalid = [
      ...mockRows,
      createMockRow({
        troopTier: '12',
        troopUnits: '',
        troopName: 'Invalid Unit',
        troopType: 'Infantry',
        isNPC: 'N',
      }),
    ];

    const kills = calculateKills(rowsWithInvalid, 12, 30, 500000, 0);

    const names = kills.map((k) => k.name);
    expect(names).not.toContain('Invalid Unit');
  });

  it('handles rows with zero units', () => {
    const rowsWithZero = [
      ...mockRows,
      createMockRow({
        troopTier: '12',
        troopUnits: '0',
        troopName: 'Zero Unit',
        troopType: 'Infantry',
        isNPC: 'N',
      }),
    ];

    const kills = calculateKills(rowsWithZero, 12, 30, 500000, 0);

    const names = kills.map((k) => k.name);
    expect(names).not.toContain('Zero Unit');
  });

  it('clamps TDR to valid range', () => {
    const kills = calculateKills(mockRows, 12, 30, 500000, 100);

    expect(kills.length).toBe(0);
  });
});
