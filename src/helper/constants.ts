export const BOT_ICON_URL =
  'https://cdn.discordapp.com/app-icons/432354130728845332/eb261c805943129dc645c078b4d71ef4.png';

export const GEARCHECK_LEVELS = [0, 10, 13, 20, 30, 40, 50];
export const GEARCHECK_MULTIPLIERS = [1, 2, 2.3, 3, 4, 5, 6];

export const METRICS_TOP_LIMIT = 10;

export const TRUNCATION_LIMITS = {
  MAX_ROWS: 10,
  MAX_SELECT_OPTIONS: 25,
} as const;

export const COST_TYPES = {
  RESOURCES: ['foodCost', 'partsCost', 'eleCost', 'gasCost', 'cashCost'],
  SPECIAL: ['smCost', 'ucCost', 'hcCost', 'scCost'],
  OTHER: ['mchealCost', 'arkHP', 'powerLost', 'kePoints', 'hePoints'],
};

export const MODIFIER_THRESHOLDS = [
  { units: 3501, modifier: 0.25 },
  { units: 1501, modifier: 0.22 },
  { units: 901, modifier: 0.19 },
  { units: 501, modifier: 0.17 },
  { units: 201, modifier: 0.15 },
  { units: 0, modifier: 0.1 },
] as const;

export const COST_LABELS: Record<string, string> = {
  foodCost: 'Food::',
  partsCost: 'Parts::',
  eleCost: 'Ele::',
  gasCost: 'Gas::',
  cashCost: 'Cash::',
  smCost: 'SM::',
  ucCost: 'UC::',
  hcCost: 'HC::',
  scCost: 'SC::',
  mchealCost: 'MC Heal::',
  arkHP: 'Massacre Dmg::',
  powerLost: 'Power::',
  kePoints: 'KE Points::',
  hePoints: 'Heal Points::',
};

export const VALIDATION = {
  MAX_GEAR_LEVEL: 100,
  MAX_TIER: 12,
  MIN_TIER: 1,
  MAX_SKILL_LEVEL: 60,
  ITS_DAMAGE_COEFFICIENT: 0.005,
} as const;

export const TIMERS = {
  MOPUP_INTERVAL_MS: 5 * 60 * 1000,
  WAL_CHECKPOINT_INTERVAL_MS: 5 * 60 * 1000,
  LATENCY_MONITOR_INTERVAL_MS: 30 * 1000,
} as const;

export const MESSAGE_COMMAND_CHANNEL = process.env.MESSAGE_COMMAND_CHANNEL || 'tc-autobot';
