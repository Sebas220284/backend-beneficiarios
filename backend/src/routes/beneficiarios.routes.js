const router = require('express').Router();
const { z } = require('zod');
const { query, tx } = require('../db');
const { encrypt, decrypt, blindIndex, maskCurp } = require('../utils/crypto');
const { authenticate, authorize } = require('../middleware/auth');
const { audit } = require('../middleware/audit');

router.use(authenticate);

const CURP_RE = /^[A-Z]{4}\d{6}[HM][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z0-9]\d$/;
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato esperado: YYYY-MM-DD');
const txt = (max = 150) => z.string().trim().min(1).max(max);
const txtOpt = (max = 150) => z.string().trim().max(max).nullish();

const calcEdad = (f) => {
  const n = new Date(f);
  const h = new Date();
  let e = h.getUTCFullYear() - n.getUTCFullYear();
  const m = h.getUTCMonth() - n.getUTCMonth();
  if (m < 0 || (m === 0 && h.getUTCDate() < n.getUTCDate())) e--;
  return e;
};

const ayudaSchema = z.object({
  fechaSolicitud: fecha,
  tipoAyuda: txt(100),
  haRecibidoApoyoDifEstatal: z.boolean(),
  descripcionApoyoDifEstatal: txtOpt(300),
});

const beneficiarioSchema = z
  .object({
    nombres: txt(100),
    apellidoPaterno: txt(100),
    apellidoMaterno: txtOpt(100),
    fechaNacimiento: fecha,
    curp: z.string().trim().toUpperCase().regex(CURP_RE, 'CURP inválida'),
    estadoCivil: z.enum(['Soltero(a)', 'Casado(a)', 'Viudo(a)', 'Divorciado(a)', 'Unión libre', 'Separado(a)']),
    esDependienteEconomico: z.boolean(),
    tutorNombre: txtOpt(200),
    tieneDependientesEconomicos: z.boolean(),
    sexo: z.enum(['H', 'M']),
    domicilio: z.object({
      tipoVialidad: txt(50),
      nombreVialidad: txt(150),
      numeroExterior: txt(20),
      tipoAsentamiento: txt(50),
      nombreAsentamiento: txt(150),
      codigoPostal: z.string().regex(/^\d{5}$/, 'Debe tener 5 dígitos'),
    }),
    tipoDiscapacidad: txt(100),
    cuentaServicioMedico: z.boolean(),
    cuentaApoyoGubernamental: z.boolean(),
    descripcionApoyoGubernamental: txtOpt(300),
    servicios: z.array(z.number().int().positive()).max(50).default([]),
    ayuda: ayudaSchema.optional(),
  })
  .strict()
  .refine((d) => calcEdad(d.fechaNacimiento) >= 18 || !!d.tutorNombre, {
    path: ['tutorNombre'],
    message: 'Obligatorio para menores de edad',
  });

const idSchema = z.object({ id: z.coerce.number().int().positive() });

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
  q: z.string().trim().max(100).optional(),
  curp: z.string().trim().toUpperCase().regex(CURP_RE).optional(),
});

const COLS = [
  'nombres', 'apellido_paterno', 'apellido_materno', 'fecha_nacimiento',
  'curp_cifrado', 'curp_hash', 'estado_civil', 'es_dependiente_economico',
  'tutor_nombre_cifrado', 'tiene_dependientes_economicos', 'sexo',
  'tipo_vialidad', 'nombre_vialidad_cifrado', 'numero_exterior_cifrado',
  'tipo_asentamiento', 'nombre_asentamiento', 'codigo_postal',
  'tipo_discapacidad_cifrado', 'cuenta_servicio_medico',
  'cuenta_apoyo_gubernamental', 'descripcion_apoyo_gubernamental',
]; 
const values = (d) => [
  d.nombres, d.apellidoPaterno, d.apellidoMaterno ?? null, d.fechaNacimiento,
  encrypt(d.curp, 'benef.curp'), blindIndex(d.curp), d.estadoCivil, d.esDependienteEconomico,
  encrypt(d.tutorNombre, 'benef.tutor'), d.tieneDependientesEconomicos, d.sexo,
  d.domicilio.tipoVialidad, encrypt(d.domicilio.nombreVialidad, 'benef.vialidad'),
  encrypt(d.domicilio.numeroExterior, 'benef.numext'),
  d.domicilio.tipoAsentamiento, d.domicilio.nombreAsentamiento, d.domicilio.codigoPostal,
  encrypt(d.tipoDiscapacidad, 'benef.discapacidad'), d.cuentaServicioMedico,
  d.cuentaApoyoGubernamental, d.descripcionApoyoGubernamental ?? null,
];

