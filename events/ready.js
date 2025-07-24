module.exports = {
	name: 'ready',
	once: true,
	execute(client) {
		console.log(`Startup: Bot Ready! Logged in as ${client.user.tag}`);
	},
};