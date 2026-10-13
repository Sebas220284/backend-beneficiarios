const bcrypt = require('bcryptjs');
const { pool } = require('../db');

(async () => {
  const [username, password, rol = 'admin'] = process.argv.slice(2);
  if (!username || !password || password.length < 12) {
    console.error('Uso: node src/scripts/seedAdmin.js <usuario> <contraseña (mín. 12)> [admin|capturista|consulta]');
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO usuarios (username, password_hash, rol) VALUES ($1,$2,$3)
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, rol = EXCLUDED.rol`,
    [username, hash, rol]
  );
  console.log(`Usuario "${username}" (${rol}) listo`);
  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
