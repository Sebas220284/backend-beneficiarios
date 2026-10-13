const jwt = require('jsonwebtoken');
const cfg = require('../config');

function authenticate(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  try {
    req.user = jwt.verify(token, cfg.jwtSecret, { algorithms: ['HS256'] });
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

const authorize = (...roles) => (req, res, next) =>
  roles.includes(req.user?.rol) ? next() : res.status(403).json({ error: 'Sin permisos' });

module.exports = { authenticate, authorize };
