#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 \
     -v app_pass="$APP_DB_PASSWORD" \
     --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-'EOSQL'
  CREATE ROLE padron_app LOGIN PASSWORD :'app_pass'
    NOSUPERUSER NOCREATEDB NOCREATEROLE;
EOSQL
