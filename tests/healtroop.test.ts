import { describe, expect, it } from 'vitest';
import {
  getModifier,
  getOptimalModifier,
  calculateResourceCost,
  calculateHealingCosts,
} from '../src/commands/aow/healtroop.js';
import { TroopRow } from '../src/types/index.js';

function createMockRow(data: Record<string, unknown>): TroopRow {
  const headers = Object.keys(data);
  const values = Object.values(data);
  return new TroopRow(headers, values);
}

describe('getModifier', () => {
  it('returns 0.25 for units >= 3501', () => {
    expect(getModifier(3501)).toBe(0.25);
    expect(getModifier(5000)).toBe(0.25);
    expect(getModifier(10000)).toBe(0.25);
  });

  it('returns 0.22 for units 1501-3500', () => {
    expect(getModifier(1501)).toBe(0.22);
    expect(getModifier(2500)).toBe(0.22);
    expect(getModifier(3500)).toBe(0.22);
  });

  it('returns 0.19 for units 901-1500', () => {
    expect(getModifier(901)).toBe(0.19);
    expect(getModifier(1200)).toBe(0.19);
    expect(getModifier(1500)).toBe(0.19);
  });

  it('returns 0.17 for units 501-900', () => {
    expect(getModifier(501)).toBe(0.17);
    expect(getModifier(700)).toBe(0.17);
    expect(getModifier(900)).toBe(0.17);
  });

  it('returns 0.15 for units 201-500', () => {
    expect(getModifier(201)).toBe(0.15);
    expect(getModifier(350)).toBe(0.15);
    expect(getModifier(500)).toBe(0.15);
  });

  it('returns 0.1 for units 0-200', () => {
    expect(getModifier(0)).toBe(0.1);
    expect(getModifier(100)).toBe(0.1);
    expect(getModifier(200)).toBe(0.1);
  });
});

describe('getOptimalModifier', () => {
  it('returns highest modifier for units >= 3501', () => {
    const result = getOptimalModifier(3501);
    expect(result.modifier).toBe(0.25);
    expect(result.units).toBe(-1);
  });

  it('returns next tier up for units below threshold', () => {
    const result = getOptimalModifier(1000);
    expect(result.modifier).toBe(0.22);
    expect(result.units).toBe(1501);
  });

  it('returns next tier up for small units', () => {
    const result = getOptimalModifier(50);
    expect(result.modifier).toBe(0.15);
    expect(result.units).toBe(201);
  });
});

describe('calculateResourceCost', () => {
  it('calculates cost correctly', () => {
    const cost = calculateResourceCost('1000', 10, 0.25);
    expect(cost).toBe(2500);
  });

  it('handles comma-formatted numbers', () => {
    const cost = calculateResourceCost('1,000,000', 1, 0.1);
    expect(cost).toBe(100000);
  });

  it('returns null for null input', () => {
    expect(calculateResourceCost(null, 10, 0.25)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(calculateResourceCost(undefined, 10, 0.25)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(calculateResourceCost('', 10, 0.25)).toBeNull();
  });

  it('returns null for non-numeric string', () => {
    expect(calculateResourceCost('abc', 10, 0.25)).toBeNull();
  });

  it('rounds up to nearest integer', () => {
    const cost = calculateResourceCost('100', 1, 0.17);
    expect(cost).toBe(17);

    const cost2 = calculateResourceCost('101', 1, 0.17);
    expect(cost2).toBe(18);
  });
});

describe('calculateHealingCosts', () => {
  it('returns null for invalid units', () => {
    const row = createMockRow({ troopUnits: '0' });
    expect(calculateHealingCosts(row, 10)).toBeNull();

    const row2 = createMockRow({ troopUnits: '-1' });
    expect(calculateHealingCosts(row2, 10)).toBeNull();

    const row3 = createMockRow({ troopUnits: 'invalid' });
    expect(calculateHealingCosts(row3, 10)).toBeNull();
  });

  it('calculates totalUnits correctly', () => {
    const row = createMockRow({
      troopUnits: '100',
      foodCost: '1000',
    });

    const costs = calculateHealingCosts(row, 50);

    expect(costs?.totalUnits).toBe(5000);
  });

  it('applies correct modifier based on total units', () => {
    const row = createMockRow({
      troopUnits: '100',
      foodCost: '1000',
    });

    const costs = calculateHealingCosts(row, 50);
    expect(costs?.modifier).toBe(0.25);
  });

  it('calculates resource costs', () => {
    const row = createMockRow({
      troopUnits: '100',
      foodCost: '1000',
      partsCost: '500',
    });

    const costs = calculateHealingCosts(row, 50);

    expect(costs?.resources['foodCost']?.current).toBe(12500);
    expect(costs?.resources['partsCost']?.current).toBe(6250);
  });

  it('calculates special costs', () => {
    const row = createMockRow({
      troopUnits: '100',
      smCost: '10',
    });

    const costs = calculateHealingCosts(row, 50);

    expect(costs?.special['smCost']).toBeDefined();
  });

  it('calculates other stats', () => {
    const row = createMockRow({
      troopUnits: '100',
      foodCost: '1000',
      powerLost: '500',
      kePoints: '100',
    });

    const costs = calculateHealingCosts(row, 10);

    expect(costs?.other['powerLost']).toBe(5000);
    expect(costs?.other['kePoints']).toBe(1000);
  });

  it('sets hasData to true when any cost data exists', () => {
    const row = createMockRow({
      troopUnits: '100',
      foodCost: '1000',
    });

    const costs = calculateHealingCosts(row, 10);
    expect(costs?.hasData).toBe(true);
  });

  it('returns null when no cost data exists', () => {
    const row = createMockRow({
      troopUnits: '100',
    });

    const costs = calculateHealingCosts(row, 10);
    expect(costs).toBeNull();
  });

  it('calculates optimal quantity', () => {
    const row = createMockRow({
      troopUnits: '500',
      foodCost: '1000',
    });

    const costs = calculateHealingCosts(row, 10);

    expect(costs?.optQty).toBe(1);
  });
});
