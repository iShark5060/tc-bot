const { Events } = require('discord.js');

module.exports = {
	name: Events.ClientReady,
	once: true,
	execute(client) {
		logReadyStatus(client);
		displayBotStatistics(client);
	},
};

function logReadyStatus(client) {
	console.log('[BOOT] Bot is ready, logged in as:', client.user.tag);
}

function displayBotStatistics(client) {
	const stats = {
		guilds: client.guilds.cache.size,
		users: client.users.cache.size,
		commands: client.commands.size,
	};

	console.log('[BOOT] Bot Statistics:');
	console.log('[BOOT] - Guilds:', stats.guilds);
	console.log('[BOOT] - Users:', stats.users);
	console.log('[BOOT] - Commands:', stats.commands);
}