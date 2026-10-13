const { query } = require('../db');

async function audit(req, accion, recurso, recursoId = null, usuarioOverride = null) {
  try {
    await query(
      `INSERT INTO audit_log (usuario_id, usuario, accion, recurso, recurso_id, ip, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        req.user?.sub ?? null,
        req.user?.username ?? usuarioOverride,
        accion,
        recurso,
        recursoId,
        req.ip,
        (req.get('user-agent') || '').slice(0, 255),
      ]
    );
  } catch (e) {
    console.error('Error de auditoría:', e.message);
  }
}

module.exports = { audit };
