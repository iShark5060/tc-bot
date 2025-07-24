module.exports = {
	name: 'tcgearcheck',
	description: 'Calculate stat at base and +10/20/30/40/50',
	args: true,
	argsmin: 1,
	argsmax: 2,
	aliases: ['tcgc', 'tccheckgear', 'tccg'],
	usage: '<stat> [<level>]',
	example: '43.2 6',
	guildOnly: false,
	async execute(client, message, args) {
		let statValue = args[0];
		let gearLevel = args[1].match(/\d+/) || 0;

		// Replace commata with dot and remove the leading + if present
		statValue = statValue.toString().replace(',', '.').replace('+', '').replace('-', '');

		// Strip any strings from gearLevel
		gearLevel = parseInt(gearLevel);

		// If gearLevel is not a number (for example if someone entered only a string), set to +0
		if (isNaN(gearLevel)) { gearLevel = 0; }

		// Check if first arguments is not a number
		if (!statValue || isNaN(statValue)) {
			message.reply('you used an invalid syntax! See help below:');
			client.commands.get('help').execute(client, message, 'tcgearcheck');
			return;
		}

		// Finally let's do some math
		let base = 1.0 * statValue / (1 + gearLevel / 10);
		base = base.toFixed(2);
		let base10 = base * 2;
		base10 = base10.toFixed(2);
		let base13 = base * 2.3;
		base13 = base13.toFixed(2);
		let base20 = base * 3;
		base20 = base20.toFixed(2);
		let base30 = base * 4;
		base30 = base30.toFixed(2);
		let base40 = base * 5;
		base40 = base40.toFixed(2);
		let base50 = base * 6;
		base50 = base50.toFixed(2);

		let reply = `${message.author} Current: ${statValue}% @ +${gearLevel}`;
		reply += `\`\`\`asciidoc
Base stat:: ${base}%
	@ +10:: ${base10}%
	@ +13:: ${base13}%
	@ +20:: ${base20}%
	@ +30:: ${base30}%
	@ +40:: ${base40}%
	@ +50:: ${base50}%
\`\`\``;

		await message.channel.send(reply);
	},
};