import type {
  SlashCommandBuilder,
  StringSelectMenuInteraction,
  ChatInputCommandInteraction,
  CacheType as DiscordCacheType,
} from 'discord.js';
import type { GoogleSpreadsheet } from 'google-spreadsheet';

export interface Command {
  data: any; // SlashCommandBuilder type from Discord.js is complex to type properly
  examples?: string[];
  execute(interaction: any): Promise<void> | Promise<any>;
  handleSelect?(interaction: any): Promise<void> | Promise<any>;
}

export interface Event {
  name: string;
  once?: boolean;
  execute(...args: unknown[]): Promise<void> | void;
}

export interface MopupInfo {
  status: string;
  color: number;
  time: string;
}

export interface KillResult {
  count: number;
  name: string;
  tier: number;
  type: string;
}

export interface GearCalculations {
  [level: number]: string;
}

export interface HealingCosts {
  resources: Record<string, { current: number; optimal: number }>;
  special: Record<string, { current: number; optimal: number }>;
  other: Record<string, number>;
  totalUnits: number;
  modifier: number;
  optimal: { modifier: number; units: number };
  optQty: number;
  hasData: boolean;
}

export interface TroopRow {
  get(key: string): unknown;
}

export interface CacheEntry {
  rows?: TroopRow[];
  expiresAt?: number;
  loadingPromise?: Promise<TroopRow[]>;
}

export interface GoogleSheetClient {
  GoogleSheet: GoogleSpreadsheet;
}

export interface ExtendedClient extends GoogleSheetClient {
  commands: Map<string, Command>;
}

export interface CommandUsage {
  commandName: string;
  userId?: string;
  guildId?: string | null;
  success: boolean;
  errorMessage?: string;
}

export interface DiscordNotificationParams {
  type: 'startup' | 'shutdown' | 'error' | string;
  message?: string;
  error?: Error | string;
  mention?: boolean;
}
