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
// eslint-disable-next-line max-classes-per-file
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { type CreateError, type UpdateError } from '../service/errors.js';
import { IsInt, IsNumberString, Min } from 'class-validator';
import { UseGuards, UseInterceptors } from '@nestjs/common';
import { Abbildung } from '../entity/abbildung.entity.js';
import { BadUserInputError } from './errors.js';
import { Buch } from '../entity/buch.entity.js';
import { BuchDTO } from '../rest/liedDTO.entity.js';
import { BuchWriteService } from '../service/lied-write.service.js';
import { type IdInput } from './lied-query.resolver.js';
import { JwtAuthGraphQlGuard } from '../../security/auth/jwt/jwt-auth-graphql.guard.js';
import { ResponseTimeInterceptor } from '../../logger/response-time.interceptor.js';
import { RolesAllowed } from '../../security/auth/roles/roles-allowed.decorator.js';
import { RolesGraphQlGuard } from '../../security/auth/roles/roles-graphql.guard.js';
import { type Titel } from '../entity/titel.entity.js';
import { getLogger } from '../../logger/logger.js';

// Authentifizierung und Autorisierung durch
//  GraphQL Shield
//      https://www.graphql-shield.com
//      https://github.com/maticzav/graphql-shield
//      https://github.com/nestjs/graphql/issues/92
//      https://github.com/maticzav/graphql-shield/issues/213
//  GraphQL AuthZ
//      https://github.com/AstrumU/graphql-authz
//      https://www.the-guild.dev/blog/graphql-authz

export class BuchUpdateDTO extends BuchDTO {
    @IsNumberString()
    readonly id!: string;

    @IsInt()
    @Min(0)
    readonly version!: number;
}
@Resolver()
// alternativ: globale Aktivierung der Guards https://docs.nestjs.com/security/authorization#basic-rbac-implementation
@UseGuards(JwtAuthGraphQlGuard, RolesGraphQlGuard)
@UseInterceptors(ResponseTimeInterceptor)
export class BuchMutationResolver {
    readonly #service: BuchWriteService;

    readonly #logger = getLogger(BuchMutationResolver.name);

    constructor(service: BuchWriteService) {
        this.#service = service;
    }

    @Mutation()
    @RolesAllowed('admin', 'mitarbeiter')
    async create(@Args('input') buchDTO: BuchDTO) {
        this.#logger.debug('create: buchDTO=%o', buchDTO);

        const buch = this.#buchDtoToBuch(buchDTO);
        const result = await this.#service.create(buch);
        this.#logger.debug('createBuch: result=%o', result);

        if (Object.prototype.hasOwnProperty.call(result, 'type')) {
            throw new BadUserInputError(
                this.#errorMsgCreateBuch(result as CreateError),
            );
        }
        return result;
    }

    @Mutation()
    @RolesAllowed('admin', 'mitarbeiter')
    async update(@Args('input') buchDTO: BuchUpdateDTO) {
        this.#logger.debug('update: buch=%o', buchDTO);

        const buch = this.#buchUpdateDtoToBuch(buchDTO);
        const versionStr = `"${buchDTO.version.toString()}"`;

        const result = await this.#service.update({
            id: Number.parseInt(buchDTO.id, 10),
            buch,
            version: versionStr,
        });
        if (typeof result === 'object') {
            throw new BadUserInputError(this.#errorMsgUpdateBuch(result));
        }
        this.#logger.debug('updateBuch: result=%d', result);
        return result;
    }

    @Mutation()
    @RolesAllowed('admin')
    async delete(@Args() id: IdInput) {
        const idStr = id.id;
        this.#logger.debug('delete: id=%s', idStr);
        const result = await this.#service.delete(idStr);
        this.#logger.debug('deleteBuch: result=%s', result);
        return result;
    }

    #buchDtoToBuch(buchDTO: BuchDTO): Buch {
        const titelDTO = buchDTO.titel;
        const titel: Titel = {
            id: undefined,
            titel: titelDTO.titel,
            untertitel: titelDTO.untertitel,
            buch: undefined,
        };
        const abbildungen = buchDTO.abbildungen?.map((abbildungDTO) => {
            const abbildung: Abbildung = {
                id: undefined,
                beschriftung: abbildungDTO.beschriftung,
                contentType: abbildungDTO.contentType,
                buch: undefined,
            };
            return abbildung;
        });
        const buch = {
            id: undefined,
            version: undefined,
            isbn: buchDTO.isbn,
            rating: buchDTO.rating,
            art: buchDTO.art,
            preis: buchDTO.preis,
            rabatt: buchDTO.rabatt,
            lieferbar: buchDTO.lieferbar,
            datum: buchDTO.datum,
            homepage: buchDTO.homepage,
            schlagwoerter: buchDTO.schlagwoerter,
            titel,
            abbildungen,
            erzeugt: undefined,
            aktualisiert: undefined,
        };

        // Rueckwaertsverweis
        buch.titel.buch = buch;
        return buch;
    }

    #buchUpdateDtoToBuch(buchDTO: BuchUpdateDTO): Buch {
        return {
            id: undefined,
            version: undefined,
            isbn: buchDTO.isbn,
            rating: buchDTO.rating,
            art: buchDTO.art,
            preis: buchDTO.preis,
            rabatt: buchDTO.rabatt,
            lieferbar: buchDTO.lieferbar,
            datum: buchDTO.datum,
            homepage: buchDTO.homepage,
            schlagwoerter: buchDTO.schlagwoerter,
            titel: undefined,
            abbildungen: undefined,
            erzeugt: undefined,
            aktualisiert: undefined,
        };
    }

    #errorMsgCreateBuch(err: CreateError) {
        switch (err.type) {
            case 'IsbnExists': {
                return `Die ISBN ${err.isbn} existiert bereits`;
            }
            default: {
                return 'Unbekannter Fehler';
            }
        }
    }

    #errorMsgUpdateBuch(err: UpdateError) {
        switch (err.type) {
            case 'BuchNotExists': {
                return `Es gibt kein Buch mit der ID ${err.id}`;
            }
            case 'VersionInvalid': {
                return `"${err.version}" ist keine gueltige Versionsnummer`;
            }
            case 'VersionOutdated': {
                return `Die Versionsnummer "${err.version}" ist nicht mehr aktuell`;
            }
            default: {
                return 'Unbekannter Fehler';
            }
        }
    }
}
