const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

function formatUsuarioRow(u) {
  const uname = String(u.username || '').trim().replace(/\s+@\s*/g, '@');
  const rol = (u.rol || 'capturista').toLowerCase();
  const defaultNombre =
    uname === 'prueba@gmail.com.mx'
      ? 'Administrador General DIF'
      : uname === 'difmunicipal@gmail.com.mx'
      ? 'Capturista DIF Municipal'
      : uname === 'supervisor@gmail.com.mx'
      ? 'Supervisor General DIF'
      : u.nombre || uname;
  const defaultDep =
    u.dependencia ||
    (rol === 'admin'
      ? 'Dirección General DIF'
      : rol === 'supervisor'
      ? 'Dirección de Asistencia Social'
      : 'Coordinación de Salud y CEMTRI');

  return {
    id: u.id,
    nombre: u.nombre || defaultNombre,
    usuario: uname,
    username: uname,
    rol,
    dependencia: defaultDep,
    activo: u.activo !== false,
    fecha_registro: u.creado_en ? new Date(u.creado_en).toLocaleDateString('es-MX') : '20/10/2026',
  };
}

// GET /api/usuarios/permisos — Obtener configuración de permisos por rol y excepciones por usuario
router.get('/permisos', authorize('admin', 'supervisor', 'capturista', 'consulta'), async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM permisos_config');
    res.json(rows[0] || { rolePermissions: null, userOverrides: null });
  } catch (e) {
    next(e);
  }
});

// PUT /api/usuarios/permisos — Guardar configuración de permisos en la base de datos
router.put('/permisos', authorize('admin'), async (req, res, next) => {
  try {
    const { rolePermissions, userOverrides } = req.body || {};
    const { rows } = await query('UPDATE permisos_config SET role_permissions = $1, user_overrides = $2', [
      rolePermissions || null,
      userOverrides || null,
    ]);
    res.json(rows[0] || { ok: true });
  } catch (e) {
    next(e);
  }
});

// GET /api/usuarios — Lista todos los usuarios reales de la base de datos
router.get('/', authorize('admin', 'supervisor'), async (req, res, next) => {
  try {
    const { rows } = await query('SELECT id, username, rol, activo FROM usuarios ORDER BY id');
    res.json(rows.map(formatUsuarioRow));
  } catch (e) {
    next(e);
  }
});

// POST /api/usuarios — Crear usuario en la base de datos
router.post('/', authorize('admin'), async (req, res, next) => {
  try {
    const username = String(req.body.usuario || req.body.username || '').trim();
    const password = String(req.body.password || 'dif123456').trim();
    const rol = String(req.body.rol || 'capturista').toLowerCase();
    const nombre = String(req.body.nombre || username).trim();
    const dependencia = String(req.body.dependencia || 'Dirección de Asistencia Social').trim();
    const activo = req.body.activo !== false;

    if (!username) return res.status(400).json({ error: 'El nombre de usuario es obligatorio' });

    const hash = await bcrypt.hash(password, 10);
    await query(
      `INSERT INTO usuarios (username, password_hash, rol) VALUES ($1,$2,$3)
       ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, rol = EXCLUDED.rol`,
      [username, hash, rol]
    );
    const { rows } = await query(
      'SELECT id, username, password_hash, rol, activo FROM usuarios WHERE username = $1',
      [username]
    );
    const created = rows[0] || { id: Date.now(), username, rol, activo };
    res.status(201).json(formatUsuarioRow({ ...created, nombre, dependencia, activo }));
  } catch (e) {
    next(e);
  }
});

// PUT /api/usuarios/:id — Actualizar usuario o contraseña en la base de datos
router.put('/:id', authorize('admin'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { usuario, username, password, rol, activo, nombre, dependencia } = req.body;
    const newHash = password && String(password).trim() ? await bcrypt.hash(String(password).trim(), 10) : null;

    await query('UPDATE usuarios SET username = $1, rol = $2, activo = $3, password_hash = $4, nombre = $5, dependencia = $6 WHERE id = $7', [
      usuario || username || null,
      rol || null,
      activo !== undefined ? Boolean(activo) : null,
      newHash,
      nombre || null,
      dependencia || null,
      id,
    ]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// DELETE /api/usuarios/:id — Eliminar usuario de la base de datos
router.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await query('DELETE FROM usuarios WHERE id = $1', [id]);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

module.exports = router;
