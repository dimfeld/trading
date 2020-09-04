module.exports = {
  apps: [
    {
      name: 'stakes',
      script: '__sapper__/build',
      //interpreter: '/usr/local/lib/nodejs/node-v13.9.0-linux-x64/bin/node',
      env: {
        PG_URL: 'postgres://trading@localhost/trading',
        BIND_IP: '0.0.0.0',
        PORT: '3444',
      },
    },
  ],
};
