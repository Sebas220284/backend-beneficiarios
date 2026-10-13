const cfg = require('./config');
const app = require('./app');
const { pool } = require('./db');

const server = app.listen(cfg.port, () => console.log(`API escuchando en puerto ${cfg.port}`));

const shutdown = () => server.close(() => pool.end().then(() => process.exit(0)));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
