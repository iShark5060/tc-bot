const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('gearcheck')
		.setDescription('Calculate stat at base and +10/13/20/30/40/50')
		.addNumberOption(option => option.setName('stat').setDescription('Current stat amount').setRequired(true))
		.addIntegerOption(option => option.setName('level').setDescription('Current upgrade level').setRequired(true)),
	async execute(interaction) {
		await interaction.deferReply();
		let statValue = interaction.options.getNumber('stat');
		const gearLevel = interaction.options.getInteger('level');
		statValue = parseFloat(statValue).toFixed(2);

		// Let's do some math
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

		const reply = new EmbedBuilder()
			.setColor(16777215)
			.setTitle('Gearcheck')
			.addFields(
				{ name: 'Current stat:', value: `\`\`\`asciidoc\n+${gearLevel}: ${statValue}%\`\`\`` },
				{ name: 'Calculated:', value: `\`\`\`asciidoc\n+0:: ${base}%\n+10:: ${base10}%\n+13:: ${base13}%\n+20:: ${base20}%\n+30:: ${base30}%\n+40:: ${base40}%\n+50:: ${base50}%\`\`\`` },
			);
		await interaction.editReply({ embeds: [reply] });
	},
};