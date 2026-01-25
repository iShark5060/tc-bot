/** Bot icon URL used in embed footers */
export const BOT_ICON_URL =
  'https://cdn.discordapp.com/app-icons/432354130728845332/eb261c805943129dc645c078b4d71ef4.png';

/** Gear upgrade levels for stat calculations */
export const GEARCHECK_LEVELS = [0, 10, 13, 20, 30, 40, 50];

/** Stat multipliers corresponding to each gear level */
export const GEARCHECK_MULTIPLIERS = [1, 2, 2.3, 3, 4, 5, 6];

/** Maximum number of top commands to show in metrics */
export const METRICS_TOP_LIMIT = 10;

/** Limits for truncating large data sets in embeds and select menus */
export const TRUNCATION_LIMITS = {
  /** Maximum rows to display in embed fields */
  MAX_ROWS: 10,
  /** Maximum options in a select menu (Discord limit is 25) */
  MAX_SELECT_OPTIONS: 25,
} as const;

/** Column names for different cost categories in Google Sheets */
export const COST_TYPES = {
  /** Standard resource costs */
  RESOURCES: ['foodCost', 'partsCost', 'eleCost', 'gasCost', 'cashCost'],
  /** Special item costs */
  SPECIAL: ['smCost', 'ucCost', 'hcCost', 'scCost'],
  /** Other stats (MC heal, power, points) */
  OTHER: ['mchealCost', 'arkHP', 'powerLost', 'kePoints', 'hePoints'],
};

/** Unit thresholds and their corresponding healing cost modifiers (descending order) */
export const MODIFIER_THRESHOLDS = [
  { units: 3501, modifier: 0.25 },
  { units: 1501, modifier: 0.22 },
  { units: 901, modifier: 0.19 },
  { units: 501, modifier: 0.17 },
  { units: 201, modifier: 0.15 },
  { units: 0, modifier: 0.1 },
] as const;

/** Display labels for cost types in embed formatting */
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

/** Input validation limits for commands */
export const VALIDATION = {
  /** Maximum gear upgrade level */
  MAX_GEAR_LEVEL: 100,
  /** Maximum troop tier */
  MAX_TIER: 12,
  /** Minimum troop tier */
  MIN_TIER: 1,
  /** Maximum ITS skill level */
  MAX_SKILL_LEVEL: 60,
  /** Damage coefficient for ITS calculations */
  ITS_DAMAGE_COEFFICIENT: 0.005,
} as const;

/** Timer intervals for background tasks */
export const TIMERS = {
  /** Mopup channel update interval (5 minutes) */
  MOPUP_INTERVAL_MS: 5 * 60 * 1000,
  /** SQLite WAL checkpoint interval (5 minutes) */
  WAL_CHECKPOINT_INTERVAL_MS: 5 * 60 * 1000,
  /** Discord latency monitoring interval (30 seconds) */
  LATENCY_MONITOR_INTERVAL_MS: 30 * 1000,
} as const;

/** Channel name where message commands are processed */
export const MESSAGE_COMMAND_CHANNEL = process.env.MESSAGE_COMMAND_CHANNEL || 'tc-autobot';
