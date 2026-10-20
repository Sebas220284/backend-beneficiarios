const crypto = require('crypto');
const { encKey, hashKey } = require('../config');


function encrypt(plain, context) {
  if (plain === null || plain === undefined || plain === '') return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey, iv);
  cipher.setAAD(Buffer.from(context));
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

function decrypt(payload, context) {
  if (!payload) return null;
  const str = String(payload);
  if (!str.startsWith('v1:')) {
    // Si el dato fue insertado en texto plano en la BD, devolverlo sin lanzar error 500
    return str;
  }
  try {
    const [, iv, tag, data] = str.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', encKey, Buffer.from(iv, 'base64'));
    decipher.setAAD(Buffer.from(context));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(data, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch (err) {
    console.warn(`Aviso: No se pudo descifrar campo (${context}):`, err.message);
    return '******************';
  }
}

function blindIndex(value) {
  return crypto
    .createHmac('sha256', hashKey)
    .update(String(value).trim().toUpperCase())
    .digest('hex');
}

const maskCurp = (curp) => (curp ? curp.slice(0, 4) + '*'.repeat(14) : null);

module.exports = { encrypt, decrypt, blindIndex, maskCurp };
