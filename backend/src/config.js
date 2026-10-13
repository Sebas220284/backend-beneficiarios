const required = (name) => {
  const v = process.env[name];
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
  port: parseInt(process.env.PORT || '3000', 10),
  db: {
    host: required('DB_HOST'),
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: required('DB_NAME'),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
  },
  jwtSecret,
  jwtExpires: process.env.JWT_EXPIRES || '8h',
  encKey: hexKey('DATA_ENC_KEY'),
  hashKey: hexKey('DATA_HASH_KEY'),
  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};
