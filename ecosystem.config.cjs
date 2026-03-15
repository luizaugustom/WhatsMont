module.exports = {
  apps: [
    {
      name: 'whatsmont',
      script: 'src/server.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_restarts: 0,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
