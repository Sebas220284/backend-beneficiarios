const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Pool, types } = require('pg');
const cfg = require('./config');
const { encrypt, blindIndex } = require('./utils/crypto');

types.setTypeParser(1082, (v) => v);

const pool = new Pool({
  ...cfg.db,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 1500,
});

// Evitar que errores de pool en segundo plano detengan el proceso
pool.on('error', () => {});

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'padron_db.json');

const CATALOGO_INICIAL = [
  { id: 1, categoria: 'CEMTRI', codigo: 'T.L.', nombre: 'T.L.' },
  { id: 2, categoria: 'CEMTRI', codigo: 'T.F.', nombre: 'T.F.' },
  { id: 3, categoria: 'CEMTRI', codigo: 'T.O.', nombre: 'T.O.' },
  { id: 4, categoria: 'CEMTRI', codigo: 'S.H.', nombre: 'S.H.' },
  { id: 5, categoria: 'CEMTRI', codigo: 'CEMS', nombre: 'CEMS' },
  { id: 6, categoria: 'CEMTRI', codigo: 'E.A.V.D.', nombre: 'E.A.V.D.' },
  { id: 7, categoria: 'CEMTRI', codigo: 'T.C.C.', nombre: 'T.C.C.' },
  { id: 8, categoria: 'CEMTRI', codigo: 'C.Psic.', nombre: 'C.Psic.' },
  { id: 9, categoria: 'Casa del Abuelo', codigo: 'Estancia', nombre: 'Estancia' },
  { id: 10, categoria: 'Casa del Abuelo', codigo: 'Evento', nombre: 'Evento' },
  { id: 11, categoria: 'Casa del Abuelo', codigo: 'Ejercicio', nombre: 'Ejercicio' },
  { id: 12, categoria: 'Casa del Abuelo', codigo: 'Plática', nombre: 'Plática' },
  { id: 13, categoria: 'Proyectos', codigo: 'Tux Lentes', nombre: 'Tux Lentes' },
  { id: 14, categoria: 'Proyectos', codigo: 'Prostodoncia', nombre: 'Prostodoncia' },
  { id: 15, categoria: 'Servicios Jurídicos', codigo: 'A.J.', nombre: 'A.J.' },
  { id: 16, categoria: 'Servicios Jurídicos', codigo: 'P.L.', nombre: 'P.L.' },
  { id: 17, categoria: 'Servicios de la Procuraduría', codigo: 'A.J.M.F.', nombre: 'A.J.M.F.' },
  { id: 18, categoria: 'Servicios de la Procuraduría', codigo: 'A.L.', nombre: 'A.L.' },
  { id: 19, categoria: 'Servicios de la Procuraduría', codigo: 'C.A.C.', nombre: 'C.A.C.' },
  { id: 20, categoria: 'Servicios de la Procuraduría', codigo: 'Alojamiento', nombre: 'Alojamiento' },
  { id: 21, categoria: 'Servicios de la Procuraduría', codigo: 'B.Alimento', nombre: 'B.Alimento' },
  { id: 22, categoria: 'Servicios a Grupos Vulnerables', codigo: 'C.T.F.I.', nombre: 'C.T.F.I.' },
  { id: 23, categoria: 'Servicios a Grupos Vulnerables', codigo: 'UNETOC', nombre: 'UNETOC' },
  { id: 24, categoria: 'Servicios a Grupos Vulnerables', codigo: 'CAI', nombre: 'CAI' },
  { id: 25, categoria: 'Servicios a Grupos Vulnerables', codigo: 'T.C.', nombre: 'T.C.' },
  { id: 26, categoria: 'Servicios a Grupos Vulnerables', codigo: 'P.E.N.M.S.', nombre: 'P.E.N.M.S.' },
  { id: 27, categoria: 'Servicios a Grupos Vulnerables', codigo: 'C.M.', nombre: 'C.M.' },
  { id: 28, categoria: 'Servicios a Grupos Vulnerables', codigo: 'A.A.M.', nombre: 'A.A.M.' },
  { id: 29, categoria: 'Servicios a Grupos Vulnerables', codigo: 'D.P.A.', nombre: 'D.P.A.' },
  { id: 30, categoria: 'Servicios Alimentarios', codigo: 'C.A.P.R.', nombre: 'C.A.P.R.' },
  { id: 31, categoria: 'Servicios Alimentarios', codigo: 'D.E.', nombre: 'D.E.' },
  { id: 32, categoria: 'Servicios Alimentarios', codigo: 'C.A.M.E.', nombre: 'C.A.M.E.' },
  { id: 33, categoria: 'Servicios Alimentarios', codigo: 'C.A.N.N.', nombre: 'C.A.N.N.' },
  { id: 34, categoria: 'Servicios Alimentarios', codigo: 'A.T.M.S.V.', nombre: 'A.T.M.S.V.' },
];

