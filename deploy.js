const { REST, Routes } = require('discord.js');
const { clientId, guildId } = require('./config.json');
const { fs } = require('node:fs');
const { path } = require('node:path');
const { dotenv } = require('dotenv');

const result = dotenv.config();
if (result.error) {
	throw result.error;
}
else {
	console.log('[Boot] dotenv variables loaded');
}

async function deployCommands() {
	try {
		const commands = loadCommands();
		const rest = new REST().setToken(process.env.TOKEN);

		await clearExistingCommands(rest);
		await deployNewCommands(rest, commands);
	}
	catch (error) {
		console.error('[FAIL] Failed to deploy commands:', error);
		process.exit(1);
	}
}

function loadCommands() {
	const commands = [];
	const foldersPath = path.join(__dirname, 'commands');
	const commandFolders = fs.readdirSync(foldersPath);

	for (const folder of commandFolders) {
		const commandsPath = path.join(foldersPath, folder);
		const commandFiles = fs
			.readdirSync(commandsPath)
			.filter((file) => file.endsWith('.js'));

		for (const file of commandFiles) {
			const filePath = path.join(commandsPath, file);
			const command = require(filePath);

			if ('data' in command && 'execute' in command) {
				commands.push(command.data.toJSON());
			}
			else {
				console.log('[Boot] WARNING! The following command is missing a required "data" or "execute" property:', filePath);
			}
		}
	}

	return commands;
}

async function clearExistingCommands(rest) {
	try {
		await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
			body: [],
		});
		console.log('[INFO] Successfully deleted all guild commands.');

		await rest.put(Routes.applicationCommands(clientId), { body: [] });
		console.log('[INFO] Successfully deleted all application commands.');
	}
	catch (error) {
		console.error('[FAIL] Failed to clear existing commands:', error);
		throw error;
	}
}

async function deployNewCommands(rest, commands) {
	try {
		console.log('[INFO] Started refreshing guild commands:', commands.length);

		const data = await rest.put(Routes.applicationCommands(clientId), {
			body: commands,
		});

		console.log('[SUCCESS] Finished refreshing guild commands:', data.length);
	}
	catch (error) {
		console.error('[FAIL] Failed to deploy new commands:', error);
		throw error;
	}
}

deployCommands();