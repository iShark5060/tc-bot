# Discord Bot for Ark of War

![Static Badge](https://img.shields.io/badge/Node.js-25-red?style=for-the-badge) ![Static Badge](https://img.shields.io/badge/TypeScript-5.9-blue?style=for-the-badge) ![NPM Version](https://img.shields.io/npm/v/discord.js?style=for-the-badge&label=Discord.js&color=blue) ![NPM Version](https://img.shields.io/npm/v/%40dotenvx%2Fdotenvx?style=for-the-badge&label=.envx&color=green) ![NPM Version](https://img.shields.io/npm/v/google-spreadsheet?style=for-the-badge&label=google-spreadsheet&color=orange)

Discord Bot based on the `Discord.js` framework using `Node.js` and `TypeScript` to enable `/commands` for the game [Ark of War](https://www.7piratesgames.com/ark.html)
The bot itself is pretty basic and basically just follows along the [tutorial](https://discordjs.guide/) of the Discord.js framework.

## About

This is the 5th iteration of this bot by now. In the beginning it was "hacked together" (his words) by [Krylar](https://github.com/Krylar) and rewritten several times by me over the years.
Outside of the game itself, the bot is pretty useless, and even inside the game it has since outlived most of its usefulness.

The Bot lives in the Diplomacy of War Discord Server - one of the largest communities around the game (https://discord.gg/YMAhCNjkgp).

The TC-Bot project is licensed under [GPLv3](https://www.gnu.org/licenses/gpl-3.0.html)

Discord.js Frame work by [Discord.js](https://github.com/discordjs/discord.js)

## History

Since this bot was created before I knew how to properly use GitHub, I had created several repositories for each version and simply put them on private on a new release.
I have now changed this, without keeping the changes made over the years, simply because dealing with merge conflicts would have been a nightmare. All changes were done by me anyways, so no contribution by others was lost.
This is why the merges done for the different branches look all so strange, just ignore. If you're interested in one of the older versions, I have marked releases for each final iteration.

From version 5 the bot was fully rewritten using Claude 4 Sonnet and GPT-5 Reasoning as helper, since my skills in JavaScript are not the best. Version 7 was converted to TypeScript via Cursor's Composer 1 to improve code quality and maintainability.

## Requirements

- Node.js
- I recommend using PM2

## Configuration

You will need to create several files and fill them out in order to use the bot.

.env

```
# Your Discord Bot Token
TOKEN=balblub

#SQLite
SQLITE_DB_PATH='./data/metrics.db'
CHECKPOINT_INTERVAL_MS=300000

# Your userID.
CLIENT_ID=123456
# Your ServerID.
GUILD_ID=123456

# Channel for Autoupdated Mopup info (Status).
CHANNEL_ID1=123456
# Channel for Autoupdated Mopup info (Timer).
CHANNEL_ID2=123456

# GoogleSheet URL with the data
GOOGLE_SHEET_URL=blablablub
# GoogleSheet ID with the data
GOOGLE_SHEET_ID=12345
# Cache time in ms
GOOGLE_SHEET_CACHE=300000

# Webhook URL for Discord Notifications when the bot starts (number part).
WEBHOOK_ID=123456
# Webhook URL for Discord Notifications when the bot starts (token part).
WEBHOOK_TOKEN=blablablublala
```

Unless you have a copy of the Theorycrafters Google Docs sheet, you probably will not be able to use the Healing/ITS function.
If you do - the API access credentials go into the client_secret.json

client_secret.json

```
{
  "type": "service_account",
  "project_id": "your_project_id",
  "private_key_id": "your_private_key_id",
  "private_key": "-----BEGIN PRIVATE KEY-----so much of a private key here-----END PRIVATE KEY-----\n",
  "client_email": "your@client.email",
  "client_id": "123456",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "insertthegooglecerturlhere"
}
```

## Running the App

up to date instructions are available here: https://nodejs.org/en/download

Installing nvm, node & npm run:

```
# Download and install nvm:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# Download and install Node.js:
nvm install 25

# Verify the Node.js version:
node -v # Should print "v25.x.x".
nvm current # Should print "v25.x.x".

# Verify npm version:
npm -v # Should print "11.x.x".
```

Installing and starting the Bot

```
# download all the dependencies listed in the package.json
npm install

# build the TypeScript code
npm run build

# actually start the bot
npm start

# or start it with PM2 ecosystem file for better control
pm2 start ecosystem.config.cjs

# to deploy slash commands to Discord
npm run deploy

# for debug mode (verbose logging), add DEBUG=true to your .env file
# then run: npm run dev

# run tests
npm test

# run tests in watch mode
npm run test:watch
```
