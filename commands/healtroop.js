/* eslint-disable max-statements-per-line */
module.exports = {
	name: 'tchealtroop',
	description: 'Calculate cost to heal troops',
	args: true,
	argsmin: 3,
	argsmax: 4,
	aliases: ['tcht', 'tchealtroops', 'tctroopheal'],
	usage: '<# troops> <tier> <type> <healboost>',
	example: '100 9 air',
	guildOnly: false,
	async execute(client, message, args) {
		// Quick function to space thousands with commata
		const numberWithCommas = (x) => {
			return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
		};

		// Sort arguments and replace stuff if neccessary
		const troopAmount = args[0].match(/\d+/);
		const troopTier = args[1].match(/\d+/);
		const troopType = args[2]
			.replace(/^air$/i, 'Airship')
			.replace(/^a$/i, 'Airship')
			.replace(/^inf$/i, 'Infantry')
			.replace(/^i$/i, 'Infantry')
			.replace(/^w$/i, 'Walker')
			.replace(/^walk$/i, 'Walker')
			.replace(/^wlk$/i, 'Walker');
		const HealingBoost = args[3] || 0;

		if (!troopAmount || !troopTier || !troopType || !(troopType === 'Airship' || troopType === 'Walker' || troopType === 'Infantry')) {
			message.reply('you used an invalid syntax! See help below:');
			client.commands.get('help').execute(client, message, 'tchealtroop');
			return;
		}

		// Reduce T12 spam:
		let unitBuffer = 0;

		// Loading sheet "REF_BotTroops" that has all needed data in it
		const sheet = client.GoogleSheet.sheetsById[891063687];
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

				let reply = `\`\`\`\nHealing ${numberWithCommas(troopAmount)}x ${rr.troopName} (T${rr.troopTier} ${rr.troopType}):`;
				reply += '\nTotal Units: '
					+ numberWithCommas(totalUnits)
					+ ` @ ${modifier * 100}% of training costs`
					+ ` boosted by ${HealingBoost}%`;

				// Calculate Resource Healing cost
				if(rr.foodCost) {
					const n = Math.ceil(parseInt(rr.foodCost.replace(/,/g, '')) * troopAmount * modifier / (1 + HealingBoost / 100));
					reply += '\nFood: ' + numberWithCommas(n);
				}
				if(rr.partsCost) {
					const n = Math.ceil(parseInt(rr.partsCost.replace(/,/g, '')) * troopAmount * modifier / (1 + HealingBoost / 100));
					reply += '\nParts: ' + numberWithCommas(n);
				}
				if(rr.eleCost) {
					const n = Math.ceil(parseInt(rr.eleCost.replace(/,/g, '')) * troopAmount * modifier / (1 + HealingBoost / 100));
					reply += '\nEle: ' + numberWithCommas(n);
				}
				if(rr.gasCost) {
					const n = Math.ceil(parseInt(rr.gasCost.replace(/,/g, '')) * troopAmount * modifier / (1 + HealingBoost / 100));
					reply += '\nGas: ' + numberWithCommas(n);
				}
				if(rr.cashCost) {
					const n = Math.ceil(parseInt(rr.cashCost.replace(/,/g, '')) * troopAmount * modifier / (1 + HealingBoost / 100));
					reply += '\nCash: ' + numberWithCommas(n);
				}
				if(rr.smCost) {
					const n = Math.ceil(parseInt(rr.smCost.replace(/,/g, '')) * troopAmount * modifier);
					reply += '\nSM: ' + numberWithCommas(n);
				}
				if(rr.ucCost) {
					const n = Math.ceil(parseInt(rr.ucCost.replace(/,/g, '')) * troopAmount * modifier);
					reply += '\nUC: ' + numberWithCommas(n);
				}
				if(rr.hcCost) {
					const n = Math.ceil(parseInt(rr.hcCost.replace(/,/g, '')) * troopAmount * modifier);
					reply += '\nHC: ' + numberWithCommas(n);
				}

				reply += '\n';

				// Calculate Meta Crystal Healing cost
				if(rr.mchealCost) {
					const n = Math.ceil(parseInt(rr.mchealCost.replace(/,/g, '')) * troopAmount);
					reply += '\n==> MC Heal: ' + numberWithCommas(n);
				}

				// Calculate Hull Damage incurred from massacred troops
				if(rr.arkHP) {
					const n = Math.ceil(parseInt(rr.arkHP.replace(/,/g, '')) * troopAmount);
					reply += '\nMassacre Dmg: ' + numberWithCommas(n);
				}

				// Calculate Power lost from injured troops
				if(rr.powerLost) {
					const n = Math.ceil(parseInt(rr.powerLost.replace(/,/g, '')) * troopAmount);
					reply += '\nPower: ' + numberWithCommas(n);
				}

				// Calculate Kill Event Points from injured troops
				if(rr.kePoints) {
					const n = Math.ceil(parseInt(rr.kePoints.replace(/,/g, '')) * troopAmount);
					reply += '\nKE Points: ' + numberWithCommas(n);
				}

				// Calculate Heal Event Points from injured troops
				if(rr.hePoints) {
					const n = Math.ceil(parseInt(rr.hePoints.replace(/,/g, '')) * troopAmount);
					reply += '\nHeal Points: ' + numberWithCommas(n);
				}

				// HealOptimizer(tm) Calculations
				let optModifier = 0;
				let optUnits = 0;
				if(rr.troopUnits < 201) { optModifier = 0.10; optUnits = 200; }
				else if(rr.troopUnits < 501) {optModifier = 0.15; optUnits = 500;}
				else if(rr.troopUnits < 901) {optModifier = 0.17; optUnits = 900;}
				else if(rr.troopUnits < 1501) {optModifier = 0.19; optUnits = 1500;}
				else if(rr.troopUnits < 3501) {optModifier = 0.22; optUnits = 3500;}
				else {optModifier = 0.25; optUnits = -1;}

				if(optModifier < modifier) {
					const optQty = Math.floor(optUnits / rr.troopUnits);

					reply += `\n\nTIP: Heal ${optQty}x troop`;
					if(optQty > 1) reply += 's';
					reply += ` at a time to heal at ${optModifier * 100}% of training costs:`;
					if(rr.hcCost > 0 || rr.ucCost > 0 || rr.smCost > 0) {
						reply += '\n***Save rss but may cost more sm/uc/hc';
					}
					if(rr.foodCost) {
						const n = Math.ceil(parseInt(rr.foodCost.replace(/,/g, '')) * troopAmount * optModifier);
						reply += '\nFood: ' + numberWithCommas(n);
					}
					if(rr.partsCost) {
						const n = Math.ceil(parseInt(rr.partsCost.replace(/,/g, '')) * troopAmount * optModifier);
						reply += '\nParts: ' + numberWithCommas(n);
					}
					if(parseInt(rr.eleCost) > 0) {
						const n = Math.ceil(parseInt(rr.eleCost.replace(/,/g, '')) * troopAmount * optModifier);
						reply += '\nEle: ' + numberWithCommas(n);
					}
					if(parseInt(rr.gasCost) > 0) {
						const n = Math.ceil(parseInt(rr.gasCost.replace(/,/g, '')) * troopAmount * optModifier);
						reply += '\nGas: ' + numberWithCommas(n);
					}
					if(parseInt(rr.cashCost) > 0) {
						const n = Math.ceil(parseInt(rr.cashCost.replace(/,/g, '')) * troopAmount * optModifier);
						reply += '\nCash: ' + numberWithCommas(n);
					}
					if(rr.smCost) {
						let n = Math.ceil(parseInt(rr.smCost.replace(/,/g, '')) * optModifier);
						if(n < 1) n = 1;
						n = n * Math.ceil(troopAmount / optQty);
						reply += '\nSM: ' + numberWithCommas(n);
					}
					if(rr.ucCost) {
						let n = Math.ceil(parseInt(rr.ucCost.replace(/,/g, '')) * optModifier);
						if(n < 1) n = 1;
						n = n * Math.ceil(troopAmount / optQty);
						reply += '\nUC: ' + numberWithCommas(n);
					}
					if(rr.hcCost) {
						let n = Math.ceil(parseInt(rr.hcCost.replace(/,/g, '')) * optModifier);
						if(n < 1) n = 1;
						n = n * Math.ceil(troopAmount / optQty);
						reply += '\nHC: ' + numberWithCommas(n);
					}
				}

				reply += '\n```';

				// Reduce T12 spam
				if(rr.troopTier == 12) {
					if(unitBuffer != rr.troopUnits) {
						unitBuffer = rr.troopUnits;
						message.reply(reply);
					}
				}
				else{
					message.reply(reply);
				}
			}
		});
	},
};