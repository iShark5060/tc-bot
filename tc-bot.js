const result = require('dotenv').config();
if (result.error) { throw result.error; } else { console.log('Startup: dotenv variables loaded') }

const { GoogleSpreadsheet } = require('google-spreadsheet');
const GoogleCredentials = require('./client_secret.json');
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, MessageFlags } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent] });
client.GoogleSheet = new GoogleSpreadsheet('1ymnFE-wVxEqNV4CkoEHVowKcGHZYGouOUk_wCRBNzL4');
client.cooldowns = new Collection();
client.commands = new Collection();
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

// Login to google sheets
(async function() {
	await client.GoogleSheet.useServiceAccountAuth(GoogleCredentials);
	await client.GoogleSheet.loadInfo();
	console.log(`Startup: Loaded Google Sheet: ${client.GoogleSheet.title}`);
}());

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

for (const file of eventFiles) {
	const filePath = path.join(eventsPath, file);
	const event = require(filePath);
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	} else {
		client.on(event.name, (...args) => event.execute(...args));
	}
}

client.login(process.env.TOKEN);

let mopupTimer = setInterval(function() {
    // so we basically do the /mopup command every 1 min. could be cleaner, but I can't be bothered.
    // Channel names can only be edited twice every 10 mins, so we're just doing it once.
    // output should be "<muIcon> Mopup is <muActive>, for <muTime>."

    let muIcon;
    let muActive;
    let muTime;

    let starttime;
    let endtime;
    const ttoday = Date.now();
    const timeoffset = new Date().getTimezoneOffset();
    const thours = Math.ceil((ttoday + timeoffset * 60 * 1000) / (60 * 60 * 1000)) - 8;
    const today = Math.floor(thours / 24);

    if (today % 2 == 0) {
        // multiplier: minutes * minutes * days ; offset is 26 hours after day start of the day from server reset
        starttime = (today * 60 * 60 * 24 + 24 * 60 * 60) * 1000;
        endtime = starttime + 8 * 60 * 60 * 1000;
    }
    else {
        // multiplier: minutes * minutes * days ; offset is 8 hours after day start of the day from server reset
        starttime = (today * 60 * 60 * 24 + 8 * 60 * 60) * 1000;
        endtime = starttime + 16 * 60 * 60 * 1000;
    }

    // calculate time difference between now (utctime) and starttime
    // convert utctime into unix
    const currenttime = (new Date(new Date().toISOString()).valueOf() / 1000).toFixed(0) * 1000;

    const deltastart = starttime - currenttime;
    const deltaend = endtime - currenttime;

    if (deltastart < 0) {
        if (deltaend > 0) {
            muActive = 'ACTIVE';
            muIcon = '🟢';

            // calculate remaining time window, use deltaend and convert into hh:mm:ss
            muTime = new Date(deltaend).toISOString().slice(11, 19);
        }
        else {
            muActive = 'INACTIVE';
            muIcon = '🔴';

            // calculate next window start, depends of current day
            if (today % 2 == 0) {
                // cannot happen,
            }
            else {
                muTime = new Date(deltaend + 24 * 60 * 60).toISOString().slice(11, 19);

            }
        }
    }
    else {
        muActive = 'INACTIVE';
        muIcon = '🔴';

        // calculate the time remaining, use deltastart and convert into hh:mm:ss
        muTime = new Date(deltastart).toISOString().slice(11, 19);
    }

    // edit the channel:
    const channel = client.channels.cache.get('1223400455577538660');
    const channel2 = client.channels.cache.get('1223408725398655067');
    channel.setName(`${muIcon} Mopup is: ${muActive}`)
        .catch(console.error);
    channel2.setName(`Time remaining: ${muTime}`)
        .catch(console.error);
}, 1000*60*5);
