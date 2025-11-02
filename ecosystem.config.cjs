/**
 * PM2 Ecosystem Configuration
 * Usage: pm2 start ecosystem.config.cjs
 */
module.exports = {
  apps: [
    {
      name: 'TC-Bot',
      script: './dist/tc-bot.js',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      listen_timeout: 10000,
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'production',
      },
      // Automatically rebuild TypeScript before starting
      // Uncomment the following if you want auto-rebuild with PM2:
      // pre_start_hook: 'npm run build',
    },
  ],
};
