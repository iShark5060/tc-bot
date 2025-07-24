// Read .env file for sensible data
const result = require('dotenv').config();
if (result.error) { throw result.error; } else { console.log('Startup: dotenv variables loaded') }

// Load all the other stuff
const { GoogleSpreadsheet } = require('google-spreadsheet');
const GoogleCredentials = require('./client_secret.json');
const { Client, Collection, GatewayIntentBits, IntentsBitField } = require('discord.js');
const io = require('@pm2/io');
const fs = require('fs');
const ocrSpaceApi = require('ocr-space-api');
const myIntents = new IntentsBitField();
myIntents.add(IntentsBitField.Flags.DirectMessages);

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, myIntents] });
client.GoogleSheet = new GoogleSpreadsheet('1ymnFE-wVxEqNV4CkoEHVowKcGHZYGouOUk_wCRBNzL4');

// Filesystem Stuff
client.commands = new Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
const eventFiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));

// Login to google sheets
(async function() {
	await client.GoogleSheet.useServiceAccountAuth(GoogleCredentials);
	await client.GoogleSheet.loadInfo();
	console.log(`Startup: Loaded Google Sheet: ${client.GoogleSheet.title}`);
}());

// Register Commands
for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	// Set a new item in the Collection
	// With the key as the command name and the value as the exported module
	client.commands.set(command.data.name, command);
}

// Register Events
for (const file of eventFiles) {
	const event = require(`./events/${file}`);
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	} else {
		client.on(event.name, (...args) => event.execute(...args));
	}
}

// Login to Discord with your client's token
client.login(process.env.TOKEN);