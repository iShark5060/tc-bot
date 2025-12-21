import type { MopupInfo } from '../types/index.js';

interface MopupWindow {
  startTime: number;
  endTime: number;
}

/**
 * Calculates the current mopup status and time remaining.
 * Mopup windows alternate between even days (26-34 hours) and odd days (8-24 hours).
 * @returns MopupInfo with status ('ACTIVE' or 'INACTIVE'), color code, and time string
 */
function calculateMopupTiming(): MopupInfo {
  const now = Date.now();
  const utcOffset = new Date().getTimezoneOffset() * 60 * 1000;
  const hoursFromEpoch = Math.ceil((now + utcOffset) / (60 * 60 * 1000)) - 8;
  const daysSinceEpoch = Math.floor(hoursFromEpoch / 24);

  const { startTime, endTime } = getMopupWindow(daysSinceEpoch);
  const currentTime = Math.floor(now / 1000) * 1000;

  return determineMopupStatus(startTime - currentTime, endTime - currentTime);
}

/**
 * Gets the mopup window for a given day number.
 * Even days: 26-34 hours (8 hour window)
 * Odd days: 8-24 hours (16 hour window)
 * @param day - The day number since epoch
 * @returns MopupWindow with startTime and endTime in milliseconds
 */
function getMopupWindow(day: number): MopupWindow {
  const dayInMs = 24 * 60 * 60 * 1000;
  const hourInMs = 60 * 60 * 1000;

  if (day % 2 === 0) {
    return {
      startTime: day * dayInMs + 26 * hourInMs,
      endTime: day * dayInMs + 34 * hourInMs,
    };
  }
  return {
    startTime: day * dayInMs + 8 * hourInMs,
    endTime: day * dayInMs + 24 * hourInMs,
  };
}

/**
 * Determines the mopup status based on time deltas.
 * @param deltaStart - Milliseconds until mopup starts (negative if already started)
 * @param deltaEnd - Milliseconds until mopup ends (negative if already ended)
 * @returns MopupInfo with status, color, and formatted time string
 */
function determineMopupStatus(deltaStart: number, deltaEnd: number): MopupInfo {
  if (deltaStart < 0) {
    if (deltaEnd > 0) {
      return { status: 'ACTIVE', color: 0x7fff00, time: formatTime(deltaEnd) };
    }
    return {
      status: 'INACTIVE',
      color: 0xcf142b,
      time: formatTime(deltaEnd + 24 * 60 * 60 * 1000),
    };
  }
  return {
    status: 'INACTIVE',
    color: 0xcf142b,
    time: formatTime(deltaStart),
  };
}

/**
 * Formats milliseconds into HH:MM:SS time string.
 * @param ms - Milliseconds to format (uses absolute value)
 * @returns Time string in format "HH:MM:SS"
 * @example
 * formatTime(3661000) // "01:01:01"
 */
function formatTime(ms: number): string {
  return new Date(Math.abs(ms)).toISOString().slice(11, 19);
}

export { calculateMopupTiming, getMopupWindow, determineMopupStatus, formatTime };