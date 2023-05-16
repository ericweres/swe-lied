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
 * Das Modul besteht aus der Klasse {@linkcode QueryBuilder}.
 * @packageDocumentation
 */

import { Repository } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { typeOrmModuleOptions } from '../../config/db.js';
import { getLogger } from '../../logger/logger.js';
import { Kuenstler } from '../entity/kuenstler.entity.js';
import { Lied } from '../entity/lied.entity.js';

/** Typdefinitionen für die Suche mit der Lied-ID. */
export interface BuildIdParams {
    /** ID des gesuchten Lieds. */
    id: number;
    /** Sollen die Abbildungen mitgeladen werden? */
    mitAbbildungen?: boolean;
}
/**
 * Die Klasse `QueryBuilder` implementiert das Lesen für Bücher und greift
 * mit _TypeORM_ auf eine relationale DB zu.
 */
@Injectable()
export class QueryBuilder {
    readonly #liedAlias = `${Lied.name
        .charAt(0)
        .toLowerCase()}${Lied.name.slice(1)}`;

    readonly #kuenstlerAlias = `${Kuenstler.name
        .charAt(0)
        .toLowerCase()}${Kuenstler.name.slice(1)}`;

    readonly #repo: Repository<Lied>;

    readonly #logger = getLogger(QueryBuilder.name);

    constructor(@InjectRepository(Lied) repo: Repository<Lied>) {
        this.#repo = repo;
    }

    /**
     * Ein Lied mit der ID suchen.
     * @param id ID des gesuchten Liedes
     * @returns QueryBuilder
     */
    buildId({ id }: BuildIdParams) {
        const queryBuilder = this.#repo.createQueryBuilder(this.#liedAlias);
        queryBuilder.innerJoinAndSelect(
            `${this.#liedAlias}.kuenstler`,
            this.#kuenstlerAlias,
        );
        queryBuilder.where(`${this.#liedAlias}.id = :id`, { id: id }); // eslint-disable-line object-shorthand
        return queryBuilder;
    }

    /**
     * Bücher asynchron suchen.
     * @param suchkriterien JSON-Objekt mit Suchkriterien
     * @returns QueryBuilder
     */
    // eslint-disable-next-line max-lines-per-function
    build(suchkriterien: Record<string, any>) {
        this.#logger.debug('build: suchkriterien=%o', suchkriterien);

        let queryBuilder = this.#repo.createQueryBuilder(this.#liedAlias);
        queryBuilder.innerJoinAndSelect(
            `${this.#liedAlias}.kuenstler`,
            this.#kuenstlerAlias,
        );
        // z.B. { titel: 'a', rating: 5, javascript: true }
        // "rest properties" fuer anfaengliche WHERE-Klausel: ab ES 2018 https://github.com/tc39/proposal-object-rest-spread
        // type-coverage:ignore-next-line
        const { titel, javascript, typescript, ...props } = suchkriterien;

        let useWhere = true;

        // Titel in der Query: Teilstring des Titels und "case insensitive"
        // CAVEAT: MySQL hat keinen Vergleich mit "case insensitive"
        // type-coverage:ignore-next-line
        if (titel !== undefined && typeof titel === 'string') {
            const ilike =
                typeOrmModuleOptions.type === 'postgres' ? 'ilike' : 'like';
            queryBuilder = queryBuilder.where(
                `${this.#kuenstlerAlias}.name ${ilike} :name`, //TODO: check if that works
                { name: `%${titel}%` },
            );
            useWhere = false;
        }

        if (javascript === 'true') {
            queryBuilder = useWhere
                ? queryBuilder.where(
                      `${this.#liedAlias}.schlagwoerter like '%JAVASCRIPT%'`,
                  )
                : queryBuilder.andWhere(
                      `${this.#liedAlias}.schlagwoerter like '%JAVASCRIPT%'`,
                  );
            useWhere = false;
        }

        if (typescript === 'true') {
            queryBuilder = useWhere
                ? queryBuilder.where(
                      `${this.#liedAlias}.schlagwoerter like '%TYPESCRIPT%'`,
                  )
                : queryBuilder.andWhere(
                      `${this.#liedAlias}.schlagwoerter like '%TYPESCRIPT%'`,
                  );
            useWhere = false;
        }

        // Restliche Properties als Key-Value-Paare: Vergleiche auf Gleichheit
        Object.keys(props).forEach((key) => {
            const param: Record<string, any> = {};
            param[key] = props[key]; // eslint-disable-line @typescript-eslint/no-unsafe-assignment, security/detect-object-injection
            queryBuilder = useWhere
                ? queryBuilder.where(
                      `${this.#liedAlias}.${key} = :${key}`,
                      param,
                  )
                : queryBuilder.andWhere(
                      `${this.#liedAlias}.${key} = :${key}`,
                      param,
                  );
            useWhere = false;
        });

        this.#logger.debug('build: sql=%s', queryBuilder.getSql());
        return queryBuilder;
    }
}
