/*
 * Copyright (C) 2016 - present Juergen Zimmermann, Hochschule Karlsruhe
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
 * Das Modul besteht aus den Klassen für die Fehlerbehandlung bei der Verwaltung
 * von Liedern, z.B. beim DB-Zugriff.
 * @packageDocumentation
 */

/**
 * Klasse für eine bereits existierende ISBN-Nummer.
 */
export interface TitelExists {
    readonly type: 'TitelExists';
    readonly titel: string | null | undefined;
    readonly id?: number;
}

/**
 * ggf. Union-Type für diverse Fehler beim Neuanlegen eines Liedes:
 * - {@linkcode TitelExists}
 */
export type CreateError = TitelExists;

/**
 * Klasse für eine ungültige Versionsnummer beim Ändern.
 */
export interface VersionInvalid {
    readonly type: 'VersionInvalid';
    readonly version: string | undefined;
}

/**
 * Klasse für eine veraltete Versionsnummer beim Ändern.
 */
export interface VersionOutdated {
    readonly type: 'VersionOutdated';
    readonly id: number;
    readonly version: number;
}

/**
 * Klasse für ein nicht-vorhandenes Lied beim Ändern.
 */
export interface LiedNotExists {
    readonly type: 'LiedNotExists';
    readonly id: number | undefined;
}

/**
 * Union-Type für Fehler beim Ändern eines Liedes:
 * - {@linkcode LiedNotExists}
 * - {@linkcode VersionInvalid}
 * - {@linkcode VersionOutdated}
 */
export type UpdateError = LiedNotExists | VersionInvalid | VersionOutdated;
