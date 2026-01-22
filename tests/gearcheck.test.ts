import { describe, it, expect } from 'vitest';
import { calculateGearStats } from '../src/commands/aow/gearcheck.js';

describe('calculateGearStats', () => {
  it('calculates base stat from +0 level', () => {
    const result = calculateGearStats(100, 0);

    expect(result[0]).toBe('100.00');
  });

  it('calculates base stat from +10 level', () => {
    const result = calculateGearStats(200, 10);

    expect(result[0]).toBe('100.00');
    expect(result[10]).toBe('200.00');
  });

  it('calculates base stat from +20 level', () => {
    const result = calculateGearStats(120, 20);

    expect(result[0]).toBe('40.00');
    expect(result[10]).toBe('80.00');
    expect(result[20]).toBe('120.00');
    expect(result[50]).toBe('240.00');
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
    const result = calculateGearStats(100, 0);

    expect(result[0]).toBe('100.00');
    expect(result[10]).toBe('200.00');
    expect(result[13]).toBe('230.00');
    expect(result[20]).toBe('300.00');
    expect(result[30]).toBe('400.00');
    expect(result[40]).toBe('500.00');
    expect(result[50]).toBe('600.00');
  });

  it('handles decimal input', () => {
    const result = calculateGearStats(85.5, 10);

    expect(result[0]).toBe('42.75');
    expect(result[10]).toBe('85.50');
  });

  it('handles high level input', () => {
    const result = calculateGearStats(600, 50);

    expect(result[0]).toBe('100.00');
    expect(result[50]).toBe('600.00');
  });
});

