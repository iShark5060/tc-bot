// Default config stuff
const fs = require('fs');
const Discord = require('discord.js');
const winston = require('winston');
const io = require('@pm2/io');

const client = new Discord.Client();

// Read config.json
const rawData = fs.readFileSync('./config.json');
client.config = JSON.parse(rawData);
if (!client.config.prefix) { throw console.error('Fatal Error: Config could not be loaded.'); }

// Read .env file for sensible data
const result = require('dotenv').config();
if (result.error) { throw result.error; }

// Setup the Google Spreadsheet for queries
const { GoogleSpreadsheet } = require('google-spreadsheet');
const GoogleCredentials = require('./client_secret.json');
client.GoogleSheet = new GoogleSpreadsheet('1ymnFE-wVxEqNV4CkoEHVowKcGHZYGouOUk_wCRBNzL4');

// Setup Logging
client.logger = winston.createLogger({
	transports: [
		new winston.transports.File({ filename: 'bot.log', level: 'error' }),
	],
	format: winston.format.combine(
		winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
		winston.format.printf(log => `(${log.timestamp}) [${log.level.toUpperCase()}] - ${log.message}`),
	),
});
if (process.env.ENVIRONMENT !== 'production') {
	client.logger.add(new winston.transports.Console({
		format: winston.format.combine(
			winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
			winston.format.colorize(),
			winston.format.printf(log => `(${log.timestamp}) [${log.level}] - ${log.message}`),
		),
	}));
}

// Log some basic stuff
client.on('debug', m => client.logger.log('debug', m));
client.on('warn', m => client.logger.log('warn', m));
client.on('error', m => client.logger.log('error', m));
process.on('uncaughtException', error => {
	const errorMsg = error.stack.replace(new RegExp(`${__dirname}/`, 'g'), './');
	client.logger.log('error', errorMsg);
	process.exit(1);
});
process.on('unhandledRejection', error => {
	client.logger.log('error', error);
	process.exit(1);
});

// Bot is ready and logged in... should work at this point.
client.once('ready', () => {
	client.ChannelLog('The tc-bot just stared. Probably normal... but maybe check those logs. ¯\\_(ツ)_/¯', 2, true);
});

// Channel Logging
client.ChannelLog = async function(message, loglevel, sendToLogger) {
	// const channel = client.channels.cache.find(ch => ch.name === client.config.errorChannel);
	let severity = 0;
	// if (!channel) return client.logger.warn(`errorChannel "${client.config.errorChannel}" not found.`);

	switch (loglevel) {
	default: severity = 'unknown'; break;
	case 0: severity = 'error'; break;
	case 1: severity = 'warn'; break;
	case 2: severity = 'info'; break;
	case 3: severity = 'http'; break;
	case 4: severity = 'verbose'; break;
	case 5: severity = 'debug'; break;
	case 6: severity = 'silly'; break;
	}

	// await channel.send(`\`\`\`[${severity.toUpperCase()}]:\n${message}\`\`\``);

	if (sendToLogger) { client.logger.log({ level: severity, message: message }); }

	return;
};

async function init() {
	// Login to google sheets
	await client.GoogleSheet.useServiceAccountAuth(GoogleCredentials);
	await client.GoogleSheet.loadInfo();
	client.logger.info(`Loaded Google Sheet: ${client.GoogleSheet.title}`);

	// Statistics Setup
	const meterCommands = io.meter({
		name: 'commands/min',
		samples: 1,
		timeframe: 60,
	});
	const countCommands = io.counter({
		name: 'commands used',
	});

	// Command list. Read from ./commands/ folder. Everything in it with .js ending = command
	client.commands = new Discord.Collection();
	const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

	for (const file of commandFiles) {
		const command = require(`./commands/${file}`);
		try {
			client.commands.set(command.name, command);
			client.logger.info(`Successfully loaded command: ${command.name}`);
		}
		catch (error) {
			client.logger.warn(`Unable to load command: ${command.name}`);
		}
	}

	// Bot reacts to messages sent to channels it is in.
	client.on('message', message => {
		// Ignore messages that don't start with our prefix, or are from a bot
		if (!message.content.startsWith(client.config.prefix) || message.author.bot) return;
		client.logger.debug(`Incoming message: ${message}`);

		// Message starting with our prefix (fixed the !<space> issue). Arguments followed after split by <space>.
		const args = message.content.slice(client.config.prefix.length).trim().split(/ +/);
		const commandName = args.shift().toLowerCase();

		// User entered command that is either a direct command or in the list of aliases.
		const command = client.commands.get(commandName) || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));
		if (!command) {
			client.logger.debug(`User ${message.author} tried to use command: ${command.name}. It failed.`);
			message.reply('you used an unknown command! See help below:');
			return client.commands.get('help').execute(client, message, command.name);
		}

		// Bot was spoken to via Direct Message - and the command can't be used in DMs
		if (command.guildOnly && message.channel.type === 'dm') {
			client.logger.debug(`User ${message.author} used ${command.name} in a DM.`);
			return message.reply('I can\'t execute that command inside DMs!');
		}

		// Special Command that can ONLY be used in DMs
		if (command.name === 'swe') {
			client.logger.debug(`User ${message.author} used ${command.name} outside a DM.`);
			return message.reply('I can\'t execute that command outside DMs! Please just DM me and use that command.');
		}

		// User didn't supply any arguments or not the right amount of arguments. Send Help.
		if ((command.args && !args.length) || (command.args && args.length < command.argsmin) || (command.args && args.length > command.argsmax)) {
			meterCommands.mark();
			countCommands.inc();
			client.logger.debug(`User ${message.author} used ${command.name}. Syntax Error.`);
			if (!(command.name === 'help')) { message.reply('you used an invalid syntax! See help below:'); }
			return client.commands.get('help').execute(client, message, command.name);
		}

		// Command was valid ... let's try excecute the .js file for that command
		try {
			meterCommands.mark();
			countCommands.inc();
			client.logger.debug(`User ${message.author} used ${command.name} successfully.`);
			command.execute(client, message, args, Discord);
		}
		catch (error) {
			// Something didn't go right. Luckily we have a "bot doesn't crash" catch here.
			client.ChannelLog(error, 0, true);
		}
	});
}

client.login(process.env.TOKEN);
init();