import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  Colors,
  type ChatInputCommandInteraction,
  type StringSelectMenuInteraction,
  type SlashCommandStringOption,
} from 'discord.js';

import {
  BOT_ICON_URL,
  TRUNCATION_LIMITS,
  TROOP_STAT_KEYS,
  VALIDATION,
} from '../../helper/constants.js';
import { numberWithCommas } from '../../helper/formatters.js';
import { formatHrDuration } from '../../helper/hrDuration.js';
import {
  INTERACTION_EXEC_LOCK_TTL_MS,
  safeDeferReply,
  safeInteractionReply,
} from '../../helper/safeDiscordResponse.js';
import { getSheetRowsCached } from '../../helper/sheetsCache.js';
import { TroopRow, type Command, type ExtendedClient } from '../../types/index.js';

type SelectStep = 'atk' | 'def';

export interface DamageInput {
  troopsAmount: number;
  baseAtk: number;
  bonusAtk: number;
  critDmg: number;
  critWither: number;
  crit: boolean;
  baseDef: number;
  bonusDef: number;
  pen: number;
  ignoreDef: number;
  absDef: number;
  damageModPercent: number;
}

export interface DamageResult {
  damage: number;
  effectiveAtk: number;
  atkSquared: number;
  critMultiplier: number;
  effectiveDef: number;
  damageMultiplier: number;
  baseAtk: number;
  baseDef: number;
}

interface PendingDamageCalc {
  userId: string;
  expiresAt: number;
  amount: number;
  atkTier: number;
  atkType: string;
  defTier: number;
  defType: string;
  bonusAtk: number;
  bonusDef: number;
  critDmg: number;
  critWither: number;
  pen: number;
  ignoreDef: number;
  absDef: number;
  damageModPercent: number;
  crit: boolean;
  attackerName?: string;
  defenderName?: string;
}

interface DamageView {
  amount: number;
  attackerName: string;
  attackerTier: number;
  attackerType: string;
  defenderName: string;
  defenderTier: number;
  defenderType: string;
  input: DamageInput;
  result: DamageResult;
  defenderHp: number | null;
}

interface SheetLoadOk {
  ok: true;
  rows: TroopRow[];
}

interface SheetLoadErr {
  ok: false;
  message: string;
}

const pendingCalcs = new Map<string, PendingDamageCalc>();

