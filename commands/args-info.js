/* eslint-disable no-inline-comments */
module.exports = {
	name: 'args-info',							// Name, also used as alias
	enabled: true,								// is Module enabled?
	channelOnly: false,							// Does the command work in DMs?
	internalOnly: false,						// only used interally, can't be called by users

	args: true,									// Does module expect arguments - no clue if used
	argsMin: 1,									// Minimum amount of arguments that have to be supplied
	argsMax: 10,								// Maximum amount of arguments that can be supplied

	description: 'Display Arguments array',		// Description to display as help
	usage: '<args>',							// How to use the command, displayed in help
	aliases: ['args', 'meh'],					// other aliases to use comand
	example: 'some argument here',				// example useage

	execute(client, message, args) {
		message.channel.send(`Arguments: ${args}`);
	},
};