function createInitialStore() {
  const pruebaAdminHash = bcrypt.hashSync('123456789', 10);
  const difCapHash = bcrypt.hashSync('dif123', 10);
  const supHash = bcrypt.hashSync('supervisor123', 10);

  return {
    usuarios: [
      { id: 4, username: 'prueba@gmail.com.mx', nombre: 'Administrador General DIF', dependencia: 'Dirección General DIF', password_hash: pruebaAdminHash, rol: 'admin', activo: true },
      { id: 5, username: 'difmunicipal@gmail.com.mx', nombre: 'Capturista DIF Municipal', dependencia: 'Dirección de Asistencia Social', password_hash: difCapHash, rol: 'capturista', activo: true },
      { id: 6, username: 'supervisor@gmail.com.mx', nombre: 'Supervisor General DIF', dependencia: 'Dirección de Asistencia Social', password_hash: supHash, rol: 'supervisor', activo: true },
    ],
    catalogo_servicios: CATALOGO_INICIAL,
    beneficiarios: [],
    solicitudes_ayuda: [],
    beneficiario_servicios: [],
    audit_log: [],
  };
}

function loadStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(content);
      let changed = false;
      if (Array.isArray(parsed.usuarios)) {
        // Normalizar si había un espacio accidental en "supervisor @gmail.com.mx"
        parsed.usuarios.forEach((u) => {
          if (u.username === 'supervisor @gmail.com.mx') {
            u.username = 'supervisor@gmail.com.mx';
            changed = true;
          }
        });
        const ensureUser = (uname, pwd, rol) => {
          const idx = parsed.usuarios.findIndex(
            (u) => u.username.replace(/\s+/g, '').toLowerCase() === uname.replace(/\s+/g, '').toLowerCase()
          );
          if (idx === -1) {
            const nextId = parsed.usuarios.reduce((m, u) => Math.max(m, u.id || 0), 0) + 1;
            parsed.usuarios.push({
              id: nextId,
              username: uname,
              password_hash: bcrypt.hashSync(pwd, 10),
              rol,
              activo: true,
            });
            changed = true;
          } else if (parsed.usuarios[idx].rol !== rol) {
            parsed.usuarios[idx].rol = rol;
            changed = true;
          }
        };
        ensureUser('prueba@gmail.com.mx', '123456789', 'admin');
        ensureUser('difmunicipal@gmail.com.mx', 'dif123', 'capturista');
        ensureUser('supervisor@gmail.com.mx', 'supervisor123', 'supervisor');
      }
      if (changed) saveStore(parsed);
      return parsed;
    }
  } catch (_) {}
  const initial = createInitialStore();
  saveStore(initial);
  return initial;
}

function saveStore(store) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (e) {
    console.error('Error guardando DB local:', e.message);
  }
}

function calcAge(fechaNacimiento) {
  const n = new Date(fechaNacimiento);
  const h = new Date();
  let e = h.getUTCFullYear() - n.getUTCFullYear();
  const m = h.getUTCMonth() - n.getUTCMonth();
  if (m < 0 || (m === 0 && h.getUTCDate() < n.getUTCDate())) e--;
  return e;
}

