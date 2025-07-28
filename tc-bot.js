require('@dotenvx/dotenvx').config();
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const GoogleCredentials = require('./client_secret.json');
const config = require('./config.json');

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMessages,
	],
});

client.cooldowns = new Collection();
client.commands = new Collection();

async function initializeBot() {
	try {
		await sendStartupNotification();
		await initializeGoogleSheets();
		loadCommands();
		loadEvents();
		startMopupTimer();
		await client.login(process.env.TOKEN);
	}
	catch (error) {
		console.error('[Boot] Failed to initialize bot:', error);
		process.exit(1);
	}
}

async function sendStartupNotification() {
	try {
		const response = await fetch(config.webhookUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ content: 'TC-Bot just started.' }),
		});
		console.log('[Boot] Notification sent:', response.status);
	}
	catch (error) {
		console.error('[Boot] Failed to send startup notification:', error);
	}
}

async function initializeGoogleSheets() {
	const SCOPES = [
		'https://www.googleapis.com/auth/spreadsheets',
		'https://www.googleapis.com/auth/drive.file',
	];

	const serviceAccountAuth = new JWT({
		email: GoogleCredentials.client_email,
		key: GoogleCredentials.private_key,
		scopes: SCOPES,
	});

	client.GoogleSheet = new GoogleSpreadsheet('1ymnFE-wVxEqNV4CkoEHVowKcGHZYGouOUk_wCRBNzL4', serviceAccountAuth);

	await client.GoogleSheet.loadInfo();
	console.log('[Boot] Loaded Google Sheet:', client.GoogleSheet.title);
}

function loadCommands() {
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
				client.commands.set(command.data.name, command);
			}
			else {
				console.log('[Boot] WARNING! The following command is missing a required "data" or "execute" property:', filePath);
			}
		}
	}
}

function loadEvents() {
	const eventsPath = path.join(__dirname, 'events');
	const eventFiles = fs
		.readdirSync(eventsPath)
		.filter((file) => file.endsWith('.js'));

	for (const file of eventFiles) {
		const filePath = path.join(eventsPath, file);
		const event = require(filePath);

		if (event.once) {
			client.once(event.name, (...args) => event.execute(...args));
		}
		else {
			client.on(event.name, (...args) => event.execute(...args));
		}
	}
}

function startMopupTimer() {
	if (!config.channelId1 || !config.channelId2) {
		console.log('[Boot] WARNING! Mopup timer disabled because ChannelIDs are not configured');
		return;
	}

	setInterval(updateMopupChannels, 5 * 60 * 1000);
}

function calculateMopupTiming() {
	const now = Date.now();
	const timeOffset = new Date().getTimezoneOffset();
	const hoursFromEpoch = Math.ceil((now + timeOffset * 60 * 1000) / (60 * 60 * 1000)) - 8;
	const daysSinceEpoch = Math.floor(hoursFromEpoch / 24);
	const currentTime = Math.floor(new Date().valueOf() / 1000) * 1000;

	const { startTime, endTime } = getMopupWindow(daysSinceEpoch);
	const deltaStart = startTime - currentTime;
	const deltaEnd = endTime - currentTime;

	return determineMopupStatus(deltaStart, deltaEnd);
}

function getMopupWindow(day) {
	const dayInMs = 24 * 60 * 60 * 1000;
	const hourInMs = 60 * 60 * 1000;

	if (day % 2 === 0) {
	// Even days: 26 hours after day start, 8-hour window
		const startTime = day * dayInMs + 26 * hourInMs;
		const endTime = startTime + 8 * hourInMs;
		return { startTime, endTime };
	}
	else {
	// Odd days: 8 hours after day start, 16-hour window
		const startTime = day * dayInMs + 8 * hourInMs;
		const endTime = startTime + 16 * hourInMs;
		return { startTime, endTime };
	}
}

function determineMopupStatus(deltaStart, deltaEnd) {
	if (deltaStart < 0) {
		if (deltaEnd > 0) {
			return {
				status: 'ACTIVE',
				icon: '🟢',
				time: formatTime(deltaEnd),
			};
		}
		else {
			const nextWindowTime = deltaEnd + 24 * 60 * 60 * 1000;
			return {
				status: 'INACTIVE',
				icon: '🔴',
				time: formatTime(nextWindowTime),
			};
		}
	}
	else {
		return {
			status: 'INACTIVE',
			icon: '🔴',
			time: formatTime(deltaStart),
		};
	}
}

function formatTime(milliseconds) {
	return new Date(Math.abs(milliseconds)).toISOString().slice(11, 19);
}

async function updateMopupChannels() {
	try {
		const mopupInfo = calculateMopupTiming();

		const channel1 = client.channels.cache.get(config.channelId1);
		const channel2 = client.channels.cache.get(config.channelId2);

		if (channel1) {
			await channel1.setName(`${mopupInfo.icon} Mopup is: ${mopupInfo.status}`);
		}

		if (channel2) {
			await channel2.setName(`Time remaining: ${mopupInfo.time}`);
		}
	}
	catch (error) {
		console.error('[WARN] Failed to update mopup channels:', error);
	}
}

initializeBot();