async function setServicios(c, id, ids) {
  await c.query('DELETE FROM beneficiario_servicios WHERE beneficiario_id = $1', [id]);
  if (ids.length) {
    await c.query(
      `INSERT INTO beneficiario_servicios (beneficiario_id, servicio_id)
       SELECT $1, UNNEST($2::int[]) ON CONFLICT DO NOTHING`,
      [id, ids]
    );
  }
}

async function insertAyuda(c, benefId, a, userId) {
  await c.query(
    `INSERT INTO solicitudes_ayuda
       (beneficiario_id, fecha_solicitud, tipo_ayuda, ha_recibido_apoyo_dif_estatal,
        descripcion_apoyo_dif_estatal, creado_por)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [benefId, a.fechaSolicitud, a.tipoAyuda, a.haRecibidoApoyoDifEstatal, a.descripcionApoyoDifEstatal ?? null, userId]
  );
}

function present(b, rol) {
  const full = rol !== 'consulta';
  const curp = decrypt(b.curp_cifrado, 'benef.curp');
  return {
    id: b.id,
    nombres: b.nombres,
    apellidoPaterno: b.apellido_paterno,
    apellidoMaterno: b.apellido_materno,
    fechaNacimiento: b.fecha_nacimiento,
    edad: b.edad,
    curp: full ? curp : maskCurp(curp),
    estadoCivil: b.estado_civil,
    esDependienteEconomico: b.es_dependiente_economico,
    tutorNombre: full ? decrypt(b.tutor_nombre_cifrado, 'benef.tutor') : null,
    tieneDependientesEconomicos: b.tiene_dependientes_economicos,
    sexo: b.sexo,
    domicilio: {
      tipoVialidad: b.tipo_vialidad,
      nombreVialidad: full ? decrypt(b.nombre_vialidad_cifrado, 'benef.vialidad') : null,
      numeroExterior: full ? decrypt(b.numero_exterior_cifrado, 'benef.numext') : null,
      tipoAsentamiento: b.tipo_asentamiento,
      nombreAsentamiento: b.nombre_asentamiento,
      codigoPostal: b.codigo_postal,
    },
    tipoDiscapacidad: full ? decrypt(b.tipo_discapacidad_cifrado, 'benef.discapacidad') : null,
    cuentaServicioMedico: b.cuenta_servicio_medico,
    cuentaApoyoGubernamental: b.cuenta_apoyo_gubernamental,
    descripcionApoyoGubernamental: b.descripcion_apoyo_gubernamental,
  };
}

router.get('/', authorize('admin', 'supervisor', 'capturista', 'consulta'), async (req, res, next) => {
  try {
    const { page, limit, q, curp } = listSchema.parse(req.query);
    const params = [];
    const where = [];

    if (q) {
      params.push(`%${q.replace(/[\\%_]/g, '\\$&')}%`);
      where.push(`(b.nombres || ' ' || b.apellido_paterno || ' ' || COALESCE(b.apellido_materno,'')) ILIKE $${params.length}`);
    }
    if (curp) {
      params.push(blindIndex(curp));
      where.push(`b.curp_hash = $${params.length}`);
    }
    params.push(limit, (page - 1) * limit);

    const { rows } = await query(
      `SELECT b.*,
              date_part('year', age(b.fecha_nacimiento))::int AS edad,
              s.tipo_ayuda AS ultima_ayuda, s.fecha_solicitud AS ultima_solicitud,
              s.ha_recibido_apoyo_dif_estatal, s.descripcion_apoyo_dif_estatal,
              COUNT(*) OVER()::int AS total
         FROM beneficiarios b
         LEFT JOIN LATERAL (
           SELECT tipo_ayuda, fecha_solicitud, ha_recibido_apoyo_dif_estatal, descripcion_apoyo_dif_estatal
             FROM solicitudes_ayuda
            WHERE beneficiario_id = b.id
            ORDER BY fecha_solicitud DESC, id DESC LIMIT 1
         ) s ON TRUE
         ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
         ORDER BY b.id ASC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    await audit(req, 'LISTAR', 'beneficiarios');
    res.json({
      page, limit,
      total: rows[0]?.total ?? 0,
      data: rows.map((r) => {
        const fullData = present(r, req.user.rol);
        return {
          ...fullData,
          nombre: [r.nombres, r.apellido_paterno, r.apellido_materno].filter(Boolean).join(' '),
          codigoPostal: r.codigo_postal,
          ultimaAyuda: r.ultima_ayuda,
          ultimaSolicitud: r.ultima_solicitud,
          haRecibidoApoyoDifEstatal: Boolean(r.ha_recibido_apoyo_dif_estatal),
          descripcionApoyoDifEstatal: r.descripcion_apoyo_dif_estatal || null,
          solicitudes: r.solicitudes || (r.ultima_ayuda ? [{
            fechaSolicitud: r.ultima_solicitud,
            tipoAyuda: r.ultima_ayuda,
            haRecibidoApoyoDifEstatal: Boolean(r.ha_recibido_apoyo_dif_estatal),
            descripcionApoyoDifEstatal: r.descripcion_apoyo_dif_estatal || null,
          }] : []),
          servicios: r.servicios || [],
        };
      }),
    });
  } catch (e) {
    next(e);
  }
});

