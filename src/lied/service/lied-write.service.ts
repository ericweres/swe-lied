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
 * Das Modul besteht aus der Klasse {@linkcode BuchWriteService} für die
 * Schreiboperationen im Anwendungskern.
 * @packageDocumentation
 */

import {
    type BuchNotExists,
    type CreateError,
    type UpdateError,
    type VersionInvalid,
    type VersionOutdated,
} from './errors.js';
import { type DeleteResult, Repository } from 'typeorm';
import { Abbildung } from '../entity/abbildung.entity.js';
import { Buch } from '../entity/buch.entity.js';
import { BuchReadService } from './lied-read.service.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { MailService } from '../../mail/mail.service.js';
import RE2 from 're2';
import { Titel } from '../entity/titel.entity.js';
import { getLogger } from '../../logger/logger.js';

/** Typdefinitionen zum Aktualisieren eines Buches mit `update`. */
export interface UpdateParams {
    /** ID des zu aktualisierenden Buches. */
    id: number | undefined;
    /** Buch-Objekt mit den aktualisierten Werten. */
    buch: Buch;
    /** Versionsnummer für die aktualisierenden Werte. */
    version: string;
}

/**
 * Die Klasse `BuchWriteService` implementiert den Anwendungskern für das
 * Schreiben von Bücher und greift mit _TypeORM_ auf die DB zu.
 */
@Injectable()
export class BuchWriteService {
    private static readonly VERSION_PATTERN = new RE2('^"\\d*"');

    readonly #repo: Repository<Buch>;

    readonly #readService: BuchReadService;

    readonly #mailService: MailService;

    readonly #logger = getLogger(BuchWriteService.name);

    constructor(
        @InjectRepository(Buch) repo: Repository<Buch>,
        readService: BuchReadService,
        mailService: MailService,
    ) {
        this.#repo = repo;
        this.#readService = readService;
        this.#mailService = mailService;
    }

    /**
     * Ein neues Buch soll angelegt werden.
     * @param buch Das neu abzulegende Buch
     * @returns Die ID des neu angelegten Buches oder im Fehlerfall
     * [CreateError](../types/buch_service_errors.CreateError.html)
     */
    async create(buch: Buch): Promise<CreateError | number> {
        this.#logger.debug('create: buch=%o', buch);
        const validateResult = await this.#validateCreate(buch);
        if (validateResult !== undefined) {
            return validateResult;
        }

        // implizite Transaktion
        const buchDb = await this.#repo.save(buch); // implizite Transaktion
        this.#logger.debug('create: buchDb=%o', buchDb);

        await this.#sendmail(buchDb);

        return buchDb.id!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    }

    /**
     * Ein vorhandenes Buch soll aktualisiert werden.
     * @param buch Das zu aktualisierende Buch
     * @param id ID des zu aktualisierenden Buchs
     * @param version Die Versionsnummer für optimistische Synchronisation
     * @returns Die neue Versionsnummer gemäß optimistischer Synchronisation
     *  oder im Fehlerfall [UpdateError](../types/buch_service_errors.UpdateError.html)
     */
    // https://2ality.com/2015/01/es6-destructuring.html#simulating-named-parameters-in-javascript
    async update({
        id,
        buch,
        version,
    }: UpdateParams): Promise<UpdateError | number> {
        this.#logger.debug(
            'update: id=%d, buch=%o, version=%s',
            id,
            buch,
            version,
        );
        if (id === undefined) {
            this.#logger.debug('update: Keine gueltige ID');
            return { type: 'BuchNotExists', id };
        }

        const validateResult = await this.#validateUpdate(buch, id, version);
        this.#logger.debug('update: validateResult=%o', validateResult);
        if (!(validateResult instanceof Buch)) {
            return validateResult;
        }

        const buchNeu = validateResult;
        const merged = this.#repo.merge(buchNeu, buch);
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
        const buch = await this.#readService.findById({
            id,
            mitAbbildungen: true,
        });
        if (buch === undefined) {
            return false;
        }

        let deleteResult: DeleteResult | undefined;
        await this.#repo.manager.transaction(async (transactionalMgr) => {
            // Das Buch zur gegebenen ID mit Titel und Abb. asynchron loeschen

            // TODO "cascade" funktioniert nicht beim Loeschen
            const titelId = buch.titel?.id;
            if (titelId !== undefined) {
                await transactionalMgr.delete(Titel, titelId);
            }
            const abbildungen = buch.abbildungen ?? [];
            for (const abbildung of abbildungen) {
                await transactionalMgr.delete(Abbildung, abbildung.id);
            }

            deleteResult = await transactionalMgr.delete(Buch, id);
            this.#logger.debug('delete: deleteResult=%o', deleteResult);
        });

        return (
            deleteResult?.affected !== undefined &&
            deleteResult.affected !== null &&
            deleteResult.affected > 0
        );
    }

    async #validateCreate(buch: Buch): Promise<CreateError | undefined> {
        this.#logger.debug('#validateCreate: buch=%o', buch);

        const { isbn } = buch;
        const buecher = await this.#readService.find({ isbn: isbn }); // eslint-disable-line object-shorthand
        if (buecher.length > 0) {
            return { type: 'IsbnExists', isbn };
        }

        this.#logger.debug('#validateCreate: ok');
        return undefined;
    }

    async #sendmail(buch: Buch) {
        const subject = `Neues Buch ${buch.id}`;
        const titel = buch.titel?.titel ?? 'N/A';
        const body = `Das Buch mit dem Titel <strong>${titel}</strong> ist angelegt`;
        await this.#mailService.sendmail({ subject, body });
    }

    async #validateUpdate(
        buch: Buch,
        id: number,
        versionStr: string,
    ): Promise<Buch | UpdateError> {
        const result = this.#validateVersion(versionStr);
        if (typeof result !== 'number') {
            return result;
        }

        const version = result;
        this.#logger.debug(
            '#validateUpdate: buch=%o, version=%s',
            buch,
            version,
        );

        const resultFindById = await this.#findByIdAndCheckVersion(id, version);
        this.#logger.debug('#validateUpdate: %o', resultFindById);
        return resultFindById;
    }

    #validateVersion(version: string | undefined): VersionInvalid | number {
        if (
            version === undefined ||
            !BuchWriteService.VERSION_PATTERN.test(version)
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
    ): Promise<Buch | BuchNotExists | VersionOutdated> {
        const buchDb = await this.#readService.findById({ id });
        if (buchDb === undefined) {
            const result: BuchNotExists = { type: 'BuchNotExists', id };
            this.#logger.debug('#checkIdAndVersion: BuchNotExists=%o', result);
            return result;
        }

        // nullish coalescing
        const versionDb = buchDb.version!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
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

        return buchDb;
    }
}
