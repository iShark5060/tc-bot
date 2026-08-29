import { describe, expect, it } from 'vitest';

import {
  calculateDamage,
  parseSheetNumber,
  getTroopStat,
  findTroopRows,
  buildValidByNameMap,
  createDamageEmbed,
  resolveDamageOutcome,
  type DamageInput,
} from '../src/commands/aow/damage.js';
import { TROOP_STAT_KEYS } from '../src/helper/constants.js';
import { TroopRow } from '../src/types/index.js';
import { createMockRow } from './helpers.js';

function baseInput(overrides: Partial<DamageInput> = {}): DamageInput {
  return {
    troopsAmount: 10,
    baseAtk: 100,
    bonusAtk: 50,
    critDmg: 100,
    critWither: 20,
    crit: true,
    baseDef: 80,
    bonusDef: 50,
    pen: 20,
    ignoreDef: 0,
    absDef: 10,
    damageModPercent: 0,
    ...overrides,
  };
}

function sampleTroop(overrides: Record<string, unknown> = {}): TroopRow {
  return createMockRow({
    troopName: 'Test Infantry',
    troopTier: '12',
    troopType: 'Infantry',
    troopUnits: '100',
    isNPC: 'N',
    troopAtk: 100,
    troopDef: 80,
    troopHp: 4000,
    ...overrides,
  });
}

describe('parseSheetNumber', () => {
  it('parses numbers, numeric strings, and comma-formatted values', () => {
    expect(parseSheetNumber(150)).toBe(150);
    expect(parseSheetNumber('1,234.5')).toBe(1234.5);
    expect(parseSheetNumber(' 42 ')).toBe(42);
  });

  it('returns null for missing or invalid values', () => {
    expect(parseSheetNumber(null)).toBeNull();
    expect(parseSheetNumber(undefined)).toBeNull();
    expect(parseSheetNumber('')).toBeNull();
    expect(parseSheetNumber('atk')).toBeNull();
    expect(parseSheetNumber(Number.NaN)).toBeNull();
  });
});

describe('getTroopStat', () => {
  it('reads the first matching alias', () => {
    const row = createMockRow({ baseATK: 12, ATK: 99 });
    expect(getTroopStat(row, TROOP_STAT_KEYS.ATK)).toBe(12);
  });

  it('falls through empty aliases to a later key', () => {
    const row = createMockRow({ troopAtk: '', ATK: 7 });
    expect(getTroopStat(row, TROOP_STAT_KEYS.ATK)).toBe(7);
  });

  it('returns null when no alias has a usable number', () => {
    const row = createMockRow({ troopName: 'Ranger' });
    expect(getTroopStat(row, TROOP_STAT_KEYS.DEF)).toBeNull();
  });
});

describe('calculateDamage', () => {
  it('matches the current crit formula with percentages and abs DEF', () => {
    const result = calculateDamage(baseInput());
    expect(result).not.toBeNull();
    expect(result?.effectiveAtk).toBe(150);
    expect(result?.atkSquared).toBe(22500);
    expect(result?.critMultiplier).toBeCloseTo(2.8);
    expect(result?.effectiveDef).toBeCloseTo(122);
    expect(result?.damage).toBeCloseTo(630000 / 122);
  });

  it('drops the crit term when crit is false', () => {
    const result = calculateDamage(baseInput({ crit: false }));
    expect(result?.critMultiplier).toBe(1);
    expect(result?.damage).toBeCloseTo(225000 / 122);
  });

  it('does not let crit wither push the extra crit bonus below zero', () => {
    const result = calculateDamage(baseInput({ critDmg: 40, critWither: 90 }));
    expect(result?.critMultiplier).toBe(2);
  });

  it('floors base DEF at 1 before the bonus/PEN/ignore scale', () => {
    const result = calculateDamage(baseInput({ baseDef: 0, absDef: 10, bonusDef: 50, pen: 20 }));
    expect(result?.baseDef).toBe(1);
    expect(result?.effectiveDef).toBeCloseTo(11.4);
  });

  it('lets PEN and ignore DEF cancel bonus DEF together', () => {
    const result = calculateDamage(baseInput({ pen: 100, ignoreDef: 100, absDef: 10 }));
    expect(result?.effectiveDef).toBe(90);
  });

  it('applies damage_mod as extra percent, not a raw multiplier', () => {
    const result = calculateDamage(baseInput({ damageModPercent: 20 }));
    expect(result?.damageMultiplier).toBeCloseTo(1.2);
    expect(result?.damage).toBeCloseTo((630000 * 1.2) / 122);
  });

  it('returns 0 damage at -100% damage mod and null for invalid inputs', () => {
    expect(calculateDamage(baseInput({ damageModPercent: -100 }))?.damage).toBe(0);
    expect(calculateDamage(baseInput({ troopsAmount: 0 }))).toBeNull();
    expect(calculateDamage(baseInput({ baseAtk: -1 }))).toBeNull();
    expect(calculateDamage(baseInput({ bonusAtk: Number.NaN }))).toBeNull();
  });
});

