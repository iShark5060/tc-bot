import type { sheets_v4 } from '@googleapis/sheets';
import type { ChatInputCommandInteraction, Client, Collection, SlashCommandBuilder, SlashCommandOptionsOnlyBuilder, StringSelectMenuInteraction } from 'discord.js';

/**
 * Union type for different slash command builder configurations.
 * Supports full builders, options-only builders, and builders without subcommands.
 */
type CommandData =
  | SlashCommandBuilder
  | SlashCommandOptionsOnlyBuilder
  | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;

/**
 * Defines the structure of a Discord slash command.
 * Commands must have data (slash command definition) and an execute function.
 */
export interface Command {
  /** Slash command builder configuration */
  data: CommandData;
  /** Example usage strings shown in help command */
  examples?: string[];
  /** Main command execution handler */
  execute(interaction: ChatInputCommandInteraction): Promise<void> | Promise<unknown>;
  /** Optional handler for string select menu interactions */
  handleSelect?(interaction: StringSelectMenuInteraction): Promise<void> | Promise<unknown>;
}

/**
 * Defines the structure of a Discord.js event handler.
 */
export interface Event {
  /** Discord.js event name (e.g., Events.ClientReady) */
  name: string;
  /** If true, event fires only once; otherwise fires on every occurrence */
  once?: boolean;
  /** Event handler function */
  execute(...args: unknown[]): Promise<void> | void;
}

/**
 * Mopup event timing and status information.
 * Used for displaying mopup countdown in Discord channels.
 */
export interface MopupInfo {
  /** Current mopup status ('ACTIVE' or 'INACTIVE') */
  status: string;
  /** Embed color code based on status */
  color: number;
  /** Formatted time remaining string */
  time: string;
  /** Unix timestamp of next mopup event */
  timestamp: number;
}

/**
 * Result of ITS (Ignore Tier Suppression) kill calculation.
 */
export interface KillResult {
  /** Number of troops that can be killed */
  count: number;
  /** Troop name */
  name: string;
  /** Troop tier */
  tier: number;
  /** Abbreviated troop type (INF/WLK/AIR) */
  type: string;
}

/**
 * Gear stat calculations at different upgrade levels.
 * Maps upgrade level to calculated stat string.
 */
export interface GearCalculations {
  [level: number]: string;
}

/**
 * Complete healing cost breakdown for troops.
 * Includes resource costs, special item costs, and optimization data.
 */
export interface HealingCosts {
  /** Standard resource costs (food, parts, ele, gas, cash) */
  resources: Record<string, { current: number; optimal: number }>;
  /** Special item costs (SM, UC, HC, SC) */
  special: Record<string, { current: number; optimal: number }>;
  /** Other stats (MC heal, power lost, etc.) */
  other: Record<string, number>;
  /** Total unit count being healed */
  totalUnits: number;
  /** Current healing cost modifier based on unit count */
  modifier: number;
  /** Optimal modifier info for cost reduction tips */
  optimal: { modifier: number; units: number };
  /** Optimal quantity per heal batch */
  optQty: number;
  /** Whether any cost data was found */
  hasData: boolean;
}

/**
 * Wrapper class for Google Sheets row data that provides column-based access.
 * Maps column headers to row values for easy data retrieval.
 */
export class TroopRow {
  private data: Map<string, unknown>;

  constructor(headers: string[], values: unknown[]) {
    this.data = new Map();
    headers.forEach((header, index) => {
      this.data.set(header, values[index] ?? '');
    });
  }

  get(key: string): unknown {
    return this.data.get(key);
  }
}

/**
 * Cache entry for Google Sheets data.
 * Supports concurrent request deduplication via loadingPromise.
 */
export interface CacheEntry {
  /** Cached row data */
  rows?: TroopRow[];
  /** Cache expiration timestamp */
  expiresAt?: number;
  /** Promise for in-flight fetch (prevents duplicate requests) */
  loadingPromise?: Promise<TroopRow[]>;
}

/**
 * Google Sheets API client wrapper.
 * Contains authenticated API instance and target spreadsheet ID.
 */
export interface GoogleSheetsClient {
  /** Authenticated Google Sheets v4 API instance */
  sheetsApi: sheets_v4.Sheets;
  /** Target spreadsheet ID */
  spreadsheetId: string;
}

/**
 * Extended Discord.js Client with bot-specific properties.
 * Adds command collection and Google Sheets client.
 */
export interface ExtendedClient extends Client {
  /** Collection of registered bot commands */
  commands: Collection<string, Command>;
  /** Google Sheets API client (null if not initialized) */
  GoogleSheets: GoogleSheetsClient | null;
}

/**
 * Command usage data for analytics tracking.
 */
export interface CommandUsage {
  /** Name of the executed command */
  commandName: string;
  /** Discord user ID who ran the command */
  userId?: string;
  /** Discord guild/server ID where command was run */
  guildId?: string | null;
  /** Whether command executed successfully */
  success: boolean;
  /** Error message if command failed */
  errorMessage?: string;
}

/**
 * Parameters for sending Discord webhook notifications.
 */
export interface DiscordNotificationParams {
  /** Notification type (startup, shutdown, error) */
  type: 'startup' | 'shutdown' | 'error' | string;
  /** Optional custom message */
  message?: string;
  /** Error details if type is 'error' */
  error?: Error | string;
  /** Whether to mention users */
  mention?: boolean;
}

/**
 * Aggregated command usage totals from database.
 */
export interface MetricsTotals {
  /** Total command executions */
  total_count: number;
  /** Successful command executions */
  success_count: number;
  /** Failed command executions */
  failure_count: number;
}

/**
 * Top command usage entry for metrics display.
 */
export interface MetricsTopCommand {
  /** Command name */
  command_name: string;
  /** Usage count */
  cnt: number;
}