const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const cfg = require('../config');
const { query } = require('../db');
const { audit } = require('../middleware/audit');

const DUMMY_HASH = bcrypt.hashSync('dummy-password', 12); 

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos, intenta más tarde' },
});

const loginSchema = z.object({
  username: z.string().trim().min(1).max(50),
  password: z.string().min(1).max(200),
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { username, password } = loginSchema.parse(req.body);
    const { rows } = await query(
      'SELECT id, username, password_hash, rol, activo FROM usuarios WHERE username = $1',
      [username]
    );
    const u = rows[0];
    const ok = await bcrypt.compare(password, u ? u.password_hash : DUMMY_HASH);

    if (!u || !u.activo || !ok) {
      await audit(req, 'LOGIN_FALLIDO', 'usuarios', null, username);
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { sub: u.id, username: u.username, rol: u.rol },
      cfg.jwtSecret,
      { algorithm: 'HS256', expiresIn: cfg.jwtExpires }
    );
    await audit(req, 'LOGIN_OK', 'usuarios', u.id, username);
    res.json({ token, usuario: { id: u.id, username: u.username, rol: u.rol } });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
