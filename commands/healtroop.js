const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

example: '100 9 air',

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
		const troopAmount = interaction.options.getInteger('amount');
		const troopTier = interaction.options.getInteger('tier');
		const troopType = interaction.options.getString('type');

		// Quick function to space thousands with commata
		const numberWithCommas = (x) => {
			return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
		};
		if (troopTier > 12) {
			return interaction.reply({ content: 'We currently only have Tier 12 :)', ephemeral: true });
		}

		// Reduce T12 spam:
		let unitBuffer = 0;
		let replySent = false;
		let reply = new EmbedBuilder().setColor(16777215);

		// Loading sheet "REF_BotTroops" that has all needed data in it
		const sheet = interaction.client.GoogleSheet.sheetsById[891063687];
		const rows = await sheet.getRows();
		rows.some(rr => {
			if (rr.troopTier == troopTier && rr.troopType === troopType && rr.isNPC === 'N') {
				// we've found (one of) the troops. yay.
				const totalUnits = troopAmount * rr.troopUnits;
				let modifier = 0;
				if(totalUnits >= 3501) modifier = 0.25;
				else if(totalUnits >= 1501) modifier = 0.22;
				else if(totalUnits >= 901) modifier = 0.19;
				else if(totalUnits >= 501) modifier = 0.17;
				else if(totalUnits >= 201) modifier = 0.15;
				else modifier = 0.10;

				// HealOptimizer(tm) Calculations
				let optModifier = 0;
				let optUnits = 0;
				if(rr.troopUnits < 201) { optModifier = 0.10; optUnits = 200; }
				else if(rr.troopUnits < 501) {optModifier = 0.15; optUnits = 500;}
				else if(rr.troopUnits < 901) {optModifier = 0.17; optUnits = 900;}
				else if(rr.troopUnits < 1501) {optModifier = 0.19; optUnits = 1500;}
				else if(rr.troopUnits < 3501) {optModifier = 0.22; optUnits = 3500;}
				else {optModifier = 0.25; optUnits = -1;}

				// Prepare Data for the replies
				let fullCostText = '';
				let fullCostTextOther = '';
				let minCostText = '';
				let minCostTextWarn = '';
				let n;
				const optQty = Math.floor(optUnits / rr.troopUnits);
				
				// Calculate Resource Healing cost
				if(rr.foodCost) {
					n = Math.ceil(parseInt(rr.foodCost.replace(/,/g, '')) * troopAmount * modifier);
					fullCostText += '\nFood::  ' + numberWithCommas(n);
					n = Math.ceil(parseInt(rr.foodCost.replace(/,/g, '')) * troopAmount * optModifier);
					minCostText += '\nFood::  ' + numberWithCommas(n);
				}
				if(rr.partsCost) {
					n = Math.ceil(parseInt(rr.partsCost.replace(/,/g, '')) * troopAmount * modifier);
					fullCostText += '\nParts:: ' + numberWithCommas(n);
					n = Math.ceil(parseInt(rr.partsCost.replace(/,/g, '')) * troopAmount * optModifier);
					minCostText += '\nParts:: ' + numberWithCommas(n);
				}
				if(rr.eleCost) {
					n = Math.ceil(parseInt(rr.eleCost.replace(/,/g, '')) * troopAmount * modifier);
					fullCostText += '\nEle::   ' + numberWithCommas(n);
					n = Math.ceil(parseInt(rr.eleCost.replace(/,/g, '')) * troopAmount * optModifier);
					minCostText += '\nEle::   ' + numberWithCommas(n);
				}
				if(rr.gasCost) {
					n = Math.ceil(parseInt(rr.gasCost.replace(/,/g, '')) * troopAmount * modifier);
					fullCostText += '\nGas::   ' + numberWithCommas(n);
					n = Math.ceil(parseInt(rr.gasCost.replace(/,/g, '')) * troopAmount * optModifier);
					minCostText += '\nGas::   ' + numberWithCommas(n);
				}
				if(rr.cashCost) {
					n = Math.ceil(parseInt(rr.cashCost.replace(/,/g, '')) * troopAmount * modifier);
					fullCostText += '\nCash::  ' + numberWithCommas(n);
					n = Math.ceil(parseInt(rr.cashCost.replace(/,/g, '')) * troopAmount * optModifier);
					minCostText += '\nCash::  ' + numberWithCommas(n);
				}
				if(rr.smCost) {
					n = Math.ceil(parseInt(rr.smCost.replace(/,/g, '')) * troopAmount * modifier);
					fullCostText += '\nSM::    ' + numberWithCommas(n);
					n = Math.ceil(parseInt(rr.smCost.replace(/,/g, '')) * optModifier);
					if(n < 1) n = 1;
					n = n * Math.ceil(troopAmount / optQty);
					minCostText += '\nSM::    ' + numberWithCommas(n);
				}
				if(rr.ucCost) {
					n = Math.ceil(parseInt(rr.ucCost.replace(/,/g, '')) * troopAmount * modifier);
					fullCostText += '\nUC::    ' + numberWithCommas(n);
					n = Math.ceil(parseInt(rr.ucCost.replace(/,/g, '')) * optModifier);
					if(n < 1) n = 1;
					n = n * Math.ceil(troopAmount / optQty);
					minCostText += '\nUC::    ' + numberWithCommas(n);
				}
				if(rr.hcCost) {
					n = Math.ceil(parseInt(rr.hcCost.replace(/,/g, '')) * troopAmount * modifier);
					fullCostText += '\nHC::    ' + numberWithCommas(n);
					n = Math.ceil(parseInt(rr.hcCost.replace(/,/g, '')) * optModifier);
					if(n < 1) n = 1;
					n = n * Math.ceil(troopAmount / optQty);
					minCostText += '\nHC::    ' + numberWithCommas(n);
				}

				// Calculate Meta Crystal Healing cost
				if(rr.mchealCost) {
					n = Math.ceil(parseInt(rr.mchealCost.replace(/,/g, '')) * troopAmount);
					fullCostTextOther += '\nMC Heal::      ' + numberWithCommas(n);
				}

				// Calculate Hull Damage incurred from massacred troops
				if(rr.arkHP) {
					n = Math.ceil(parseInt(rr.arkHP.replace(/,/g, '')) * troopAmount);
					fullCostTextOther += '\nMassacre Dmg:: ' + numberWithCommas(n);
				}

				// Calculate Power lost from injured troops
				if(rr.powerLost) {
					n = Math.ceil(parseInt(rr.powerLost.replace(/,/g, '')) * troopAmount);
					fullCostTextOther += '\nPower::        ' + numberWithCommas(n);
				}

				// Calculate Kill Event Points from injured troops
				if(rr.kePoints) {
					n = Math.ceil(parseInt(rr.kePoints.replace(/,/g, '')) * troopAmount);
					fullCostTextOther += '\nKE Points::    ' + numberWithCommas(n);
				}

				// Calculate Heal Event Points from injured troops
				if(rr.hePoints) {
					n = Math.ceil(parseInt(rr.hePoints.replace(/,/g, '')) * troopAmount);
					fullCostTextOther += '\nHeal Points::  ' + numberWithCommas(n);
				}

				// Construct Reply with reduced T12 spam
				if(rr.troopTier == 12) {
					if(unitBuffer != rr.troopUnits) {
						unitBuffer = rr.troopUnits;
						reply.addFields(
							{ name: `Healing ${numberWithCommas(troopAmount)}x ${rr.troopName} (T${rr.troopTier} ${rr.troopType}):`, value: '|' },
							{ name: `Total Units: ${numberWithCommas(totalUnits)} @ ${modifier * 100}% of training costs:`, value: `\`\`\`asciidoc\n${fullCostText}\`\`\`` },
							{ name: `Other Stats:`, value: `\`\`\`asciidoc\n${fullCostTextOther}\`\`\`` },
						);
						if(optModifier < modifier) {
							let tipText = `${optQty}x troop`;
							if(optQty > 1) tipText += 's';
							tipText += ` at a time to heal at ${optModifier * 100}% of training costs:`;
							if(rr.hcCost > 0 || rr.ucCost > 0 || rr.smCost > 0) {
								minCostTextWarn = 'Save rss but may cost more sm/uc/hc';
							}
							reply.addFields(
								{ name: `TIP: Heal ${tipText}`, value: `\`\`\`asciidoc\n${minCostTextWarn}\n--${minCostText}\`\`\`` },
							);
						}
					}
				} else {
					reply.addFields(
						{ name: `Healing ${numberWithCommas(troopAmount)}x ${rr.troopName} (T${rr.troopTier} ${rr.troopType}):`, value: '|' },
						{ name: `Total Units: ${numberWithCommas(totalUnits)} @ ${modifier * 100}% of training costs:`, value: `\`\`\`asciidoc\n${fullCostText}\`\`\`` },
						{ name: `Other Stats:`, value: `\`\`\`asciidoc\n${fullCostTextOther}\`\`\`` },
					);
					if(optModifier < modifier) {
						let tipText = `${optQty}x troop`;
						if(optQty > 1) tipText += 's';
						tipText += ` at a time to heal at ${optModifier * 100}% of training costs:`;
						if(rr.hcCost > 0 || rr.ucCost > 0 || rr.smCost > 0) {
							minCostTextWarn = 'Save rss but may cost more sm/uc/hc';
						}
						reply.addFields(
							{ name: `TIP: Heal ${tipText}`, value: `\`\`\`asciidoc\n${minCostTextWarn}\n--${minCostText}\`\`\`` },
						);
					}
				}
				unitBuffer= rr.troopUnits;
			}
		});
		return interaction.reply({ embeds: [reply] });
	},
};