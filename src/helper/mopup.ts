import { EmbedBuilder, Colors } from 'discord.js';

import type { MopupInfo } from '../types/index.js';
import { BOT_ICON_URL } from './constants.js';
import { formatHrDuration } from './hrDuration.js';

interface MopupWindow {
  startTime: number;
  endTime: number;
}

const MOPUP_EMBED_TITLE = 'Mopup';

function calculateMopupTiming(): MopupInfo {
  const now = Date.now();
  const utcOffset = new Date().getTimezoneOffset() * 60 * 1000;
  const hoursFromEpoch = Math.ceil((now + utcOffset) / (60 * 60 * 1000)) - 8;
  const daysSinceEpoch = Math.floor(hoursFromEpoch / 24);

  const { startTime, endTime } = getMopupWindow(daysSinceEpoch);
  const currentTime = Math.floor(now / 1000) * 1000;

  return determineMopupStatus(startTime - currentTime, endTime - currentTime, currentTime);
}

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

function determineMopupStatus(
  deltaStart: number,
  deltaEnd: number,
  currentTime: number,
): MopupInfo {
  if (deltaStart < 0) {
    if (deltaEnd > 0) {
      return {
        status: 'ACTIVE',
        color: Colors.Green,
        time: formatTime(deltaEnd),
        timestamp: Math.floor((currentTime + deltaEnd) / 1000),
      };
    }
    const nextStartDelta = deltaEnd + 24 * 60 * 60 * 1000;
    return {
      status: 'INACTIVE',
      color: Colors.Red,
      time: formatTime(nextStartDelta),
      timestamp: Math.floor((currentTime + nextStartDelta) / 1000),
    };
  }
  return {
    status: 'INACTIVE',
    color: Colors.Red,
    time: formatTime(deltaStart),
    timestamp: Math.floor((currentTime + deltaStart) / 1000),
  };
}

function formatTime(ms: number): string {
  return new Date(Math.abs(ms)).toISOString().slice(11, 19);
}

function buildMopupEmbed(startHr: bigint): EmbedBuilder {
  const { status, color, time, timestamp } = calculateMopupTiming();
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(MOPUP_EMBED_TITLE)
    .addFields(
      { name: 'Status:', value: `\`\`\`asciidoc\n${status}\`\`\`` },
      { name: 'Time remaining:', value: `\`\`\`asciidoc\n${time}\`\`\`` },
      { name: 'Local time:', value: `<t:${timestamp}:f>` },
    )
    .setFooter({ text: `via tc-bot - ${formatHrDuration(startHr)}`, iconURL: BOT_ICON_URL });
}

export {
  MOPUP_EMBED_TITLE,
  calculateMopupTiming,
  getMopupWindow,
  determineMopupStatus,
  formatTime,
  buildMopupEmbed,
};
