import { EmbedBuilder } from 'discord.js';
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

  return determineMopupStatus(startTime - currentTime, endTime - currentTime, currentTime);
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
 * @param currentTime - Current time in milliseconds
 * @returns MopupInfo with status, color, formatted time string, and unix timestamp
 */
function determineMopupStatus(deltaStart: number, deltaEnd: number, currentTime: number): MopupInfo {
  if (deltaStart < 0) {
    if (deltaEnd > 0) {
      return {
        status: 'ACTIVE',
        color: 0x7fff00,
        time: formatTime(deltaEnd),
        timestamp: Math.floor((currentTime + deltaEnd) / 1000),
      };
    }
    const nextStartDelta = deltaEnd + 24 * 60 * 60 * 1000;
    return {
      status: 'INACTIVE',
      color: 0xcf142b,
      time: formatTime(nextStartDelta),
      timestamp: Math.floor((currentTime + nextStartDelta) / 1000),
    };
  }
  return {
    status: 'INACTIVE',
    color: 0xcf142b,
    time: formatTime(deltaStart),
    timestamp: Math.floor((currentTime + deltaStart) / 1000),
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

/**
 * Builds an embed for displaying mopup status.
 * Used by both /mopup slash command and !tcmu message command.
 * @returns EmbedBuilder configured with mopup status, time remaining, and local timestamp
 */
function buildMopupEmbed(): EmbedBuilder {
  const { status, color, time, timestamp } = calculateMopupTiming();
  return new EmbedBuilder()
    .setColor(color)
    .setTitle('Mopup')
    .addFields(
      { name: 'Status:', value: `\`\`\`asciidoc\n${status}\`\`\`` },
      { name: 'Time remaining:', value: `\`\`\`asciidoc\n${time}\`\`\`` },
      { name: 'Local time:', value: `<t:${timestamp}:f>` },
    );
}

export { calculateMopupTiming, getMopupWindow, determineMopupStatus, formatTime, buildMopupEmbed };