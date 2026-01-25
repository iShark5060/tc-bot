import type { ChatInputCommandInteraction, Client, Collection, SlashCommandBuilder, SlashCommandOptionsOnlyBuilder, StringSelectMenuInteraction } from 'discord.js';
import type { GoogleSpreadsheet } from 'google-spreadsheet';

type CommandData =
  | SlashCommandBuilder
  | SlashCommandOptionsOnlyBuilder
  | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;

export interface Command {
  data: CommandData;
  examples?: string[];
  execute(interaction: ChatInputCommandInteraction): Promise<void> | Promise<unknown>;
  handleSelect?(interaction: StringSelectMenuInteraction): Promise<void> | Promise<unknown>;
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
  timestamp: number;
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
  GoogleSheet: GoogleSpreadsheet | null;
}

export interface ExtendedClient extends Client {
  commands: Collection<string, Command>;
  GoogleSheet: GoogleSpreadsheet | null;
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

export interface MetricsTotals {
  total_count: number;
  success_count: number;
  failure_count: number;
}

export interface MetricsTopCommand {
  command_name: string;
  cnt: number;
}