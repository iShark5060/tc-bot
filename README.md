# Discord Bot for Ark of War

![Static Badge](https://img.shields.io/badge/Node.js-24.4.1-red?style=for-the-badge) ![NPM Version](https://img.shields.io/npm/v/discord.js?style=for-the-badge&label=Discord.js&color=blue) ![NPM Version](https://img.shields.io/npm/v/dotenv?style=for-the-badge&label=.env&color=green) ![NPM Version](https://img.shields.io/npm/v/google-spreadsheet?style=for-the-badge&label=google-spreadsheet&color=orange)

Discord Bot based on the `Discord.js` framework using `Node.js` to enable `/commands` for the game [Ark of War](https://www.7piratesgames.com/ark.html)
The bot itself is pretty basic and basically just follows along the [tutorial](https://discordjs.guide/) of the Discord.js framework.

## About

This is the 5th iteration of this bot by now. In the beginning it was "hacked together" (his words) by [Krylar](https://github.com/Krylar) and rewritten several times by me over the years.
Outside of the game itself, the bot is pretty useless, and even inside the game it has since outlived most of its usefulness.

The Bot lives in the Diplomacy of War Discord Server - one of the largest communities around the game (https://discord.gg/YMAhCNjkgp).

## Requirements

- Node.js
- I recommend using PM2

## Configuration

You will need to create several files and fill them out in order to use the bot.

config.json
```
{
    "clientId": "123456", # Your userID.
    "guildId": "123456", # Your ServerID.
	"channelId1": "123456", # Channel for Autoupdated Mopup info (Status).
	"channelId2": "123456" # Channel for Autoupdated Mopup info (Timer).
	"webhookUrl": "https://discord.com/api/webhooks/123456/blablablublala" # Webhook URL for Discord Notifications when the bot starts.
}
```

.env
```
TOKEN=YOURDISCORDBOTTOKENGOESHERE
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

Installing nvm, node & npm run:
```
# Download and install nvm:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# Download and install Node.js:
nvm install 22

# Verify the Node.js version:
node -v # Should print "v22.13.1".
nvm current # Should print "v22.13.1".

# Verify npm version:
npm -v # Should print "10.9.2".
```

Installing and starting the Bot
```
# dowload all the dependencies listed in the package.json
npm install

# actually start the bot
node .
```