import { describe, it, expect } from 'vitest';
import { numberWithCommas } from '../src/helper/formatters.js';

describe('numberWithCommas', () => {
  it('formats integers with commas', () => {
    expect(numberWithCommas(1000)).toBe('1,000');
    expect(numberWithCommas(1000000)).toBe('1,000,000');
    expect(numberWithCommas(123456789)).toBe('123,456,789');
  });

  it('handles small numbers without commas', () => {
    expect(numberWithCommas(0)).toBe('0');
    expect(numberWithCommas(1)).toBe('1');
    expect(numberWithCommas(999)).toBe('999');
  });

  it('handles string input', () => {
    expect(numberWithCommas('1000')).toBe('1,000');
    expect(numberWithCommas('1234567')).toBe('1,234,567');
  });

  it('handles decimal numbers', () => {
    expect(numberWithCommas('1234.56')).toBe('1,234.56');
    expect(numberWithCommas('1000000.99')).toBe('1,000,000.99');
  });

  it('handles negative numbers', () => {
    expect(numberWithCommas(-1000)).toBe('-1,000');
    expect(numberWithCommas(-1234567)).toBe('-1,234,567');
  });
});

