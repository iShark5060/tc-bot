import { describe, it, expect } from 'vitest';
import {
  calculateMopupTiming,
  getMopupWindow,
  determineMopupStatus,
  formatTime,
} from '../src/helper/mopup.js';

describe('formatTime', () => {
  it('formats milliseconds to HH:MM:SS', () => {
    expect(formatTime(0)).toBe('00:00:00');
    expect(formatTime(1000)).toBe('00:00:01');
    expect(formatTime(60000)).toBe('00:01:00');
    expect(formatTime(3600000)).toBe('01:00:00');
    expect(formatTime(3661000)).toBe('01:01:01');
  });

  it('handles negative values (uses absolute)', () => {
    expect(formatTime(-1000)).toBe('00:00:01');
    expect(formatTime(-3600000)).toBe('01:00:00');
  });

  it('formats multi-hour durations', () => {
    expect(formatTime(8 * 3600000)).toBe('08:00:00');
    expect(formatTime(16 * 3600000)).toBe('16:00:00');
  });
});

describe('getMopupWindow', () => {
  it('returns correct window for even days', () => {
    const window = getMopupWindow(0);
    const dayInMs = 24 * 60 * 60 * 1000;
    const hourInMs = 60 * 60 * 1000;

    expect(window.startTime).toBe(26 * hourInMs);
    expect(window.endTime).toBe(34 * hourInMs);
  });

  it('returns correct window for odd days', () => {
    const window = getMopupWindow(1);
    const dayInMs = 24 * 60 * 60 * 1000;
    const hourInMs = 60 * 60 * 1000;

    expect(window.startTime).toBe(dayInMs + 8 * hourInMs);
    expect(window.endTime).toBe(dayInMs + 24 * hourInMs);
  });

  it('alternates between even and odd day windows', () => {
    const window0 = getMopupWindow(0);
    const window1 = getMopupWindow(1);
    const window2 = getMopupWindow(2);

    // Even days should have same relative timing
    expect(window2.endTime - window2.startTime).toBe(window0.endTime - window0.startTime);
    // Odd days have different duration
    expect(window1.endTime - window1.startTime).toBe(16 * 60 * 60 * 1000); // 16 hours
  });
});

describe('determineMopupStatus', () => {
  it('returns ACTIVE when mopup is ongoing', () => {
    const result = determineMopupStatus(-1000, 3600000); // started, 1 hour left
    expect(result.status).toBe('ACTIVE');
    expect(result.color).toBe(0x7fff00); // green
  });

  it('returns INACTIVE when mopup has not started', () => {
    const result = determineMopupStatus(3600000, 7200000); // starts in 1 hour
    expect(result.status).toBe('INACTIVE');
    expect(result.color).toBe(0xcf142b); // red
  });

  it('returns INACTIVE when mopup has ended', () => {
    const result = determineMopupStatus(-7200000, -3600000); // ended 1 hour ago
    expect(result.status).toBe('INACTIVE');
    expect(result.color).toBe(0xcf142b); // red
  });
});

describe('calculateMopupTiming', () => {
  it('returns valid MopupInfo structure', () => {
    const result = calculateMopupTiming();

    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('color');
    expect(result).toHaveProperty('time');

    expect(['ACTIVE', 'INACTIVE']).toContain(result.status);
    expect(typeof result.color).toBe('number');
    expect(result.time).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('returns consistent color for status', () => {
    const result = calculateMopupTiming();

    if (result.status === 'ACTIVE') {
      expect(result.color).toBe(0x7fff00);
    } else {
      expect(result.color).toBe(0xcf142b);
    }
  });
});

