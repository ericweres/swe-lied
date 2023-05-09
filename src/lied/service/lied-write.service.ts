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
 * Das Modul besteht aus der Klasse {@linkcode LiedWriteService} für die
 * Schreiboperationen im Anwendungskern.
 * @packageDocumentation
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import RE2 from 're2';
import { Repository, type DeleteResult } from 'typeorm';
import { getLogger } from '../../logger/logger.js';
import { MailService } from '../../mail/mail.service.js';
import { Kuenstler } from '../entity/kuenstler.entity.js';
import { Lied } from '../entity/lied.entity.js';
import {
    type CreateError,
    type LiedNotExists,
    type UpdateError,
    type VersionInvalid,
    type VersionOutdated,
} from './errors.js';
import { LiedReadService } from './lied-read.service.js';

/** Typdefinitionen zum Aktualisieren eines Buches mit `update`. */
export interface UpdateParams {
    /** ID des zu aktualisierenden Buches. */
    id: number | undefined;
    /** Buch-Objekt mit den aktualisierten Werten. */
    buch: Lied;
    /** Versionsnummer für die aktualisierenden Werte. */
    version: string;
}

/**
 * Die Klasse `BuchWriteService` implementiert den Anwendungskern für das
 * Schreiben von Bücher und greift mit _TypeORM_ auf die DB zu.
 */
@Injectable()
export class LiedWriteService {
    private static readonly VERSION_PATTERN = new RE2('^"\\d*"');

    readonly #repo: Repository<Lied>;

    readonly #readService: LiedReadService;

    readonly #mailService: MailService;

    readonly #logger = getLogger(LiedWriteService.name);

    constructor(
        @InjectRepository(Lied) repo: Repository<Lied>,
        readService: LiedReadService,
        mailService: MailService,
    ) {
        this.#repo = repo;
        this.#readService = readService;
        this.#mailService = mailService;
    }

    /**
     * Ein neues Buch soll angelegt werden.
     * @param lied Das neu abzulegende Buch
     * @returns Die ID des neu angelegten Buches oder im Fehlerfall
     * [CreateError](../types/buch_service_errors.CreateError.html)
     */
    async create(lied: Lied): Promise<CreateError | number> {
        this.#logger.debug('create: buch=%o', lied);
        const validateResult = await this.#validateCreate(lied);
        if (validateResult !== undefined) {
            return validateResult;
        }

        // implizite Transaktion
        const liedDb = await this.#repo.save(lied); // implizite Transaktion
        this.#logger.debug('create: buchDb=%o', liedDb);

        await this.#sendmail(liedDb);

        return liedDb.id!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    }

    /**
     * Ein vorhandenes Buch soll aktualisiert werden.
     * @param lied Das zu aktualisierende Buch
     * @param id ID des zu aktualisierenden Buchs
     * @param version Die Versionsnummer für optimistische Synchronisation
     * @returns Die neue Versionsnummer gemäß optimistischer Synchronisation
     *  oder im Fehlerfall [UpdateError](../types/buch_service_errors.UpdateError.html)
     */
    // https://2ality.com/2015/01/es6-destructuring.html#simulating-named-parameters-in-javascript
    async update({
        id,
        buch: lied,
        version,
    }: UpdateParams): Promise<UpdateError | number> {
        this.#logger.debug(
            'update: id=%d, buch=%o, version=%s',
            id,
            lied,
            version,
        );
        if (id === undefined) {
            this.#logger.debug('update: Keine gueltige ID');
            return { type: 'LiedNotExists', id };
        }

        const validateResult = await this.#validateUpdate(lied, id, version);
        this.#logger.debug('update: validateResult=%o', validateResult);
        if (!(validateResult instanceof Lied)) {
            return validateResult;
        }

        const buchNeu = validateResult;
        const merged = this.#repo.merge(buchNeu, lied);
        this.#logger.debug('update: merged=%o', merged);
        const updated = await this.#repo.save(merged); // implizite Transaktion
        this.#logger.debug('update: updated=%o', updated);

