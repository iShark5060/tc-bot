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

**Current Version: 7.4.1** - Features TypeScript strict mode, automated testing with Vitest, CI/CD with GitHub Actions, and automated dependency updates with Dependabot.

## Requirements

- Node.js >= 25.0.0
- pnpm >= 10.0.0
- PM2 (recommended for production)

## Configuration

Use `.env.example` as your template:

```bash
cp .env.example .env.development
```

PowerShell equivalent:

```powershell
Copy-Item .env.example .env.development
```

Fill all required values in `.env.development`. At minimum, these are required for startup:

- `TOKEN`
- `CLIENT_ID`
- `GUILD_ID`
- `GOOGLE_SPREADSHEET_ID`
- `GOOGLE_SHEET_ID`

### dotenvx encrypted env files

This project supports encrypted env files with dotenvx.

1. Keep local plaintext env in `.env.development` (gitignored).
2. Encrypt environment files when ready:

   ```bash
   pnpm exec dotenvx encrypt -f .env.production
   pnpm exec dotenvx encrypt -f .env.development
   ```

3. Keep `.env.keys` private (never commit it - ensure it's in `.gitignore`).
4. Add GitHub secret for CI/deploy decryption:
   - `DOTENV_PRIVATE_KEY_PRODUCTION`

> The deploy workflow now reads build/test/typecheck/deploy env from `.env.production` via dotenvx.

### Google service account credentials

For Google Sheets access, provide `client_secret.json` in project root.

```json
{
  "type": "service_account",
  "project_id": "your_project_id",
  "private_key_id": "your_private_key_id",
  "private_key": "-----BEGIN PRIVATE KEY-----...-----END PRIVATE KEY-----\n",
  "client_email": "your@client.email",
  "client_id": "123456",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

Unless you have a copy of the Theorycrafters Google Sheet and valid API credentials, Healing/ITS features will not work.

## Running the App

up to date instructions are available here: https://nodejs.org/en/download

Installing nvm, node & pnpm:

```
# Download and install nvm:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# Download and install Node.js:
nvm install 25

# Verify the Node.js version:
node -v # Should print "v25.x.x".
nvm current # Should print "v25.x.x".

# Verify pnpm version:
pnpm -v # Should print "10.x.x".
```

Installing and starting the Bot

```
# download all the dependencies listed in the package.json
pnpm install

# build the TypeScript code
pnpm run build

# actually start the bot
pnpm start

# or start it with PM2 ecosystem file for better control
pm2 start ecosystem.config.cjs

# to deploy slash commands to Discord
pnpm run deploy

# for debug mode (verbose logging), add DEBUG=true to your .env.development file
# then run: pnpm run dev

# run tests
pnpm run test

# run tests in watch mode
pnpm run test:watch

# run tests with coverage
pnpm run test:coverage

# lint code
pnpm run lint

# format code
pnpm run format

# check code formatting
pnpm run check-format
```

## Development Workflow

### Local Development

1. Clone the repository
2. Install dependencies: `pnpm install`
3. Create `.env.development` file with required configuration (see Configuration section)
4. Create `client_secret.json` if using Google Sheets features
5. Build the project: `pnpm run build`
6. Deploy commands to Discord: `pnpm run deploy`
7. Start the bot: `pnpm start` or `pnpm run dev` (with watch mode)

### Testing

The project uses [Vitest](https://vitest.dev/) for unit testing. Tests are located in the `tests/` directory.

- Run all tests: `pnpm run test`
- Run tests in watch mode: `pnpm run test:watch`
- Generate coverage report: `pnpm run test:coverage`

### Code Quality

- **OxLint**: Code linting with `pnpm run lint`
- **OxFmt**: Code formatting with `pnpm run format`
- **TypeScript**: Strict mode enabled for better type safety

## CI/CD & Deployment

### Automated Deployment

The project uses GitHub Actions for automated deployment. When code is pushed to the `main` branch (or manually triggered), the workflow:

1. Builds the TypeScript code
2. Creates deployment package with all necessary files
3. Deploys to the server via SSH/rsync
4. Restarts the bot using PM2

**Protected Files**: The deployment preserves the following on the server:

- `logs/` - PM2 log files
- `data/` - SQLite database files

### Dependabot

[Dependabot](https://docs.github.com/en/code-security/dependabot) is configured to automatically:

- Check for pnpm dependency updates weekly
- Check for GitHub Actions updates weekly
- Create pull requests for minor and patch updates
- Ignore major version updates for critical packages (requires manual review)

See `.github/dependabot.yml` for configuration details.

### Manual Deployment

If you need to deploy manually:

```bash
# Build the project
pnpm run build

# Deploy commands to Discord
pnpm run deploy

# On the server, restart PM2
pm2 restart TC-Bot --update-env
```