const damage: Command = {
  data: new SlashCommandBuilder()
    .setName('damage')
    .setDescription('Calculate troop damage against a defender')
    .addIntegerOption((option) =>
      option
        .setName('amount')
        .setDescription('Number of attacking troops')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(VALIDATION.MAX_TROOP_AMOUNT),
    )
    .addIntegerOption((option) =>
      option
        .setName('atk_tier')
        .setDescription('Attacker troop tier')
        .setRequired(true)
        .setMinValue(VALIDATION.MIN_TIER)
        .setMaxValue(VALIDATION.MAX_TIER),
    )
    .addStringOption((option) => troopTypeOption(option, 'atk_type', 'Attacker troop type'))
    .addIntegerOption((option) =>
      option
        .setName('def_tier')
        .setDescription('Defender troop tier')
        .setRequired(true)
        .setMinValue(VALIDATION.MIN_TIER)
        .setMaxValue(VALIDATION.MAX_TIER),
    )
    .addStringOption((option) => troopTypeOption(option, 'def_type', 'Defender troop type'))
    .addNumberOption((option) =>
      option
        .setName('bonus_atk')
        .setDescription('Attacker bonus ATK % (gear, research, hull, faction, guild tech)')
        .setMinValue(-VALIDATION.MAX_PERCENT_STAT)
        .setMaxValue(VALIDATION.MAX_PERCENT_STAT),
    )
    .addNumberOption((option) =>
      option
        .setName('bonus_def')
        .setDescription('Defender bonus DEF % (gear, research, hull, faction, guild tech)')
        .setMinValue(-VALIDATION.MAX_PERCENT_STAT)
        .setMaxValue(VALIDATION.MAX_PERCENT_STAT),
    )
    .addNumberOption((option) =>
      option
        .setName('crit_dmg')
        .setDescription('Attacker extra crit damage % (on top of the 200% crit base)')
        .setMinValue(0)
        .setMaxValue(VALIDATION.MAX_PERCENT_STAT),
    )
    .addNumberOption((option) =>
      option
        .setName('crit_wither')
        .setDescription('Defender crit wither % (reduces incoming crit damage)')
        .setMinValue(0)
        .setMaxValue(VALIDATION.MAX_PERCENT_STAT),
    )
    .addNumberOption((option) =>
      option
        .setName('pen')
        .setDescription('Attacker penetration % (reduces defender bonus DEF)')
        .setMinValue(0)
        .setMaxValue(100),
    )
    .addNumberOption((option) =>
      option
        .setName('ignore_def')
        .setDescription('Ignore DEF % from skills (Breakdown, Nonviolent Resistance, ...)')
        .setMinValue(0)
        .setMaxValue(100),
    )
    .addNumberOption((option) =>
      option
        .setName('abs_def')
        .setDescription('Defender absolute DEF (flat, from passives)')
        .setMinValue(0)
        .setMaxValue(VALIDATION.MAX_ABS_DEF),
    )
    .addNumberOption((option) =>
      option
        .setName('damage_mod')
        .setDescription('Extra damage % (breakdown, SWE, tier suppression). 20 = +20%')
        .setMinValue(-100)
        .setMaxValue(VALIDATION.MAX_PERCENT_STAT),
    )
    .addBooleanOption((option) =>
      option.setName('crit').setDescription('Assume the hit crits (default: yes)'),
    ),
  examples: [
    '/damage amount:100 atk_tier:12 atk_type:Infantry def_tier:12 def_type:Walker',
    '/damage amount:50 atk_tier:12 atk_type:Airship def_tier:11 def_type:Infantry bonus_atk:80 crit_dmg:150 pen:20',
  ],

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const startHr = process.hrtime.bigint();
    const parsed = parseDamageOptions(interaction);
    if (!parsed.ok) {
      await safeInteractionReply(interaction, {
        content: parsed.message,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await safeDeferReply(interaction);

    const loaded = await loadSheetRows(interaction.client as ExtendedClient);
    if (!loaded.ok) {
      await interaction.editReply({ content: loaded.message });
      return;
    }

    const pending: PendingDamageCalc = {
      ...parsed.pending,
      userId: interaction.user.id,
      expiresAt: Date.now() + INTERACTION_EXEC_LOCK_TTL_MS,
    };

    const outcome = resolveDamageOutcome(loaded.rows, pending);
    if (outcome.kind === 'error') {
      await interaction.editReply({ content: outcome.message });
      return;
    }

    if (outcome.kind === 'result') {
      await interaction.editReply({
        embeds: [createDamageEmbed(outcome.view, startHr)],
        components: [],
      });
      return;
    }

    putPending(interaction.id, outcome.pending);
    await interaction.editReply(buildSelectReply(interaction.id, outcome));
  },

  async handleSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    const startHr = process.hrtime.bigint();
    try {
      const parsedId = parseDamageCustomId(interaction.customId);
      if (!parsedId) {
        await interaction.update({ content: 'Invalid selection.', components: [] });
        return;
      }

      const pending = getPending(parsedId.pendingId);
      if (!pending) {
        await interaction.update({
          content: 'This damage calculation expired. Run /damage again.',
          components: [],
        });
        return;
      }

      if (interaction.user.id !== pending.userId) {
        await safeInteractionReply(interaction, {
          content: 'Only the user who ran the command can make this selection.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const selectedName = interaction.values?.[0];
      if (!selectedName) {
        await interaction.update({ content: 'Invalid selection.', components: [] });
        return;
      }

      if (parsedId.step === 'atk') {
        pending.attackerName = selectedName;
      } else {
        pending.defenderName = selectedName;
      }

      const loaded = await loadSheetRows(interaction.client as ExtendedClient);
      if (!loaded.ok) {
        deletePending(parsedId.pendingId);
        await interaction.update({ content: loaded.message, components: [] });
        return;
      }

      const outcome = resolveDamageOutcome(loaded.rows, pending);
      if (outcome.kind === 'error') {
        deletePending(parsedId.pendingId);
        await interaction.update({ content: outcome.message, components: [] });
        return;
      }

      if (outcome.kind === 'result') {
        deletePending(parsedId.pendingId);
        await interaction.update({
          content: '',
          embeds: [createDamageEmbed(outcome.view, startHr)],
          components: [],
        });
        return;
      }

      putPending(parsedId.pendingId, outcome.pending);
      await interaction.update(buildSelectReply(parsedId.pendingId, outcome));
    } catch (err) {
      console.error('[EVENT:DAMAGE] handleSelect failed:', err);
      try {
        await interaction.update({
          content: 'Failed to render selection.',
          components: [],
        });
      } catch (secondaryErr) {
        console.warn('[EVENT:DAMAGE] Secondary update failed:', secondaryErr);
      }
    }
  },
};

function troopTypeOption(
  option: SlashCommandStringOption,
  name: string,
  description: string,
): SlashCommandStringOption {
  return option
    .setName(name)
    .setDescription(description)
    .addChoices(
      { name: 'Infantry', value: 'Infantry' },
      { name: 'Walker', value: 'Walker' },
      { name: 'Airship', value: 'Airship' },
    )
    .setRequired(true);
}

function parseDamageOptions(
  interaction: ChatInputCommandInteraction,
):
  | { ok: true; pending: Omit<PendingDamageCalc, 'userId' | 'expiresAt'> }
  | { ok: false; message: string } {
  const amount = interaction.options.getInteger('amount');
  const atkTier = interaction.options.getInteger('atk_tier');
  const atkType = interaction.options.getString('atk_type');
  const defTier = interaction.options.getInteger('def_tier');
  const defType = interaction.options.getString('def_type');

  if (amount === null || atkTier === null || defTier === null || !atkType || !defType) {
    return { ok: false, message: 'Missing required parameters' };
  }

  if (atkTier < VALIDATION.MIN_TIER || atkTier > VALIDATION.MAX_TIER) {
    return {
      ok: false,
      message: `Attacker tier must be between ${VALIDATION.MIN_TIER} and ${VALIDATION.MAX_TIER}.`,
    };
  }

  if (defTier < VALIDATION.MIN_TIER || defTier > VALIDATION.MAX_TIER) {
    return {
      ok: false,
      message: `Defender tier must be between ${VALIDATION.MIN_TIER} and ${VALIDATION.MAX_TIER}.`,
    };
  }

  return {
    ok: true,
    pending: {
      amount,
      atkTier,
      atkType,
      defTier,
      defType,
      bonusAtk: interaction.options.getNumber('bonus_atk') ?? 0,
      bonusDef: interaction.options.getNumber('bonus_def') ?? 0,
      critDmg: interaction.options.getNumber('crit_dmg') ?? 0,
      critWither: interaction.options.getNumber('crit_wither') ?? 0,
      pen: interaction.options.getNumber('pen') ?? 0,
      ignoreDef: interaction.options.getNumber('ignore_def') ?? 0,
      absDef: interaction.options.getNumber('abs_def') ?? 0,
      damageModPercent: interaction.options.getNumber('damage_mod') ?? 0,
      crit: interaction.options.getBoolean('crit') ?? true,
    },
  };
}

async function loadSheetRows(client: ExtendedClient): Promise<SheetLoadOk | SheetLoadErr> {
  const googleSheets = client.GoogleSheets;
  if (!googleSheets) {
    return { ok: false, message: 'Google Sheets is not available.' };
  }

  const sheetId = process.env.GOOGLE_SHEET_ID?.trim();
  if (!sheetId) {
    console.error('[DAMAGE] Missing GOOGLE_SHEET_ID: cannot call getSheetRowsCached.');
    return { ok: false, message: 'Google Sheet is not configured (missing GOOGLE_SHEET_ID).' };
  }

  const rows = await getSheetRowsCached(googleSheets, sheetId);
  return { ok: true, rows };
}

type DamageOutcome =
  | { kind: 'error'; message: string }
  | {
      kind: 'select';
      pending: PendingDamageCalc;
      step: SelectStep;
      names: string[];
      truncated: boolean;
    }
  | { kind: 'result'; view: DamageView };

function resolveDamageOutcome(rows: TroopRow[], pending: PendingDamageCalc): DamageOutcome {
  const atkAll = findTroopRows(rows, pending.atkTier, pending.atkType);
  const defAll = findTroopRows(rows, pending.defTier, pending.defType);
  const atkByName = buildValidByNameMap(atkAll, TROOP_STAT_KEYS.ATK);
  const defByName = buildValidByNameMap(defAll, TROOP_STAT_KEYS.DEF);

  if (atkAll.length === 0) {
    return {
      kind: 'error',
      message: `Troop data not found for attacker T${pending.atkTier} ${pending.atkType}.`,
    };
  }
  if (atkByName.size === 0) {
    return {
      kind: 'error',
      message:
        'Attacker troops are missing base attack in the spreadsheet. Add a troopAtk column (aliases: baseATK, ATK).',
    };
  }
  if (defAll.length === 0) {
    return {
      kind: 'error',
      message: `Troop data not found for defender T${pending.defTier} ${pending.defType}.`,
    };
  }
  if (defByName.size === 0) {
    return {
      kind: 'error',
      message:
        'Defender troops are missing base defense in the spreadsheet. Add a troopDef column (aliases: baseDEF, DEF).',
    };
  }

  if (!pending.attackerName && atkByName.size === 1) {
    const [singleName] = Array.from(atkByName.keys());
    pending.attackerName = singleName;
  }
  if (!pending.defenderName && defByName.size === 1) {
    const [singleName] = Array.from(defByName.keys());
    pending.defenderName = singleName;
  }

  if (!pending.attackerName) {
    return {
      kind: 'select',
      pending,
      step: 'atk',
      names: sortedNames(atkByName),
      truncated: atkByName.size > TRUNCATION_LIMITS.MAX_SELECT_OPTIONS,
    };
  }

  if (!atkByName.has(pending.attackerName)) {
    return { kind: 'error', message: 'No attacker rows found for that troop name anymore.' };
  }

  if (!pending.defenderName) {
    return {
      kind: 'select',
      pending,
      step: 'def',
      names: sortedNames(defByName),
      truncated: defByName.size > TRUNCATION_LIMITS.MAX_SELECT_OPTIONS,
    };
  }

  if (!defByName.has(pending.defenderName)) {
    return { kind: 'error', message: 'No defender rows found for that troop name anymore.' };
  }

  const attackerRow = atkByName.get(pending.attackerName);
  const defenderRow = defByName.get(pending.defenderName);
  if (!attackerRow || !defenderRow) {
    return { kind: 'error', message: 'Troop data not found for that selection.' };
  }

  const baseAtk = getTroopStat(attackerRow, TROOP_STAT_KEYS.ATK);
  const baseDef = getTroopStat(defenderRow, TROOP_STAT_KEYS.DEF);
  if (baseAtk === null || baseDef === null) {
    return { kind: 'error', message: 'Selected troops are missing attack or defense stats.' };
  }

  const input: DamageInput = {
    troopsAmount: pending.amount,
    baseAtk,
    bonusAtk: pending.bonusAtk,
    critDmg: pending.critDmg,
    critWither: pending.critWither,
    crit: pending.crit,
    baseDef,
    bonusDef: pending.bonusDef,
    pen: pending.pen,
    ignoreDef: pending.ignoreDef,
    absDef: pending.absDef,
    damageModPercent: pending.damageModPercent,
  };

  const result = calculateDamage(input);
  if (!result) {
    return { kind: 'error', message: 'Could not calculate damage with those values.' };
  }

  return {
    kind: 'result',
    view: {
      amount: pending.amount,
      attackerName: pending.attackerName,
      attackerTier: pending.atkTier,
      attackerType: pending.atkType,
      defenderName: pending.defenderName,
      defenderTier: pending.defTier,
      defenderType: pending.defType,
      input,
      result,
      defenderHp: getTroopStat(defenderRow, TROOP_STAT_KEYS.HP),
    },
  };
}

function buildSelectReply(
  pendingId: string,
  outcome: Extract<DamageOutcome, { kind: 'select' }>,
): {
  content?: string;
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<StringSelectMenuBuilder>[];
} {
  const isAttacker = outcome.step === 'atk';
  const title = isAttacker ? 'Damage — choose attacker' : 'Damage — choose defender';
  const placeholder = isAttacker ? 'Pick the attacking troop…' : 'Pick the defending troop…';
  const sideLabel = isAttacker
    ? `T${outcome.pending.atkTier} ${outcome.pending.atkType}`
    : `T${outcome.pending.defTier} ${outcome.pending.defType}`;

  const embed = new EmbedBuilder()
    .setColor(Colors.White)
    .setTitle(title)
    .setDescription(
      `Found ${outcome.names.length} troop variants for ${sideLabel}. Choose one to continue.`,
    )
    .addFields({
      name: 'Selection',
      value:
        '```asciidoc\n' +
        `${numberWithCommas(outcome.pending.amount)}x attacker ` +
        `(T${outcome.pending.atkTier} ${outcome.pending.atkType})\n` +
        `vs T${outcome.pending.defTier} ${outcome.pending.defType}\n` +
        '```',
    });

  const options = outcome.names.slice(0, TRUNCATION_LIMITS.MAX_SELECT_OPTIONS).map((name) => ({
    label: name.slice(0, 100),
    value: name.slice(0, 100),
  }));

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`damage:${pendingId}:${outcome.step}`)
      .setPlaceholder(placeholder)
      .addOptions(options)
      .setMinValues(1)
      .setMaxValues(1),
  );

  const content = outcome.truncated
    ? `Showing first ${TRUNCATION_LIMITS.MAX_SELECT_OPTIONS} of ${outcome.names.length} troops.`
    : undefined;

  return { content, embeds: [embed], components: [row] };
}

function createDamageEmbed(view: DamageView, startHr: bigint): EmbedBuilder {
  const { result, input } = view;
  const critLabel = input.crit ? 'crit' : 'non-crit';
  const extraCrit = Math.max(0, input.critDmg - input.critWither);
  const killsLine =
    view.defenderHp !== null && view.defenderHp > 0
      ? `\nKills:: ${numberWithCommas(Math.floor(result.damage / view.defenderHp))}` +
        `  (${formatAmount(view.defenderHp)} HP each)`
      : '';

  const selection =
    '```asciidoc\n' +
    `${numberWithCommas(view.amount)}x ${view.attackerName} ` +
    `(T${view.attackerTier} ${view.attackerType})\n` +
    `vs ${view.defenderName} ` +
    `(T${view.defenderTier} ${view.defenderType})\n` +
    '```';

  const resultBlock =
    '```asciidoc\n' +
    `Damage (${critLabel}):: ${formatAmount(result.damage)}` +
    `${killsLine}\n` +
    '```';

  const breakdown =
    '```asciidoc\n' +
    `ATK::    ${formatAmount(result.baseAtk)} + ${formatAmount(input.bonusAtk, 1)}%` +
    ` = ${formatAmount(result.effectiveAtk)}  (² ${formatAmount(result.atkSquared)})\n` +
    `DEF::    ${formatAmount(result.baseDef)} + ${formatAmount(input.bonusDef, 1)}%` +
    ` bonus, ${formatAmount(input.pen, 1)}% PEN, ${formatAmount(input.ignoreDef, 1)}% ignore\n` +
    `         abs DEF ${formatAmount(input.absDef)} → effective ${formatAmount(result.effectiveDef)}\n` +
    `Crit::   ${input.crit ? `2 + ${formatAmount(extraCrit, 1)}% = ${formatAmount(result.critMultiplier, 2)}` : '1 (left out)'}\n` +
    `Mod::    ${formatSignedPercent(input.damageModPercent)} → x${formatAmount(result.damageMultiplier, 2)}\n` +
    `Troops:: ${numberWithCommas(input.troopsAmount)}\n` +
    '```';

  return new EmbedBuilder()
    .setColor(Colors.White)
    .setTitle('Damage')
    .addFields(
      { name: 'Selection:', value: selection },
      { name: 'Result:', value: resultBlock },
      { name: 'Breakdown:', value: breakdown },
    )
    .setFooter({
      text: `via tc-bot - ${formatHrDuration(startHr)}`,
      iconURL: BOT_ICON_URL,
    });
}

function formatAmount(value: number, digits = 2): string {
  const rounded = Number(value.toFixed(digits));
  if (Number.isInteger(rounded)) {
    return numberWithCommas(rounded);
  }
  return numberWithCommas(rounded.toFixed(digits));
}

function formatSignedPercent(value: number): string {
  const formatted = formatAmount(value, 1);
  if (value > 0) return `+${formatted}%`;
  return `${formatted}%`;
}

function sortedNames(byName: Map<string, TroopRow>): string[] {
  return Array.from(byName.keys()).sort((a, b) => a.localeCompare(b));
}

function parseDamageCustomId(customId: string): { pendingId: string; step: SelectStep } | null {
  const parts = customId.split(':');
  if (parts.length !== 3 || parts[0] !== 'damage') return null;
  if (parts[2] !== 'atk' && parts[2] !== 'def') return null;
  if (!parts[1]) return null;
  return { pendingId: parts[1], step: parts[2] };
}

function prunePending(now = Date.now()): void {
  for (const [id, entry] of pendingCalcs) {
    if (entry.expiresAt <= now) {
      pendingCalcs.delete(id);
    }
  }
}

function putPending(id: string, data: PendingDamageCalc): void {
  prunePending();
  if (pendingCalcs.size >= VALIDATION.MAX_PENDING_DAMAGE && !pendingCalcs.has(id)) {
    const oldest = pendingCalcs.keys().next().value;
    if (oldest) pendingCalcs.delete(oldest);
  }
  pendingCalcs.set(id, data);
}

function getPending(id: string): PendingDamageCalc | undefined {
  prunePending();
  const entry = pendingCalcs.get(id);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    pendingCalcs.delete(id);
    return undefined;
  }
  return entry;
}

function deletePending(id: string): void {
  pendingCalcs.delete(id);
}

function findTroopRows(rows: TroopRow[], tier: number, type: string): TroopRow[] {
  return rows.filter(
    (row) =>
      String(row.get('troopTier')) === String(tier) &&
      row.get('troopType') === type &&
      row.get('isNPC') === 'N',
  );
}

function buildValidByNameMap(rows: TroopRow[], statKeys: readonly string[]): Map<string, TroopRow> {
  const byName = new Map<string, TroopRow>();
  for (const row of rows) {
    const name = String(row.get('troopName') || '').trim();
    if (!name) continue;
    if (getTroopStat(row, statKeys) === null) continue;
    if (!byName.has(name)) byName.set(name, row);
  }
  return byName;
}

function getTroopStat(row: TroopRow, keys: readonly string[]): number | null {
  for (const key of keys) {
    const parsed = parseSheetNumber(row.get(key));
    if (parsed !== null) return parsed;
  }
  return null;
}

function parseSheetNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const raw = String(value).replace(/,/g, '').trim();
  if (raw === '') return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function calculateDamage(input: DamageInput): DamageResult | null {
  const values = [
    input.troopsAmount,
    input.baseAtk,
    input.bonusAtk,
    input.critDmg,
    input.critWither,
    input.baseDef,
    input.bonusDef,
    input.pen,
    input.ignoreDef,
    input.absDef,
    input.damageModPercent,
  ];
  if (values.some((value) => !Number.isFinite(value))) return null;
  if (input.troopsAmount <= 0 || input.baseAtk < 0) return null;

  const baseDef = Math.max(1, input.baseDef);
  const pen = clamp(input.pen, 0, 100) / 100;
  const ignoreDef = clamp(input.ignoreDef, 0, 100) / 100;
  const damageMultiplier = Math.max(0, 1 + input.damageModPercent / 100);
  const effectiveAtk = input.baseAtk * (1 + input.bonusAtk / 100);
  const atkSquared = effectiveAtk * effectiveAtk;
  const critMultiplier = input.crit ? 2 + Math.max(0, input.critDmg - input.critWither) / 100 : 1;
  const defScale = 1 + (input.bonusDef / 100) * (1 - pen) * (1 - ignoreDef);
  const effectiveDef = Math.max(1, input.absDef + baseDef * defScale);

  const damage =
    (input.troopsAmount * damageMultiplier * atkSquared * critMultiplier) / effectiveDef;

  if (!Number.isFinite(damage)) return null;

  return {
    damage,
    effectiveAtk,
    atkSquared,
    critMultiplier,
    effectiveDef,
    damageMultiplier,
    baseAtk: input.baseAtk,
    baseDef,
  };
}

export default damage;
export {
  calculateDamage,
  parseSheetNumber,
  getTroopStat,
  findTroopRows,
  buildValidByNameMap,
  createDamageEmbed,
  resolveDamageOutcome,
};
