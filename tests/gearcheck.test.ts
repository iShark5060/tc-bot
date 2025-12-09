import { describe, it, expect } from 'vitest';
import { calculateGearStats } from '../src/commands/aow/gearcheck.js';

describe('calculateGearStats', () => {
  it('calculates base stat from +0 level', () => {
    const result = calculateGearStats(100, 0);

    // At +0, multiplier is 1, so base = current
    expect(result[0]).toBe('100.00');
  });

  it('calculates base stat from +10 level', () => {
    // At +10, multiplier is 2 (1 + 10/10)
    // If current stat is 200 at +10, base is 100
    const result = calculateGearStats(200, 10);

    expect(result[0]).toBe('100.00'); // base
    expect(result[10]).toBe('200.00'); // +10 (2x)
  });

  it('calculates base stat from +20 level', () => {
    // At +20, multiplier is 3 (1 + 20/10)
    // If current stat is 120 at +20, base is 40
    const result = calculateGearStats(120, 20);

    expect(result[0]).toBe('40.00'); // base
    expect(result[10]).toBe('80.00'); // +10 (2x base)
    expect(result[20]).toBe('120.00'); // +20 (3x base)
    expect(result[50]).toBe('240.00'); // +50 (6x base)
  });

  it('returns all expected levels', () => {
    const result = calculateGearStats(100, 0);
    const levels = Object.keys(result).map(Number);

    expect(levels).toContain(0);
    expect(levels).toContain(10);
    expect(levels).toContain(13);
    expect(levels).toContain(20);
    expect(levels).toContain(30);
    expect(levels).toContain(40);
    expect(levels).toContain(50);
  });

  it('uses correct multipliers', () => {
    // Base stat of 100
    const result = calculateGearStats(100, 0);

    expect(result[0]).toBe('100.00'); // 1x
    expect(result[10]).toBe('200.00'); // 2x
    expect(result[13]).toBe('230.00'); // 2.3x
    expect(result[20]).toBe('300.00'); // 3x
    expect(result[30]).toBe('400.00'); // 4x
    expect(result[40]).toBe('500.00'); // 5x
    expect(result[50]).toBe('600.00'); // 6x
  });

  it('handles decimal input', () => {
    const result = calculateGearStats(85.5, 10);
    // base = 85.5 / 2 = 42.75

    expect(result[0]).toBe('42.75');
    expect(result[10]).toBe('85.50');
  });

  it('handles high level input', () => {
    // At +50, multiplier is 6 (1 + 50/10)
    const result = calculateGearStats(600, 50);
    // base = 600 / 6 = 100

    expect(result[0]).toBe('100.00');
    expect(result[50]).toBe('600.00');
  });
});

