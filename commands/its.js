module.exports = {
	name: 'tcits',
	description: 'How many troops can I kill?',
	args: true,
	argsmin: 3,
	argsmax: 4,
	aliases: ['tcts', 'tcignore'],
	usage: '<skill level> <# leadership> <target tier> [<total damage reduction>]',
	example: '60 150000 12',
	guildOnly: false,
	async execute(client, message, args) {
		// Quick function to space thousands with commata
		const numberWithCommas = (x) => {
			return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
		};

		const skillLevel = parseInt(args[0]);
		const leadership = parseInt(args[1]);
		const targetTier = parseInt(args[2]);
		let tdr = parseInt(args[3]) || 0;
		let numKills = 0;
		let type = '';
		let reply = '```';

		// If tdr is not a number (for example if someone entered only a string), set to 0
		if (isNaN(tdr)) { tdr = 0; }

		// Check if arguments are nonexistent or not numbers
		if (!skillLevel || isNaN(skillLevel) || !leadership || isNaN(leadership) || !targetTier || isNaN(targetTier)) {
			message.reply('you used an invalid syntax! See help below:');
			client.commands.get('help').execute(client, message, 'tcits');
			return;
		}

		if(skillLevel > 60) {
			await message.reply(`You entered skill level ${skillLevel}. Was that intended? Because it's not possible, but it would be REALLY nice if it were...`);
		}
		// Loading sheet "REF_BotTroops" that has all needed data in it
		const sheet = client.GoogleSheet.sheetsById[891063687];
		const rows = await sheet.getRows();
		rows.some(rr => {
			if (rr.troopTier == targetTier) {
				numKills = Math.floor(0.005 * leadership * skillLevel * (100 - tdr) / 100 / (rr.troopUnits || -1));
				type = rr.troopType.replace('Infantry', 'INF').replace('Walker', 'WLK').replace('Airship', 'AIR');
				reply += `\n- ${numKills < 0 ? '??' : numberWithCommas(numKills)}x ${rr.troopName} (T${targetTier} ${type})`;
			}
		});

		await message.reply(`${numberWithCommas(leadership)} leadership with level ${skillLevel} iTS skill vs ${tdr}% TDR can kill:${reply}\`\`\``);
	},
};