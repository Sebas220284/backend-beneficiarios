const { ZodError } = require('zod');

module.exports = (err, req, res, next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Datos inválidos',
      detalles: err.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
    });
  }
  if (err.code === '23505') return res.status(409).json({ error: 'Registro duplicado (la CURP ya existe)' });
  if (err.code === '23503') return res.status(400).json({ error: 'Referencia inválida' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });

  console.error('Error:', err.message, err.stack || '');
  res.status(500).json({
    error: 'Error interno del servidor',
    detalle: err.message,
    codigo: err.code || undefined,
  });
};
