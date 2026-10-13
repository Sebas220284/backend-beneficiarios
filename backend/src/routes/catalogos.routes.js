const router = require('express').Router();
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

router.get('/servicios', authenticate, async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT id, categoria, codigo, nombre FROM catalogo_servicios ORDER BY categoria, id'
    );
    const agrupado = {};
    for (const r of rows) (agrupado[r.categoria] ||= []).push({ id: r.id, codigo: r.codigo, nombre: r.nombre });
    res.json(agrupado);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