describe('findTroopRows and buildValidByNameMap', () => {
  const rows = [
    sampleTroop(),
    sampleTroop({ troopName: 'Other Infantry', troopAtk: 110 }),
    sampleTroop({ troopName: 'NPC Unit', isNPC: 'Y' }),
    sampleTroop({ troopName: 'Walker', troopType: 'Walker' }),
    sampleTroop({ troopName: 'No Attack', troopAtk: '' }),
    sampleTroop({ troopTier: '11', troopName: 'Lower Tier' }),
  ];

  it('filters by tier, type, and player-owned troops', () => {
    const found = findTroopRows(rows, 12, 'Infantry');
    const names = found.map((row) => String(row.get('troopName')));
    expect(names).toEqual(['Test Infantry', 'Other Infantry', 'No Attack']);
  });

  it('keeps one named row when the requested stat is present', () => {
    const found = findTroopRows(rows, 12, 'Infantry');
    const byName = buildValidByNameMap(found, TROOP_STAT_KEYS.ATK);
    expect(Array.from(byName.keys()).sort()).toEqual(['Other Infantry', 'Test Infantry']);
  });
});

describe('resolveDamageOutcome', () => {
  const pendingBase = {
    userId: 'user-1',
    expiresAt: Date.now() + 60_000,
    amount: 10,
    atkTier: 12,
    atkType: 'Infantry',
    defTier: 12,
    defType: 'Walker',
    bonusAtk: 0,
    bonusDef: 0,
    critDmg: 0,
    critWither: 0,
    pen: 0,
    ignoreDef: 0,
    absDef: 0,
    damageModPercent: 0,
    crit: true,
  };

  it('asks for a troop pick when several names share the tier and type', () => {
    const rows = [
      sampleTroop({ troopName: 'Alpha' }),
      sampleTroop({ troopName: 'Bravo' }),
      sampleTroop({
        troopName: 'Defender',
        troopType: 'Walker',
        troopAtk: 1,
        troopDef: 50,
      }),
    ];

    const outcome = resolveDamageOutcome(rows, { ...pendingBase });
    expect(outcome).toMatchObject({
      kind: 'select',
      step: 'atk',
      names: ['Alpha', 'Bravo'],
    });
  });

  it('calculates immediately when each side has a single named troop', () => {
    const rows = [
      sampleTroop({ troopName: 'Ranger' }),
      sampleTroop({
        troopName: 'Yeti',
        troopType: 'Walker',
        troopAtk: 8,
        troopDef: 8,
        troopHp: 80,
      }),
    ];

    const outcome = resolveDamageOutcome(rows, { ...pendingBase });
    expect(outcome).toMatchObject({
      kind: 'result',
      view: {
        attackerName: 'Ranger',
        defenderName: 'Yeti',
        defenderHp: 80,
        result: { damage: expect.any(Number) },
      },
    });
  });

  it('explains missing attack columns instead of pretending the troop does not exist', () => {
    const rows = [
      sampleTroop({ troopAtk: '', troopName: 'Ranger' }),
      sampleTroop({ troopName: 'Yeti', troopType: 'Walker', troopDef: 8 }),
    ];

    const outcome = resolveDamageOutcome(rows, { ...pendingBase });
    expect(outcome).toMatchObject({
      kind: 'error',
      message: expect.stringContaining('troopAtk'),
    });
  });

  it('explains missing defense columns the same way', () => {
    const rows = [
      sampleTroop({ troopName: 'Ranger' }),
      sampleTroop({ troopName: 'Yeti', troopType: 'Walker', troopDef: '' }),
    ];

    const outcome = resolveDamageOutcome(rows, { ...pendingBase });
    expect(outcome).toMatchObject({
      kind: 'error',
      message: expect.stringContaining('troopDef'),
    });
  });
});

describe('createDamageEmbed', () => {
  it('shows crit damage, kill estimate, and the input breakdown', () => {
    const input = baseInput();
    const result = calculateDamage(input);
    expect(result).not.toBeNull();
    if (!result) {
      throw new Error('expected a damage result');
    }

    const embed = createDamageEmbed(
      {
        amount: 10,
        attackerName: 'Ranger',
        attackerTier: 12,
        attackerType: 'Infantry',
        defenderName: 'Yeti',
        defenderTier: 12,
        defenderType: 'Walker',
        input,
        result,
        defenderHp: 4000,
      },
      process.hrtime.bigint(),
    ).toJSON();

    expect(embed.title).toBe('Damage');
    const fields = embed.fields ?? [];
    const selection = fields.find((field) => field.name === 'Selection:')?.value ?? '';
    const resultField = fields.find((field) => field.name === 'Result:')?.value ?? '';
    const breakdown = fields.find((field) => field.name === 'Breakdown:')?.value ?? '';

    expect(selection).toContain('10x Ranger');
    expect(selection).toContain('vs Yeti');
    expect(resultField).toContain('Damage (crit)');
    expect(resultField).toContain('Kills::');
    expect(breakdown).toContain('ATK::');
    expect(breakdown).toContain('DEF::');
  });
});