router.get('/:id', authorize('admin', 'supervisor', 'capturista', 'consulta'), async (req, res, next) => {
  try {
    const { id } = idSchema.parse(req.params);
    const { rows } = await query(
      `SELECT *, date_part('year', age(fecha_nacimiento))::int AS edad
         FROM beneficiarios WHERE id = $1`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'No encontrado' });

    const [sol, srv] = await Promise.all([
      query(
        `SELECT id, fecha_solicitud, tipo_ayuda, ha_recibido_apoyo_dif_estatal, descripcion_apoyo_dif_estatal
           FROM solicitudes_ayuda WHERE beneficiario_id = $1 ORDER BY fecha_solicitud DESC, id DESC`,
        [id]
      ),
      query(
        `SELECT cs.id, cs.categoria, cs.codigo
           FROM beneficiario_servicios bs JOIN catalogo_servicios cs ON cs.id = bs.servicio_id
          WHERE bs.beneficiario_id = $1 ORDER BY cs.categoria, cs.id`,
        [id]
      ),
    ]);

    await audit(req, 'VER', 'beneficiarios', id);
    res.json({
      ...present(rows[0], req.user.rol),
      solicitudes: sol.rows.map((s) => ({
        id: s.id,
        fechaSolicitud: s.fecha_solicitud,
        tipoAyuda: s.tipo_ayuda,
        haRecibidoApoyoDifEstatal: s.ha_recibido_apoyo_dif_estatal,
        descripcionApoyoDifEstatal: s.descripcion_apoyo_dif_estatal,
      })),
      servicios: srv.rows,
    });
  } catch (e) {
    next(e);
  }
});

router.post('/', authorize('admin', 'supervisor', 'capturista'), async (req, res, next) => {
  try {
    const d = beneficiarioSchema.parse(req.body);
    if (!d.ayuda) return res.status(400).json({ error: 'Falta el objeto "ayuda" (solicitud inicial)' });

    const id = await tx(async (c) => {
      const cols = [...COLS, 'creado_por'];
      const ph = cols.map((_, i) => `$${i + 1}`).join(',');
      const r = await c.query(
        `INSERT INTO beneficiarios (${cols.join(',')}) VALUES (${ph}) RETURNING id`,
        [...values(d), req.user.sub]
      );
      const newId = r.rows[0].id;
      await insertAyuda(c, newId, d.ayuda, req.user.sub);
      await setServicios(c, newId, d.servicios);
      return newId;
    });

    await audit(req, 'CREAR', 'beneficiarios', id);
    res.status(201).json({ id });
  } catch (e) {
    next(e);
  }
});

router.put('/:id', authorize('admin', 'supervisor', 'capturista'), async (req, res, next) => {
  try {
    const { id } = idSchema.parse(req.params);
    const d = beneficiarioSchema.parse(req.body);

    const found = await tx(async (c) => {
      const set = COLS.map((col, i) => `${col} = $${i + 1}`).join(', ');
      const r = await c.query(
        `UPDATE beneficiarios SET ${set}, actualizado_por = $${COLS.length + 1}
          WHERE id = $${COLS.length + 2}`,
        [...values(d), req.user.sub, id]
      );
      if (!r.rowCount) return false;
      await setServicios(c, id, d.servicios);
      return true;
    });

    if (!found) return res.status(404).json({ error: 'No encontrado' });
    await audit(req, 'ACTUALIZAR', 'beneficiarios', id);
    res.json({ id });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/solicitudes', authorize('admin', 'supervisor', 'capturista'), async (req, res, next) => {
  try {
    const { id } = idSchema.parse(req.params);
    const a = ayudaSchema.parse(req.body);
    const ex = await query('SELECT 1 FROM beneficiarios WHERE id = $1', [id]);
    if (!ex.rowCount) return res.status(404).json({ error: 'No encontrado' });
    await tx((c) => insertAyuda(c, id, a, req.user.sub));
    await audit(req, 'NUEVA_SOLICITUD', 'beneficiarios', id);
    res.status(201).json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', authorize('admin', 'supervisor', 'capturista'), async (req, res, next) => {
  try {
    const { id } = idSchema.parse(req.params);
    const r = await query('DELETE FROM beneficiarios WHERE id = $1', [id]);
    if (!r.rowCount) return res.status(404).json({ error: 'No encontrado' });
    await audit(req, 'ELIMINAR', 'beneficiarios', id);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

module.exports = router;