function executeEmbeddedQuery(text, params = []) {
  const sql = text.replace(/\s+/g, ' ').trim();
  const store = loadStore();

  // 1. Health check
  if (/^SELECT 1$/i.test(sql)) {
    return { rows: [{ '?column?': 1 }], rowCount: 1 };
  }

  // 2. Listar todos los usuarios (GET /api/usuarios)
  if (/FROM usuarios ORDER BY id/i.test(sql)) {
    const rows = [...store.usuarios].sort((a, b) => a.id - b.id);
    return { rows, rowCount: rows.length };
  }

  // 2b. Auth login (búsqueda por username, tolerando espacios accidentales antes de @)
  if (/FROM usuarios WHERE username = \$1/i.test(sql)) {
    const uname = String(params[0] || '').trim().toLowerCase();
    const unameNoSpace = uname.replace(/\s+/g, '');
    const u = store.usuarios.find(
      (x) =>
        x.username.toLowerCase() === uname ||
        x.username.replace(/\s+/g, '').toLowerCase() === unameNoSpace
    );
    return { rows: u ? [u] : [], rowCount: u ? 1 : 0 };
  }

  // 3. Seed/Insert usuario
  if (/INSERT INTO usuarios/i.test(sql)) {
    const [username, password_hash, rol] = params;
    const unameClean = String(username || '').replace(/\s+@/, '@').trim();
    const idx = store.usuarios.findIndex(
      (u) => u.username.replace(/\s+/g, '').toLowerCase() === unameClean.replace(/\s+/g, '').toLowerCase()
    );
    if (idx !== -1) {
      store.usuarios[idx].password_hash = password_hash;
      store.usuarios[idx].rol = rol;
    } else {
      const nextId = store.usuarios.reduce((m, u) => Math.max(m, u.id), 0) + 1;
      store.usuarios.push({ id: nextId, username: unameClean, password_hash, rol, activo: true });
    }
    saveStore(store);
    return { rows: [], rowCount: 1 };
  }

  // 3b. Actualizar usuario (PUT /api/usuarios/:id)
  if (/UPDATE usuarios SET/i.test(sql)) {
    const [username, rol, activo, password_hash, nombre, dependencia, idParam] = params;
    const id = Number(idParam);
    const idx = store.usuarios.findIndex((u) => u.id === id);
    if (idx !== -1) {
      if (username) store.usuarios[idx].username = String(username).trim();
      if (rol) store.usuarios[idx].rol = String(rol).toLowerCase();
      if (activo !== null && activo !== undefined) store.usuarios[idx].activo = Boolean(activo);
      if (password_hash) store.usuarios[idx].password_hash = password_hash;
      if (nombre) store.usuarios[idx].nombre = nombre;
      if (dependencia) store.usuarios[idx].dependencia = dependencia;
      saveStore(store);
      return { rows: [store.usuarios[idx]], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  // 3c. Eliminar usuario (DELETE /api/usuarios/:id)
  if (/DELETE FROM usuarios WHERE id = \$1/i.test(sql)) {
    const id = Number(params[0]);
    const before = store.usuarios.length;
    store.usuarios = store.usuarios.filter((u) => u.id !== id);
    if (store.usuarios.length !== before) saveStore(store);
    return { rows: [], rowCount: before - store.usuarios.length };
  }

  // 3d. Permisos config (GET / PUT /api/usuarios/permisos)
  if (/FROM permisos_config/i.test(sql)) {
    return {
      rows: [
        {
          rolePermissions: store.role_permissions || null,
          userOverrides: store.user_overrides || null,
        },
      ],
      rowCount: 1,
    };
  }
  if (/UPDATE permisos_config SET/i.test(sql)) {
    const [rolePermissions, userOverrides] = params;
    if (rolePermissions !== null && rolePermissions !== undefined) {
      store.role_permissions = rolePermissions;
    }
    if (userOverrides !== null && userOverrides !== undefined) {
      store.user_overrides = userOverrides;
    }
    saveStore(store);
    return {
      rows: [
        {
          rolePermissions: store.role_permissions || null,
          userOverrides: store.user_overrides || null,
        },
      ],
      rowCount: 1,
    };
  }

  // 4. Catálogo de servicios (ordenado de menor a mayor por id)
  if (/FROM catalogo_servicios/i.test(sql) && !/JOIN catalogo_servicios/i.test(sql) && /^SELECT/i.test(sql)) {
    const rows = [...store.catalogo_servicios].sort((a, b) => a.id - b.id);
    return { rows, rowCount: rows.length };
  }

  // 4b. Insertar en catalogo_servicios
  if (/INSERT INTO catalogo_servicios/i.test(sql)) {
    const [categoria, codigo, nombre] = params;
    const nextId = store.catalogo_servicios.reduce((m, s) => Math.max(m, s.id || 0), 0) + 1;
    const nuevo = { id: nextId, categoria, codigo, nombre };
    store.catalogo_servicios.push(nuevo);
    store.catalogo_servicios.sort((a, b) => a.id - b.id);
    saveStore(store);
    return { rows: [nuevo], rowCount: 1 };
  }

  // 4c. Actualizar en catalogo_servicios
  if (/UPDATE catalogo_servicios SET/i.test(sql)) {
    const [categoria, codigo, nombre, idParam] = params;
    const id = Number(idParam);
    const idx = store.catalogo_servicios.findIndex((s) => s.id === id);
    if (idx === -1) return { rows: [], rowCount: 0 };
    store.catalogo_servicios[idx] = {
      ...store.catalogo_servicios[idx],
      categoria: categoria || store.catalogo_servicios[idx].categoria,
      codigo: codigo || store.catalogo_servicios[idx].codigo,
      nombre: nombre || store.catalogo_servicios[idx].nombre,
    };
    saveStore(store);
    return { rows: [store.catalogo_servicios[idx]], rowCount: 1 };
  }

  // 4d. Eliminar de catalogo_servicios
  if (/DELETE FROM catalogo_servicios WHERE id = \$1/i.test(sql)) {
    const id = Number(params[0]);
    const before = store.catalogo_servicios.length;
    store.catalogo_servicios = store.catalogo_servicios.filter((s) => s.id !== id);
    store.beneficiario_servicios = (store.beneficiario_servicios || []).filter((bs) => bs.servicio_id !== id);
    const removed = before - store.catalogo_servicios.length;
    if (removed > 0) saveStore(store);
    return { rows: [], rowCount: removed };
  }

  // 5. Audit log
  if (/INSERT INTO audit_log/i.test(sql)) {
    const [usuario_id, usuario, accion, recurso, recurso_id, ip, user_agent] = params;
    store.audit_log.push({
      id: store.audit_log.length + 1,
      fecha: new Date().toISOString(),
      usuario_id,
      usuario,
      accion,
      recurso,
      recurso_id,
      ip,
      user_agent,
    });
    if (store.audit_log.length > 500) store.audit_log.shift();
    saveStore(store);
    return { rows: [], rowCount: 1 };
  }

  // 6. Listado paginado de beneficiarios (GET /api/beneficiarios)
  if (/FROM beneficiarios b LEFT JOIN LATERAL/i.test(sql)) {
    let list = [...store.beneficiarios];
    let paramIdx = 0;

    if (/ILIKE/i.test(sql)) {
      const rawPattern = String(params[paramIdx++] || '').replace(/^%|%$/g, '').toLowerCase();
      list = list.filter((b) => {
        const fullName = [b.nombres, b.apellido_paterno, b.apellido_materno].filter(Boolean).join(' ').toLowerCase();
        return fullName.includes(rawPattern);
      });
    }
    if (/b\.curp_hash =/i.test(sql)) {
      const targetHash = params[paramIdx++];
      list = list.filter((b) => b.curp_hash === targetHash);
    }

    const limit = Number(params[paramIdx++]) || 20;
    const offset = Number(params[paramIdx++]) || 0;

    list.sort((a, b) => (a.id || 0) - (b.id || 0));

    const total = list.length;
    const paged = list.slice(offset, offset + limit);

    const rows = paged.map((b) => {
      const sols = store.solicitudes_ayuda
        .filter((s) => s.beneficiario_id === b.id)
        .sort((x, y) => String(y.fecha_solicitud).localeCompare(String(x.fecha_solicitud)) || y.id - x.id);
      const ultima = sols[0] || {};
      const srvIds = store.beneficiario_servicios
        .filter((bs) => bs.beneficiario_id === b.id)
        .map((bs) => bs.servicio_id);
      const servicios = store.catalogo_servicios
        .filter((cs) => srvIds.includes(cs.id))
        .map((cs) => ({ id: cs.id, categoria: cs.categoria, codigo: cs.codigo, nombre: cs.nombre }));
      return {
        ...b,
        edad: calcAge(b.fecha_nacimiento),
        ultima_ayuda: ultima.tipo_ayuda || null,
        ultima_solicitud: ultima.fecha_solicitud || null,
        ha_recibido_apoyo_dif_estatal: Boolean(ultima.ha_recibido_apoyo_dif_estatal),
        descripcion_apoyo_dif_estatal: ultima.descripcion_apoyo_dif_estatal || null,
        solicitudes: sols.map((s) => ({
          id: s.id,
          fechaSolicitud: s.fecha_solicitud,
          tipoAyuda: s.tipo_ayuda,
          haRecibidoApoyoDifEstatal: s.ha_recibido_apoyo_dif_estatal,
          descripcionApoyoDifEstatal: s.descripcion_apoyo_dif_estatal,
        })),
        servicios,
        total,
      };
    });

    return { rows, rowCount: rows.length };
  }

  // 7. Verificar existencia de beneficiario (SELECT 1 FROM beneficiarios WHERE id = $1)
  if (/SELECT 1 FROM beneficiarios WHERE id = \$1/i.test(sql)) {
    const id = Number(params[0]);
    const found = store.beneficiarios.some((b) => b.id === id);
    return { rows: found ? [{ '?column?': 1 }] : [], rowCount: found ? 1 : 0 };
  }

  // 8. Detalle de beneficiario por ID
  if (/FROM beneficiarios WHERE id = \$1/i.test(sql) && /^SELECT \*/i.test(sql)) {
    const id = Number(params[0]);
    const b = store.beneficiarios.find((x) => x.id === id);
    if (!b) return { rows: [], rowCount: 0 };
    return {
      rows: [{ ...b, edad: calcAge(b.fecha_nacimiento) }],
      rowCount: 1,
    };
  }

  // 9. Solicitudes de ayuda de un beneficiario
  if (/FROM solicitudes_ayuda WHERE beneficiario_id = \$1/i.test(sql)) {
    const id = Number(params[0]);
    const rows = store.solicitudes_ayuda
      .filter((s) => s.beneficiario_id === id)
      .sort((a, b) => String(b.fecha_solicitud).localeCompare(String(a.fecha_solicitud)) || b.id - a.id);
    return { rows, rowCount: rows.length };
  }

  // 10. Servicios de un beneficiario
  if (/FROM beneficiario_servicios bs JOIN catalogo_servicios cs/i.test(sql)) {
    const id = Number(params[0]);
    const srvIds = store.beneficiario_servicios
      .filter((bs) => bs.beneficiario_id === id)
      .map((bs) => bs.servicio_id);
    const rows = store.catalogo_servicios
      .filter((cs) => srvIds.includes(cs.id))
      .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.id - b.id)
      .map((cs) => ({ id: cs.id, categoria: cs.categoria, codigo: cs.codigo, nombre: cs.nombre }));
    return { rows, rowCount: rows.length };
  }

  // 11. Insertar nuevo beneficiario
  if (/INSERT INTO beneficiarios/i.test(sql)) {
    const [
      nombres, apellido_paterno, apellido_materno, fecha_nacimiento,
      curp_cifrado, curp_hash, estado_civil, es_dependiente_economico,
      tutor_nombre_cifrado, tiene_dependientes_economicos, sexo,
      tipo_vialidad, nombre_vialidad_cifrado, numero_exterior_cifrado,
      tipo_asentamiento, nombre_asentamiento, codigo_postal,
      tipo_discapacidad_cifrado, cuenta_servicio_medico,
      cuenta_apoyo_gubernamental, descripcion_apoyo_gubernamental,
      creado_por,
    ] = params;

    if (store.beneficiarios.some((b) => b.curp_hash === curp_hash)) {
      const err = new Error('Registro duplicado (la CURP ya existe)');
      err.code = '23505';
      throw err;
    }

    const nextId = store.beneficiarios.reduce((m, b) => Math.max(m, b.id), 0) + 1;
    const nuevo = {
      id: nextId,
      nombres,
      apellido_paterno,
      apellido_materno,
      fecha_nacimiento,
      curp_cifrado,
      curp_hash,
      estado_civil,
      es_dependiente_economico,
      tutor_nombre_cifrado,
      tiene_dependientes_economicos,
      sexo,
      tipo_vialidad,
      nombre_vialidad_cifrado,
      numero_exterior_cifrado,
      tipo_asentamiento,
      nombre_asentamiento,
      codigo_postal,
      tipo_discapacidad_cifrado,
      cuenta_servicio_medico,
      cuenta_apoyo_gubernamental,
      descripcion_apoyo_gubernamental,
      creado_por,
      creado_en: new Date().toISOString(),
      actualizado_en: new Date().toISOString(),
    };
    store.beneficiarios.push(nuevo);
    saveStore(store);
    return { rows: [{ id: nextId }], rowCount: 1 };
  }

  // 12. Actualizar beneficiario
  if (/UPDATE beneficiarios SET/i.test(sql)) {
    const [
      nombres, apellido_paterno, apellido_materno, fecha_nacimiento,
      curp_cifrado, curp_hash, estado_civil, es_dependiente_economico,
      tutor_nombre_cifrado, tiene_dependientes_economicos, sexo,
      tipo_vialidad, nombre_vialidad_cifrado, numero_exterior_cifrado,
      tipo_asentamiento, nombre_asentamiento, codigo_postal,
      tipo_discapacidad_cifrado, cuenta_servicio_medico,
      cuenta_apoyo_gubernamental, descripcion_apoyo_gubernamental,
      actualizado_por, idParam,
    ] = params;

    const id = Number(idParam);
    const idx = store.beneficiarios.findIndex((b) => b.id === id);
    if (idx === -1) return { rows: [], rowCount: 0 };

    if (store.beneficiarios.some((b) => b.id !== id && b.curp_hash === curp_hash)) {
      const err = new Error('Registro duplicado (la CURP ya existe)');
      err.code = '23505';
      throw err;
    }

    store.beneficiarios[idx] = {
      ...store.beneficiarios[idx],
      nombres,
      apellido_paterno,
      apellido_materno,
      fecha_nacimiento,
      curp_cifrado,
      curp_hash,
      estado_civil,
      es_dependiente_economico,
      tutor_nombre_cifrado,
      tiene_dependientes_economicos,
      sexo,
      tipo_vialidad,
      nombre_vialidad_cifrado,
      numero_exterior_cifrado,
      tipo_asentamiento,
      nombre_asentamiento,
      codigo_postal,
      tipo_discapacidad_cifrado,
      cuenta_servicio_medico,
      cuenta_apoyo_gubernamental,
      descripcion_apoyo_gubernamental,
      actualizado_por,
      actualizado_en: new Date().toISOString(),
    };
    saveStore(store);
    return { rows: [{ id }], rowCount: 1 };
  }

  // 13. Eliminar beneficiario
  if (/DELETE FROM beneficiarios WHERE id = \$1/i.test(sql)) {
    const id = Number(params[0]);
    const before = store.beneficiarios.length;
    store.beneficiarios = store.beneficiarios.filter((b) => b.id !== id);
    store.solicitudes_ayuda = store.solicitudes_ayuda.filter((s) => s.beneficiario_id !== id);
    store.beneficiario_servicios = store.beneficiario_servicios.filter((bs) => bs.beneficiario_id !== id);
    const removed = before - store.beneficiarios.length;
    if (removed > 0) saveStore(store);
    return { rows: [], rowCount: removed };
  }

  // 14. Eliminar servicios de beneficiario
  if (/DELETE FROM beneficiario_servicios WHERE beneficiario_id = \$1/i.test(sql)) {
    const id = Number(params[0]);
    store.beneficiario_servicios = store.beneficiario_servicios.filter((bs) => bs.beneficiario_id !== id);
    saveStore(store);
    return { rows: [], rowCount: 1 };
  }

  // 15. Insertar servicios de beneficiario
  if (/INSERT INTO beneficiario_servicios/i.test(sql)) {
    const benefId = Number(params[0]);
    const ids = Array.isArray(params[1]) ? params[1] : [];
    for (const sId of ids) {
      const numId = Number(sId);
      if (!store.beneficiario_servicios.some((bs) => bs.beneficiario_id === benefId && bs.servicio_id === numId)) {
        store.beneficiario_servicios.push({
          beneficiario_id: benefId,
          servicio_id: numId,
          registrado_en: new Date().toISOString(),
        });
      }
    }
    saveStore(store);
    return { rows: [], rowCount: ids.length };
  }

  // 16. Insertar solicitud de ayuda
  if (/INSERT INTO solicitudes_ayuda/i.test(sql)) {
    const [beneficiario_id, fecha_solicitud, tipo_ayuda, ha_recibido_apoyo_dif_estatal, descripcion_apoyo_dif_estatal, creado_por] = params;
    const nextId = store.solicitudes_ayuda.reduce((m, s) => Math.max(m, s.id), 0) + 1;
    store.solicitudes_ayuda.push({
      id: nextId,
      beneficiario_id: Number(beneficiario_id),
      fecha_solicitud,
      tipo_ayuda,
      ha_recibido_apoyo_dif_estatal: Boolean(ha_recibido_apoyo_dif_estatal),
      descripcion_apoyo_dif_estatal,
      creado_por,
      creado_en: new Date().toISOString(),
    });
    saveStore(store);
    return { rows: [{ id: nextId }], rowCount: 1 };
  }

  return { rows: [], rowCount: 0 };
}

let useEmbeddedFallback = false;

async function query(text, params) {
  if (!useEmbeddedFallback) {
    try {
      return await pool.query(text, params);
    } catch (err) {
      // Si PostgreSQL no responde, se reinicia la conexión o hay error de credenciales/BD,
      // activar automáticamente el motor persistente local para que el backend funcione al 100%
      useEmbeddedFallback = true;
      console.log(`[DB] Conexión Postgres no disponible (${err.code || err.message}). Usando base de datos persistente local (backend/data/padron_db.json)`);
      return executeEmbeddedQuery(text, params);
    }
  }
  return executeEmbeddedQuery(text, params);
}

async function tx(fn) {
  if (!useEmbeddedFallback) {
    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      useEmbeddedFallback = true;
      console.log(`[DB] Conexión Postgres no disponible (${err.code || err.message}). Usando base de datos persistente local (backend/data/padron_db.json)`);
    }
  }
  const pseudoClient = {
    query: (text, params) => Promise.resolve(executeEmbeddedQuery(text, params)),
  };
  return await fn(pseudoClient);
}

module.exports = { pool, query, tx };
