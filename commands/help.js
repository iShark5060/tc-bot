module.exports = {
	name: 'help',
	enabled: true,
	channelOnly: false,
	internalOnly: false,

	args: true,
	argsMin: 0,
	argsMax: 1,

	description: 'Your friendly neighbourhood helper function',
	usage: '<command>',
	aliases: ['h', 'tch', 'tchelp'],
	example: 'tchealtroops',

	async execute(client, message, command) {
		// Helper function, if someone is lost
		if (!command || !command[0] || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(command).name === 'help')) {
			// Command list here
			return message.channel.send('command list here');
		}
		if (Array.isArray(command)) { command = command[0]; }
		if (client.commands.has(command) || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(command))) {
			command = client.commands.get(command) || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(command));
			message.channel.send(`= ${command.name} = \n${command.description}\nusage::   ${client.config.prefix}${command.name} ${command.usage}\nexample:: ${client.config.prefix}${command.name} ${command.example}\naliases:: ${command.aliases.join(', ')}\n= ${command.name} =`, { code:'asciidoc' });
		}
		else {
			// Command list here
			message.channel.send(`Command "${command}" not found. Here is a list.`);
			message.channel.send('command list here');
		}
	},
};