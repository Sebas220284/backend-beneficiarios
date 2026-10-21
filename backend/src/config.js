const fs = require('fs');
const path = require('path');

// Cargar automáticamente variables desde .env si existe
for (const envPath of [
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '..', '..', '.env'),
]) {
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const DEFAULTS = {
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_NAME: 'padron',
  DB_USER: 'postgres',
  DB_PASSWORD: 'postgres',
  JWT_SECRET: 'dif-tuxtla-gutierrez-secret-key-2026-2027-oficial-segura',
  DATA_ENC_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  DATA_HASH_KEY: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
};

const required = (name) => {
  const v = process.env[name] || DEFAULTS[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
};

const hexKey = (name) => {
  const v = required(name);
  if (!/^[0-9a-f]{64}$/i.test(v)) {
    throw new Error(`${name} debe ser hexadecimal de 64 caracteres (32 bytes)`);
  }
  return Buffer.from(v, 'hex');
};

const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < 32) throw new Error('JWT_SECRET debe tener al menos 32 caracteres');

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  db: {
    host: required('DB_HOST'),
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: required('DB_NAME'),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
  },
  jwtSecret,
  jwtExpires: process.env.JWT_EXPIRES || '24h',
  encKey: hexKey('DATA_ENC_KEY'),
  hashKey: hexKey('DATA_HASH_KEY'),
  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};
