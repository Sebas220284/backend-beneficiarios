const router = require('express').Router();
const { query } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/servicios', authenticate, async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT id, categoria, codigo, nombre FROM catalogo_servicios ORDER BY id ASC'
    );
    const agrupado = {};
    for (const r of rows) (agrupado[r.categoria] ||= []).push({ id: r.id, codigo: r.codigo, nombre: r.nombre, categoria: r.categoria });
    res.json(agrupado);
  } catch (e) {
    next(e);
  }
});

router.post('/servicios', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { codigo, nombre, categoria } = req.body || {};
    if (!codigo || !nombre) {
      return res.status(400).json({ error: 'Código y nombre son obligatorios' });
    }
    const { rows } = await query(
      'INSERT INTO catalogo_servicios (categoria, codigo, nombre) VALUES ($1, $2, $3) RETURNING id, categoria, codigo, nombre',
      [String(categoria || 'General').trim(), String(codigo).trim(), String(nombre).trim()]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.put('/servicios/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { codigo, nombre, categoria } = req.body || {};
    const { rows } = await query(
      'UPDATE catalogo_servicios SET categoria = $1, codigo = $2, nombre = $3 WHERE id = $4 RETURNING id, categoria, codigo, nombre',
      [String(categoria || 'General').trim(), String(codigo || '').trim(), String(nombre || '').trim(), id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Servicio no encontrado' });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.delete('/servicios/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rowCount } = await query('DELETE FROM catalogo_servicios WHERE id = $1', [id]);
    if (!rowCount) return res.status(404).json({ error: 'Servicio no encontrado' });
    res.json({ ok: true, id });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
