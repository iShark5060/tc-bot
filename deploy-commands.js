// Read .env file for sensible data
const result = require('dotenv').config();
if (result.error) { throw result.error; } else { console.log('Startup: dotenv variables loaded') }

const fs = require('fs');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { clientId, guildId, token } = require('./config.json');

const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	commands.push(command.data.toJSON());
}

const rest = new REST({ version: '9' }).setToken(process.env.TOKEN);

(async () => {
	try {
		await rest.put(
/*			Routes.applicationGuildCommands(clientId, guildId),
			{ body: commands }, */
			Routes.applicationGuildCommands(clientId, guildId),
                        { body: [] },
		);

		console.log('Successfully registered application commands for home server.');
	} catch (error) {
		console.error(error);
	}

	try {
		await rest.put(
			Routes.applicationCommands(clientId),
			{ body: commands },
		);

		console.log('Successfully registered application commands for global server.');
	} catch (error) {
		console.error(error);
	}
})();
