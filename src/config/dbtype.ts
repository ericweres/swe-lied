/*
 * Copyright (C) 2023 - present Juergen Zimmermann, Hochschule Karlsruhe
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Das Modul enthält den Namen des DB-Typs: postgres, mysql oder sqlite.
 * @packageDocumentation
 */

import { env } from './env.js';

const { DB_TYPE } = env;

// 'better-sqlite3' erfordert Python zum Uebersetzen, wenn das Docker-Image gebaut wird
export const dbType =
    DB_TYPE === 'postgres' || DB_TYPE === 'mysql' || DB_TYPE === 'sqlite'
        ? DB_TYPE
        : 'postgres';
