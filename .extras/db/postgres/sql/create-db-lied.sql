-- Copyright (C) 2022 - present Juergen Zimmermann, Hochschule Karlsruhe
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
--
-- This program is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
-- GNU General Public License for more details.
--
-- You should have received a copy of the GNU General Public License
-- along with this program.  If not, see <https://www.gnu.org/licenses/>.

-- (1) user "postgres" in docker-compose.yaml auskommentieren,
--     damit der PostgreSQL-Server implizit mit dem Linux-User "root" gestartet wird
-- (2) PowerShell:
--     cd <Verzeichnis-mit-docker-compose.yaml>
--     docker compose up postgres
-- (3) 2. PowerShell:
--     cd <Verzeichnis-mit-docker-compose.yaml>
--     docker compose exec postgres bash
--         chown postgres:postgres /var/lib/postgresql/tablespace
--         chown postgres:postgres /var/lib/postgresql/tablespace/lied
--         exit
--     docker compose down
-- (3) in docker-compose.yaml den User "postgres" wieder aktivieren, d.h. Kommentar entfernen
-- (4) 1. PowerShell:
--     docker compose up
-- (5) 2. PowerShell:
--     docker compose exec postgres bash
--        psql --dbname=postgres --username=postgres --file=/sql/create-db-lied.sql
--        exit
--     docker compose down

-- https://www.postgresql.org/docs/current/sql-createrole.html
CREATE ROLE lied LOGIN PASSWORD 'p';

-- https://www.postgresql.org/docs/current/sql-createdatabase.html
CREATE DATABASE lied;

GRANT ALL ON DATABASE lied TO lied;

-- https://www.postgresql.org/docs/10/sql-createtablespace.html
CREATE TABLESPACE liedspace OWNER lied LOCATION '/var/lib/postgresql/tablespace/lied';
