const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('healtroop')
		.setDescription('Calculate cost to heal troops')
		.addIntegerOption(option => option.setName('amount').setDescription('How many troops are injured').setRequired(true))
		.addIntegerOption(option => option.setName('tier').setDescription('Tier of the injured units').setRequired(true))
		.addStringOption(option => option.setName('type')
			.setDescription('Select the unit type')
			.addChoices(
				{ name: 'Infantry', value: 'Infantry' },
				{ name: 'Walker', value: 'Walker' },
				{ name: 'Airship', value: 'Airship' },
			)
			.setRequired(true)),
	async execute(interaction) {
		await interaction.deferReply();
		const troopAmount = interaction.options.getInteger('amount');
		const troopTier = interaction.options.getInteger('tier');
		const troopType = interaction.options.getString('type');

		// Quick function to space thousands with commata
		const numberWithCommas = (x) => {
			return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
		};
		if (troopTier > 12) {
			return interaction.reply({ content: 'We currently only have Tier 12 :)', flags: MessageFlags.Ephemeral });
		}

		// Reduce T12 spam:
		let unitBuffer = 0;
		const reply = new EmbedBuilder()
			.setColor(16777215)
			.setTitle('Healing cost:');

		// Loading sheet "REF_BotTroops" that has all needed data in it
		const sheet = interaction.client.GoogleSheet.sheetsById[891063687];
		const rows = await sheet.getRows();
		rows.some(rr => {
			if (rr.get('troopTier') == troopTier && rr.get('troopType') === troopType && rr.get('isNPC') === 'N') {
				// we've found (one of) the troops. yay.
				const totalUnits = troopAmount * rr.get('troopUnits');
				let modifier = 0;
				if (totalUnits >= 3501) modifier = 0.25;
				else if (totalUnits >= 1501) modifier = 0.22;
				else if (totalUnits >= 901) modifier = 0.19;
				else if (totalUnits >= 501) modifier = 0.17;
				else if (totalUnits >= 201) modifier = 0.15;
				else modifier = 0.10;

				// HealOptimizer(tm) Calculations
				let optModifier = 0;
				let optUnits = 0;
				if (rr.get('troopUnits') < 201) { optModifier = 0.10; optUnits = 200; }
				else if (rr.get('troopUnits') < 501) {optModifier = 0.15; optUnits = 500;}
				else if (rr.get('troopUnits') < 901) {optModifier = 0.17; optUnits = 900;}
				else if (rr.get('troopUnits') < 1501) {optModifier = 0.19; optUnits = 1500;}
				else if (rr.get('troopUnits') < 3501) {optModifier = 0.22; optUnits = 3500;}
				else {optModifier = 0.25; optUnits = -1;}

				// Prepare Data for the replies
				let fullCostText = '';
				let fullCostTextOther = '';
				let minCostText = '';
				let minCostTextWarn = '';
				let n;
				const optQty = Math.floor(optUnits / rr.get('troopUnits'));

				// Calculate Resource Healing cost
				if (rr.get('foodCost')) {
					n = Math.ceil(parseInt(rr.get('foodCost').replace(/,/g, '')) * troopAmount * modifier);
					fullCostText += '\nFood::  ' + numberWithCommas(n);
					n = Math.ceil(parseInt(rr.get('foodCost').replace(/,/g, '')) * troopAmount * optModifier);
					minCostText += '\nFood::  ' + numberWithCommas(n);
				}
				if (rr.get('partsCost')) {
					n = Math.ceil(parseInt(rr.get('partsCost').replace(/,/g, '')) * troopAmount * modifier);
					fullCostText += '\nParts:: ' + numberWithCommas(n);
					n = Math.ceil(parseInt(rr.get('partsCost').replace(/,/g, '')) * troopAmount * optModifier);
					minCostText += '\nParts:: ' + numberWithCommas(n);
				}
				if (rr.get('eleCost')) {
					n = Math.ceil(parseInt(rr.get('eleCost').replace(/,/g, '')) * troopAmount * modifier);
					fullCostText += '\nEle::   ' + numberWithCommas(n);
					n = Math.ceil(parseInt(rr.get('eleCost').replace(/,/g, '')) * troopAmount * optModifier);
					minCostText += '\nEle::   ' + numberWithCommas(n);
				}
				if (rr.get('gasCost')) {
					n = Math.ceil(parseInt(rr.get('gasCost').replace(/,/g, '')) * troopAmount * modifier);
					fullCostText += '\nGas::   ' + numberWithCommas(n);
					n = Math.ceil(parseInt(rr.get('gasCost').replace(/,/g, '')) * troopAmount * optModifier);
					minCostText += '\nGas::   ' + numberWithCommas(n);
				}
				if (rr.get('cashCost')) {
					n = Math.ceil(parseInt(rr.get('cashCost').replace(/,/g, '')) * troopAmount * modifier);
					fullCostText += '\nCash::  ' + numberWithCommas(n);
					n = Math.ceil(parseInt(rr.get('cashCost').replace(/,/g, '')) * troopAmount * optModifier);
					minCostText += '\nCash::  ' + numberWithCommas(n);
				}
				if (rr.get('smCost')) {
					n = Math.ceil(parseInt(rr.get('smCost').replace(/,/g, '')) * troopAmount * modifier);
					fullCostText += '\nSM::    ' + numberWithCommas(n);
					n = Math.ceil(parseInt(rr.get('smCost').replace(/,/g, '')) * optModifier);
					if (n < 1) n = 1;
					n = n * Math.ceil(troopAmount / optQty);
					minCostText += '\nSM::    ' + numberWithCommas(n);
				}
				if (rr.get('ucCost')) {
					n = Math.ceil(parseInt(rr.get('ucCost').replace(/,/g, '')) * troopAmount * modifier);
					fullCostText += '\nUC::    ' + numberWithCommas(n);
					n = Math.ceil(parseInt(rr.get('ucCost').replace(/,/g, '')) * optModifier);
					if (n < 1) n = 1;
					n = n * Math.ceil(troopAmount / optQty);
					minCostText += '\nUC::    ' + numberWithCommas(n);
				}
				if (rr.get('hcCost')) {
					n = Math.ceil(parseInt(rr.get('hcCost').replace(/,/g, '')) * troopAmount * modifier);
					fullCostText += '\nHC::    ' + numberWithCommas(n);
					n = Math.ceil(parseInt(rr.get('hcCost').replace(/,/g, '')) * optModifier);
					if (n < 1) n = 1;
					n = n * Math.ceil(troopAmount / optQty);
					minCostText += '\nHC::    ' + numberWithCommas(n);
				}

				// Calculate Meta Crystal Healing cost
				if (rr.get('mchealCost')) {
					n = Math.ceil(parseInt(rr.get('mchealCost').replace(/,/g, '')) * troopAmount);
					fullCostTextOther += '\nMC Heal::      ' + numberWithCommas(n);
				}

				// Calculate Hull Damage incurred from massacred troops
				if (rr.get('arkHP')) {
					n = Math.ceil(parseInt(rr.get('arkHP').replace(/,/g, '')) * troopAmount);
					fullCostTextOther += '\nMassacre Dmg:: ' + numberWithCommas(n);
				}

				// Calculate Power lost from injured troops
				if (rr.get('powerLost')) {
					n = Math.ceil(parseInt(rr.get('powerLost').replace(/,/g, '')) * troopAmount);
					fullCostTextOther += '\nPower::        ' + numberWithCommas(n);
				}

				// Calculate Kill Event Points from injured troops
				if (rr.get('kePoints')) {
					n = Math.ceil(parseInt(rr.get('kePoints').replace(/,/g, '')) * troopAmount);
					fullCostTextOther += '\nKE Points::    ' + numberWithCommas(n);
				}

				// Calculate Heal Event Points from injured troops
				if (rr.get('hePoints')) {
					n = Math.ceil(parseInt(rr.get('hePoints').replace(/,/g, '')) * troopAmount);
					fullCostTextOther += '\nHeal Points::  ' + numberWithCommas(n);
				}

				// Construct Reply with reduced T12 spam
				if (rr.get('troopTier') == 12) {
					if (unitBuffer != rr.get('troopUnits')) {
						unitBuffer = rr.get('troopUnits');
						reply.addFields([
							{ name: 'Healing:', value: `\`\`\`asciidoc\n${numberWithCommas(troopAmount)}x ${rr.get('troopName')} (T${rr.get('troopTier')} ${rr.get('troopType')})\`\`\`` },
							{ name: 'Total Units:', value: `\`\`\`asciidoc\n${numberWithCommas(totalUnits)} @ ${modifier * 100}% of training costs.\n${fullCostText}\`\`\`` },
							{ name: 'Other Stats:', value: `\`\`\`asciidoc\n${fullCostTextOther}\`\`\`` },
						]);
						if (optModifier < modifier) {
							let tipText = `${optQty}x troop`;
							if (optQty > 1) tipText += 's';
							tipText += ` at a time to heal at ${optModifier * 100}% of training costs:`;
							if (rr.get('hcCost') > 0 || rr.get('ucCost') > 0 || rr.get('smCost') > 0) {
								minCostTextWarn = 'Save rss but may cost more sm/uc/hc';
							}
							reply.addFields([
								{ name: 'TIP:', value: `\`\`\`asciidoc\nHeal ${tipText}\n${minCostTextWarn}\n--${minCostText}\`\`\`` },
							]);
						}
					}
				}
				else {
					reply.addFields([
						{ name: `Healing ${numberWithCommas(troopAmount)}x ${rr.get('troopName')} (T${rr.get('troopTier')} ${rr.get('troopType')}):`, value: '|' },
						{ name: `Total Units: ${numberWithCommas(totalUnits)} @ ${modifier * 100}% of training costs:`, value: `\`\`\`asciidoc\n${fullCostText}\`\`\`` },
						{ name: 'Other Stats:', value: `\`\`\`asciidoc\n${fullCostTextOther}\`\`\`` },
					]);
					if (optModifier < modifier) {
						let tipText = `${optQty}x troop`;
						if (optQty > 1) tipText += 's';
						tipText += ` at a time to heal at ${optModifier * 100}% of training costs:`;
						if (rr.get('hcCost') > 0 || rr.get('ucCost') > 0 || rr.get('smCost') > 0) {
							minCostTextWarn = 'Save rss but may cost more sm/uc/hc';
						}
						reply.addFields([
							{ name: 'TIP:', value: `\`\`\`asciidoc\nHeal ${tipText}\n${minCostTextWarn}\n--${minCostText}\`\`\`` },
						]);
					}
				}
				unitBuffer = rr.get('troopUnits');
			}
		});
		await interaction.editReply({ embeds: [reply] });
	},
};