        return updated.version!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    }

    /**
     * Ein Buch wird asynchron anhand seiner ID gelöscht.
     *
     * @param id ID des zu löschenden Buches
     * @returns true, falls das Buch vorhanden war und gelöscht wurde. Sonst false.
     */
    async delete(id: number) {
        this.#logger.debug('delete: id=%d', id);
        const lied = await this.#readService.findById({
            id,
        });
        if (lied === undefined) {
            return false;
        }

        let deleteResult: DeleteResult | undefined;
        //TODO remove deleting Kuenstler?
        await this.#repo.manager.transaction(async (transactionalMgr) => {
            // Das Buch zur gegebenen ID mit Titel und Abb. asynchron loeschen

            // TODO "cascade" funktioniert nicht beim Loeschen
            const kuenstler = lied.kuenstler ?? [];
            for (const kunst of kuenstler) {
                await transactionalMgr.delete(Kuenstler, kunst.id);
            }

            deleteResult = await transactionalMgr.delete(Lied, id);
            this.#logger.debug('delete: deleteResult=%o', deleteResult);
        });

        return (
            deleteResult?.affected !== undefined &&
            deleteResult.affected !== null &&
            deleteResult.affected > 0
        );
    }

    async #validateCreate(lied: Lied): Promise<CreateError | undefined> {
        this.#logger.debug('#validateCreate: buch=%o', lied);

        const { titel } = lied;
        const lieder = await this.#readService.find({ titel: titel }); // eslint-disable-line object-shorthand
        if (lieder.length > 0) {
            return { type: 'TitelExists', titel };
        }

        this.#logger.debug('#validateCreate: ok');
        return undefined;
    }

    async #sendmail(lied: Lied) {
        const subject = `Neues Lied ${lied.id}`;
        const kuenstler = lied.kuenstler?.at(0)?.name ?? 'N/A';
        const body = `Das Lied vom Künstler <strong>${kuenstler}</strong> ist angelegt`;
        await this.#mailService.sendmail({ subject, body });
    }

    async #validateUpdate(
        lied: Lied,
        id: number,
        versionStr: string,
    ): Promise<Lied | UpdateError> {
        const result = this.#validateVersion(versionStr);
        if (typeof result !== 'number') {
            return result;
        }

        const version = result;
        this.#logger.debug(
            '#validateUpdate: buch=%o, version=%s',
            lied,
            version,
        );

        const resultFindById = await this.#findByIdAndCheckVersion(id, version);
        this.#logger.debug('#validateUpdate: %o', resultFindById);
        return resultFindById;
    }

    #validateVersion(version: string | undefined): VersionInvalid | number {
        if (
            version === undefined ||
            !LiedWriteService.VERSION_PATTERN.test(version)
        ) {
            const error: VersionInvalid = { type: 'VersionInvalid', version };
            this.#logger.debug('#validateVersion: VersionInvalid=%o', error);
            return error;
        }

        return Number.parseInt(version.slice(1, -1), 10);
    }

    async #findByIdAndCheckVersion(
        id: number,
        version: number,
    ): Promise<Lied | LiedNotExists | VersionOutdated> {
        const liedDb = await this.#readService.findById({ id });
        if (liedDb === undefined) {
            const result: LiedNotExists = { type: 'LiedNotExists', id };
            this.#logger.debug('#checkIdAndVersion: BuchNotExists=%o', result);
            return result;
        }

        // nullish coalescing
        const versionDb = liedDb.version!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
        if (version < versionDb) {
            const result: VersionOutdated = {
                type: 'VersionOutdated',
                id,
                version,
            };
            this.#logger.debug(
                '#checkIdAndVersion: VersionOutdated=%o',
                result,
            );
            return result;
        }

        return liedDb;
    }
}
