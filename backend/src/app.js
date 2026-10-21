const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const cfg = require('./config');
const { query } = require('./db');
const errorHandler = require('./middleware/errorHandler');

const app = express();



app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: cfg.corsOrigins.length ? cfg.corsOrigins : true }));
app.use(express.json({ limit: '100kb' }));
app.use(rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false }));

app.get('/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'db_error' });
  }
});

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/usuarios', require('./routes/usuarios.routes'));
app.use('/api/catalogos', require('./routes/catalogos.routes'));
app.use('/api/beneficiarios', require('./routes/beneficiarios.routes'));

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use(errorHandler);

module.exports = app;
