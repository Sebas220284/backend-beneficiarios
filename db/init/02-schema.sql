CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE sexo_enum AS ENUM ('H', 'M');
CREATE TYPE estado_civil_enum AS ENUM
  ('Soltero(a)', 'Casado(a)', 'Viudo(a)', 'Divorciado(a)', 'Unión libre', 'Separado(a)');
CREATE TYPE rol_enum AS ENUM ('admin', 'capturista', 'consulta');

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.actualizado_en = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE usuarios (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol           rol_enum NOT NULL DEFAULT 'consulta',
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE beneficiarios (
  id                              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombres                         TEXT NOT NULL,
  apellido_paterno                TEXT NOT NULL,
  apellido_materno                TEXT,
  fecha_nacimiento                DATE NOT NULL,   
  curp_cifrado                    TEXT NOT NULL,
  curp_hash                       CHAR(64) NOT NULL UNIQUE,
  estado_civil                    estado_civil_enum NOT NULL,
  es_dependiente_economico        BOOLEAN NOT NULL DEFAULT FALSE,
  tutor_nombre_cifrado            TEXT,         
  tiene_dependientes_economicos   BOOLEAN NOT NULL DEFAULT FALSE,
  sexo                            sexo_enum NOT NULL,
  -- Domicilio
  tipo_vialidad                   TEXT,
  nombre_vialidad_cifrado         TEXT,
  numero_exterior_cifrado         TEXT,
  tipo_asentamiento               TEXT,
  nombre_asentamiento             TEXT,
  codigo_postal                   CHAR(5) CHECK (codigo_postal ~ '^[0-9]{5}$'),
  -- Salud
  tipo_discapacidad_cifrado       TEXT,
  cuenta_servicio_medico          BOOLEAN NOT NULL DEFAULT FALSE,
  -- Apoyo gubernamental
  cuenta_apoyo_gubernamental      BOOLEAN NOT NULL DEFAULT FALSE,
  descripcion_apoyo_gubernamental TEXT,
  -- Control
  creado_por                      INTEGER REFERENCES usuarios(id),
  actualizado_por                 INTEGER REFERENCES usuarios(id),
  creado_en                       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_beneficiarios_updated
  BEFORE UPDATE ON beneficiarios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_benef_nombre ON beneficiarios (apellido_paterno, apellido_materno, nombres);
CREATE INDEX idx_benef_cp     ON beneficiarios (codigo_postal);

CREATE TABLE solicitudes_ayuda (
  id                             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  beneficiario_id                INTEGER NOT NULL REFERENCES beneficiarios(id) ON DELETE CASCADE,
  fecha_solicitud                DATE NOT NULL,
  tipo_ayuda                     TEXT NOT NULL,   -- Silla de ruedas, Andadera, etc.
  ha_recibido_apoyo_dif_estatal  BOOLEAN NOT NULL DEFAULT FALSE,
  descripcion_apoyo_dif_estatal  TEXT,
  creado_por                     INTEGER REFERENCES usuarios(id),
  creado_en                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_solic_benef ON solicitudes_ayuda (beneficiario_id);

CREATE TABLE catalogo_servicios (
  id        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  categoria TEXT NOT NULL,
  codigo    TEXT NOT NULL,
  nombre    TEXT NOT NULL,   
  UNIQUE (categoria, codigo)
);

CREATE TABLE beneficiario_servicios (
  beneficiario_id INTEGER NOT NULL REFERENCES beneficiarios(id) ON DELETE CASCADE,
  servicio_id     INTEGER NOT NULL REFERENCES catalogo_servicios(id),
  registrado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (beneficiario_id, servicio_id)
);
CREATE INDEX idx_bs_servicio ON beneficiario_servicios (servicio_id);

INSERT INTO catalogo_servicios (categoria, codigo, nombre) VALUES
  ('CEMTRI','T.L.','T.L.'), ('CEMTRI','T.F.','T.F.'), ('CEMTRI','T.O.','T.O.'),
  ('CEMTRI','S.H.','S.H.'), ('CEMTRI','CEMS','CEMS'), ('CEMTRI','E.A.V.D.','E.A.V.D.'),
  ('CEMTRI','T.C.C.','T.C.C.'), ('CEMTRI','C.Psic.','C.Psic.'),
  ('Casa del Abuelo','Estancia','Estancia'), ('Casa del Abuelo','Evento','Evento'),
  ('Casa del Abuelo','Ejercicio','Ejercicio'), ('Casa del Abuelo','Plática','Plática'),
  ('Proyectos','Tux Lentes','Tux Lentes'), ('Proyectos','Prostodoncia','Prostodoncia'),
  ('Servicios Jurídicos','A.J.','A.J.'), ('Servicios Jurídicos','P.L.','P.L.'),
  ('Servicios de la Procuraduría','A.J.M.F.','A.J.M.F.'),
  ('Servicios de la Procuraduría','A.L.','A.L.'),
  ('Servicios de la Procuraduría','C.A.C.','C.A.C.'),
  ('Servicios de la Procuraduría','Alojamiento','Alojamiento'),
  ('Servicios de la Procuraduría','B.Alimento','B.Alimento'),
  ('Servicios a Grupos Vulnerables','C.T.F.I.','C.T.F.I.'),
  ('Servicios a Grupos Vulnerables','UNETOC','UNETOC'),
  ('Servicios a Grupos Vulnerables','CAI','CAI'),
  ('Servicios a Grupos Vulnerables','T.C.','T.C.'),
  ('Servicios a Grupos Vulnerables','P.E.N.M.S.','P.E.N.M.S.'),
  ('Servicios a Grupos Vulnerables','C.M.','C.M.'),
  ('Servicios a Grupos Vulnerables','A.A.M.','A.A.M.'),
  ('Servicios a Grupos Vulnerables','D.P.A.','D.P.A.'),
  ('Servicios Alimentarios','C.A.P.R.','C.A.P.R.'),
  ('Servicios Alimentarios','D.E.','D.E.'),
  ('Servicios Alimentarios','C.A.M.E.','C.A.M.E.'),
  ('Servicios Alimentarios','C.A.N.N.','C.A.N.N.'),
  ('Servicios Alimentarios','A.T.M.S.V.','A.T.M.S.V.');

CREATE TABLE audit_log (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fecha       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  usuario_id  INTEGER,
  usuario     TEXT,
  accion      TEXT NOT NULL,
  recurso     TEXT NOT NULL,
  recurso_id  INTEGER,
  ip          TEXT,
  user_agent  TEXT
);
CREATE INDEX idx_audit_fecha ON audit_log (fecha);

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO padron_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON beneficiarios, solicitudes_ayuda, beneficiario_servicios TO padron_app;
GRANT SELECT ON catalogo_servicios TO padron_app;
GRANT SELECT, INSERT, UPDATE ON usuarios TO padron_app;
GRANT SELECT, INSERT ON audit_log TO padron_app;
