import { describe, it, expect } from 'vitest';
import { calculateKills } from '../src/commands/aow/its.js';
import type { TroopRow } from '../src/types/index.js';

function createMockRow(data: Record<string, unknown>): TroopRow {
  return {
    get(key: string): unknown {
      return data[key];
    },
  };
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
    // coef = 0.005 * leadership * skillLevel * ((100 - tdr) / 100)
    // coef = 0.005 * 500000 * 30 * 1 = 75000
    // kills = floor(coef / units) = floor(75000 / 100) = 750
    const kills = calculateKills(mockRows, 12, 30, 500000, 0);

    const infantry = kills.find((k) => k.name === 'Test Infantry');
    expect(infantry?.count).toBe(750);
  });

  it('applies TDR reduction correctly', () => {
    // With 20% TDR:
    // coef = 0.005 * 500000 * 30 * 0.8 = 60000
    // kills = floor(60000 / 100) = 600
    const kills = calculateKills(mockRows, 12, 30, 500000, 20);

    const infantry = kills.find((k) => k.name === 'Test Infantry');
    expect(infantry?.count).toBe(600);
  });

  it('sorts results by kill count descending', () => {
    const kills = calculateKills(mockRows, 12, 30, 500000, 0);

    // Walker has 50 units, Infantry has 100 units
    // Walker should have more kills (75000/50 = 1500 vs 75000/100 = 750)
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
    // Very low leadership/skill should result in 0 kills
    // coef = 0.005 * 1 * 1 * 1 = 0.005
    // kills = floor(0.005 / 100) = 0
    const kills = calculateKills(mockRows, 12, 1, 1, 0);

    // Should filter out zero-kill results
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
    // TDR is clamped in the command, but calculateKills receives already-clamped value
    // Test with 100% TDR should result in 0 kills
    const kills = calculateKills(mockRows, 12, 30, 500000, 100);

    expect(kills.length).toBe(0);
  });
});
