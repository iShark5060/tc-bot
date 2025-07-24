const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('its')
		.setDescription('How many troops can I kill with Ignore Tier Suppression skills?')
		.addIntegerOption(option => option.setName('level').setDescription('iTS Skill Level').setRequired(true))
		.addIntegerOption(option => option.setName('leadership').setDescription('Leadership amount').setRequired(true))
		.addIntegerOption(option => option.setName('tier').setDescription('Target Tier').setRequired(true))
		.addIntegerOption(option => option.setName('tdr').setDescription('Target Total Damage Reduction amount')),
	async execute(interaction) {
		await interaction.deferReply();
		const skillLevel = interaction.options.getInteger('level');
		const leadership = interaction.options.getInteger('leadership');
		const targetTier = interaction.options.getInteger('tier');
		let tdr = interaction.options.getInteger('tdr');
		let numKills = 0;
		let type = '';
		let replyText = '```';

		// If tdr is not a number (for example if someone entered only a string), set to 0
		if (isNaN(tdr) || tdr < 1) { tdr = 0; }

		// Quick function to space thousands with commata
		const numberWithCommas = (x) => {
			return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
		};

		if (skillLevel > 60) {
			return interaction.reply({ content: `You entered skill level ${skillLevel}. Was that intended? Because it's not possible, but it would be REALLY nice if it were...`, ephemeral: true });
		}

		const reply = new EmbedBuilder()
			.setColor(16777215)
			.setTitle('Ignore Tier Suppression');

		// Loading sheet "REF_BotTroops" that has all needed data in it
		const sheet = interaction.client.GoogleSheet.sheetsById[891063687];
		const rows = await sheet.getRows();
		rows.some(rr => {
			if (rr.get('troopTier') == targetTier) {
				numKills = Math.floor(0.005 * leadership * skillLevel * (100 - tdr) / 100 / (rr.get('troopUnits') || -1));
				type = rr.get('troopType').replace('Infantry', 'INF').replace('Walker', 'WLK').replace('Airship', 'AIR');
				replyText += `\n- ${numKills < 0 ? '??' : numberWithCommas(numKills)}x ${rr.get('troopName')} (T${targetTier} ${type})`;
			}
		});

		reply.addFields(
			{ name: `${numberWithCommas(leadership)} leadership with level ${skillLevel} iTS skill vs ${tdr}% TDR can kill:`, value: `${replyText}\`\`\`` },
		);
		await interaction.editReply({ embeds: [reply] });
	},
};