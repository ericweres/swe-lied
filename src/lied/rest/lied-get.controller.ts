/* eslint-disable max-lines */
/*
 * Copyright (C) 2021 - present Juergen Zimmermann, Hochschule Karlsruhe
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
 * Das Modul besteht aus der Controller-Klasse für Lesen an der REST-Schnittstelle.
 * @packageDocumentation
 */

// eslint-disable-next-line max-classes-per-file
import {
    ApiHeader,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiProperty,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import {
    LiedReadService,
    type Suchkriterien,
} from '../service/lied-read.service.js';
import {
    Controller,
    Get,
    Headers,
    HttpStatus,
    Param,
    Query,
    Req,
    Res,
    UseInterceptors,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ResponseTimeInterceptor } from '../../logger/response-time.interceptor.js';
import { getBaseUri } from './getBaseUri.js';
import { getLogger } from '../../logger/logger.js';
import { paths } from '../../config/paths.js';
import { Kuenstler } from '../entity/kuenstler.entity.js';
import { Lied, LiedArt } from '../entity/lied.entity.js';

/** href-Link für HATEOAS */
export interface Link {
    /** href-Link für HATEOAS-Links */
    href: string;
}

/** Links für HATEOAS */
export interface Links {
    /** self-Link */
    self: Link;
    /** Optionaler Linke für list */
    list?: Link;
    /** Optionaler Linke für add */
    add?: Link;
    /** Optionaler Linke für update */
    update?: Link;
    /** Optionaler Linke für remove */
    remove?: Link;
}

/** Typedefinition für ein Titel-Objekt ohne Rückwärtsverweis zum Buch */
export type KuenstlerModel = Omit<Kuenstler, 'id' | 'lied'>;

/** Buch-Objekt mit HATEOAS-Links */
export type LiedModel = Omit<
    Lied,
    'abbildungen' | 'aktualisiert' | 'erzeugt' | 'id' | 'kuenstler' | 'version'
> & {
    kuenstler: KuenstlerModel;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    _links: Links;
};

/** Buch-Objekte mit HATEOAS-Links in einem JSON-Array. */
export interface LiederModel {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    _embedded: {
        lieder: LiedModel[];
    };
}

/**
 * Klasse für `BuchGetController`, um Queries in _OpenAPI_ bzw. Swagger zu
 * formulieren. `BuchController` hat dieselben Properties wie die Basisklasse
 * `Buch` - allerdings mit dem Unterschied, dass diese Properties beim Ableiten
 * so überschrieben sind, dass sie auch nicht gesetzt bzw. undefined sein
 * dürfen, damit die Queries flexibel formuliert werden können. Deshalb ist auch
 * immer der zusätzliche Typ undefined erforderlich.
 * Außerdem muss noch `string` statt `Date` verwendet werden, weil es in OpenAPI
 * den Typ Date nicht gibt.
 */
export class LiedQuery implements Suchkriterien {
    @ApiProperty({ required: false })
    declare readonly rating: number;

    @ApiProperty({ required: false })
    declare readonly art: LiedArt;

    @ApiProperty({ required: false })
    declare readonly datum: string;

    @ApiProperty({ required: false })
    declare readonly javascript: boolean;

    @ApiProperty({ required: false })
    declare readonly typescript: boolean;

    @ApiProperty({ required: false })
    declare readonly titel: string;
}

/**
 * Die Controller-Klasse für die Verwaltung von Bücher.
 */
// Decorator in TypeScript, zur Standardisierung in ES vorgeschlagen (stage 3)
// https://devblogs.microsoft.com/typescript/announcing-typescript-5-0-beta/#decorators
// https://github.com/tc39/proposal-decorators
@Controller(paths.rest)
// @UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(ResponseTimeInterceptor)
@ApiTags('Buch API')
// @ApiBearerAuth()
// Klassen ab ES 2015
export class LiedGetController {
    // readonly in TypeScript, vgl. C#
    // private ab ES 2019
    readonly #service: LiedReadService;

    readonly #logger = getLogger(LiedGetController.name);

    // Dependency Injection (DI) bzw. Constructor Injection
    // constructor(private readonly service: BuchReadService) {}
    constructor(service: LiedReadService) {
        this.#service = service;
    }

    /**
     * Ein Buch wird asynchron anhand seiner ID als Pfadparameter gesucht.
     *
     * Falls es ein solches Buch gibt und `If-None-Match` im Request-Header
     * auf die aktuelle Version des Buches gesetzt war, wird der Statuscode
     * `304` (`Not Modified`) zurückgeliefert. Falls `If-None-Match` nicht
     * gesetzt ist oder eine veraltete Version enthält, wird das gefundene
     * Buch im Rumpf des Response als JSON-Datensatz mit Atom-Links für HATEOAS
     * und dem Statuscode `200` (`OK`) zurückgeliefert.
     *
     * Falls es kein Buch zur angegebenen ID gibt, wird der Statuscode `404`
     * (`Not Found`) zurückgeliefert.
     *
     * @param id Pfad-Parameter `id`
     * @param req Request-Objekt von Express mit Pfadparameter, Query-String,
     *            Request-Header und Request-Body.
     * @param version Versionsnummer im Request-Header bei `If-None-Match`
     * @param accept Content-Type bzw. MIME-Type
     * @param res Leeres Response-Objekt von Express.
     * @returns Leeres Promise-Objekt.
     */
    // eslint-disable-next-line max-params, max-lines-per-function
    @Get(':id')
    @ApiOperation({ summary: 'Suche mit der Buch-ID', tags: ['Suchen'] })
    @ApiParam({
        name: 'id',
        description: 'Z.B. 00000000-0000-0000-0000-000000000001',
    })
    @ApiHeader({
        name: 'If-None-Match',
        description: 'Header für bedingte GET-Requests, z.B. "0"',
        required: false,
    })
    @ApiOkResponse({ description: 'Das Buch wurde gefunden' })
    @ApiNotFoundResponse({ description: 'Kein Buch zur ID gefunden' })
    @ApiResponse({
        status: HttpStatus.NOT_MODIFIED,
        description: 'Das Buch wurde bereits heruntergeladen',
    })
    async findById(
        @Param('id') id: number,
        @Req() req: Request,
        @Headers('If-None-Match') version: string | undefined,
        @Res() res: Response,
    ): Promise<Response<LiedModel | undefined>> {
        this.#logger.debug('findById: id=%s, version=%s"', id, version);

        if (req.accepts(['json', 'html']) === false) {
            this.#logger.debug('findById: accepted=%o', req.accepted);
            return res.sendStatus(HttpStatus.NOT_ACCEPTABLE);
        }

        let lied: Lied | undefined;
        try {
            // vgl. Kotlin: Aufruf einer suspend-Function
            lied = await this.#service.findById({ id });
        } catch (err) {
            // err ist implizit vom Typ "unknown", d.h. keine Operationen koennen ausgefuehrt werden
            // Exception einer export async function bei der Ausfuehrung fangen:
            // https://strongloop.com/strongblog/comparing-node-js-promises-trycatch-zone-js-angular
            this.#logger.error('findById: error=%o', err);
            return res.sendStatus(HttpStatus.INTERNAL_SERVER_ERROR);
        }

        if (lied === undefined) {
            this.#logger.debug('findById: NOT_FOUND');
            return res.sendStatus(HttpStatus.NOT_FOUND);
        }
        this.#logger.debug('findById(): buch=%o', lied);

        // ETags
        const versionDb = lied.version;
        if (version === `"${versionDb}"`) {
            this.#logger.debug('findById: NOT_MODIFIED');
            return res.sendStatus(HttpStatus.NOT_MODIFIED);
        }
        this.#logger.debug('findById: versionDb=%s', versionDb);
        res.header('ETag', `"${versionDb}"`);

        // HATEOAS mit Atom Links und HAL (= Hypertext Application Language)
        const liedModel = this.#toModel(lied, req);
        this.#logger.debug('findById: buchModel=%o', liedModel);
        return res.json(liedModel);
    }

    /**
     * Bücher werden mit Query-Parametern asynchron gesucht. Falls es mindestens
     * ein solches Buch gibt, wird der Statuscode `200` (`OK`) gesetzt. Im Rumpf
     * des Response ist das JSON-Array mit den gefundenen Büchern, die jeweils
     * um Atom-Links für HATEOAS ergänzt sind.
     *
     * Falls es kein Buch zu den Suchkriterien gibt, wird der Statuscode `404`
     * (`Not Found`) gesetzt.
     *
     * Falls es keine Query-Parameter gibt, werden alle Bücher ermittelt.
     *
     * @param query Query-Parameter von Express.
     * @param req Request-Objekt von Express.
     * @param res Leeres Response-Objekt von Express.
     * @returns Leeres Promise-Objekt.
     */
    @Get()
    @ApiOperation({ summary: 'Suche mit Suchkriterien', tags: ['Suchen'] })
    @ApiOkResponse({ description: 'Eine evtl. leere Liste mit Büchern' })
    async find(
        @Query() query: LiedQuery,
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<Response<LiederModel | undefined>> {
        this.#logger.debug('find: query=%o', query);

        if (req.accepts(['json', 'html']) === false) {
            this.#logger.debug('find: accepted=%o', req.accepted);
            return res.sendStatus(HttpStatus.NOT_ACCEPTABLE);
        }

        const lieder = await this.#service.find(query);
        this.#logger.debug('find: %o', lieder);
        if (lieder.length === 0) {
            this.#logger.debug('find: NOT_FOUND');
            return res.sendStatus(HttpStatus.NOT_FOUND);
        }

        // HATEOAS: Atom Links je Buch
        const liederModel = lieder.map((buch) =>
            this.#toModel(buch, req, false),
        );
        this.#logger.debug('find: buecherModel=%o', liederModel);

        const result: LiederModel = { _embedded: { lieder: liederModel } };
        return res.json(result).send();
    }

    #toModel(lied: Lied, req: Request, all = true) {
        const baseUri = getBaseUri(req);
        this.#logger.debug('#toModel: baseUri=%s', baseUri);
        const { id } = lied;
        const links = all
            ? {
                  self: { href: `${baseUri}/${id}` },
                  list: { href: `${baseUri}` },
                  add: { href: `${baseUri}` },
                  update: { href: `${baseUri}/${id}` },
                  remove: { href: `${baseUri}/${id}` },
              }
            : { self: { href: `${baseUri}/${id}` } };

        this.#logger.debug('#toModel: buch=%o, links=%o', lied, links);
        const kuenstlerModel: KuenstlerModel[] = {
            //TODO fix
            kuenstler: lied.kuenstler, // eslint-disable-line unicorn/consistent-destructuring // eslint-disable-line unicorn/consistent-destructuring //TODO fix
        };
        /* eslint-disable unicorn/consistent-destructuring */
        const liedModel: LiedModel = {
            rating: lied.rating,
            art: lied.art,
            datum: lied.datum,
            schlagwoerter: lied.schlagwoerter,
            //TODO fix
            kuenstler: kuenstlerModel,
            titel: lied.titel,
            _links: links,
        };
        /* eslint-enable unicorn/consistent-destructuring */

        return liedModel;
    }
}
/* eslint-enable max-lines */
