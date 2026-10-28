const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const cfg = require('./config');
const { query } = require('./db');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

const allowedOrigins = [
  ...cfg.corsOrigins,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const isAllowed =
        cfg.corsOrigins.length === 0 ||
        allowedOrigins.includes(origin) ||
        /\.vercel\.app$/.test(origin) ||
        /\.railway\.app$/.test(origin);
      if (isAllowed) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  })
);
app.options('*', cors());

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

const authRoutes = require('./routes/auth.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
const catalogosRoutes = require('./routes/catalogos.routes');
const beneficiariosRoutes = require('./routes/beneficiarios.routes');

app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/catalogos', catalogosRoutes);
app.use('/api/beneficiarios', beneficiariosRoutes);

// Compatibilidad con llamadas sin prefijo /api
app.use('/auth', authRoutes);
app.use('/usuarios', usuariosRoutes);
app.use('/catalogos', catalogosRoutes);
app.use('/beneficiarios', beneficiariosRoutes);

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use(errorHandler);

module.exports = app;
