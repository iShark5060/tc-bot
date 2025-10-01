function calculateMopupTiming() {
  const now = Date.now();
  const utcOffset = new Date().getTimezoneOffset() * 60 * 1000;
  const hoursFromEpoch = Math.ceil((now + utcOffset) / (60 * 60 * 1000)) - 8;
  const daysSinceEpoch = Math.floor(hoursFromEpoch / 24);

  const { startTime, endTime } = getMopupWindow(daysSinceEpoch);
  const currentTime = Math.floor(now / 1000) * 1000;

  return determineMopupStatus(
    startTime - currentTime,
    endTime - currentTime
  );
}

function getMopupWindow(day) {
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

function determineMopupStatus(deltaStart, deltaEnd, day) {
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

function formatTime(ms) {
  return new Date(Math.abs(ms)).toISOString().slice(11, 19);
}

module.exports = { calculateMopupTiming };