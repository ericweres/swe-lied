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
import { UseGuards, UseInterceptors } from '@nestjs/common';

import { BadUserInputError } from './errors.js';

import { IsInt, IsNumberString, Min } from 'class-validator';
import { getLogger } from '../../logger/logger.js';
import { ResponseTimeInterceptor } from '../../logger/response-time.interceptor.js';
import { JwtAuthGraphQlGuard } from '../../security/auth/jwt/jwt-auth-graphql.guard.js';
import { RolesAllowed } from '../../security/auth/roles/roles-allowed.decorator.js';
import { RolesGraphQlGuard } from '../../security/auth/roles/roles-graphql.guard.js';
import { LiedDTO } from '../rest/liedDTO.entity.js';
import { type CreateError, type UpdateError } from '../service/errors.js';
import { LiedWriteService } from '../service/lied-write.service.js';

import { type IdInput } from './lied-query.resolver.js';
import { Lied } from '../entity/lied.entity.js';
import { Kuenstler } from '../entity/kuenstler.entity.js';

// Authentifizierung und Autorisierung durch
//  GraphQL Shield
//      https://www.graphql-shield.com
//      https://github.com/maticzav/graphql-shield
//      https://github.com/nestjs/graphql/issues/92
//      https://github.com/maticzav/graphql-shield/issues/213
//  GraphQL AuthZ
//      https://github.com/AstrumU/graphql-authz
//      https://www.the-guild.dev/blog/graphql-authz

export class LiedUpdateDTO extends LiedDTO {
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
export class LiedMutationResolver {
    readonly #service: LiedWriteService;

    readonly #logger = getLogger(LiedMutationResolver.name);

    constructor(service: LiedWriteService) {
        this.#service = service;
    }

    @Mutation()
    @RolesAllowed('admin', 'mitarbeiter')
    async create(@Args('input') liedDTO: LiedDTO) {
        this.#logger.debug('create: buchDTO=%o', liedDTO);

        const lied = this.#liedDtoToLied(liedDTO);
        const result = await this.#service.create(lied);
        this.#logger.debug('createBuch: result=%o', result);

        if (Object.prototype.hasOwnProperty.call(result, 'type')) {
            throw new BadUserInputError(
                this.#errorMsgCreateLied(result as CreateError),
            );
        }
        return result;
    }

    @Mutation()
    @RolesAllowed('admin', 'mitarbeiter')
    async update(@Args('input') liedDTO: LiedUpdateDTO) {
        this.#logger.debug('update: buch=%o', liedDTO);

        const lied = this.#liedUpdateDtoToLied(liedDTO);
        const versionStr = `"${liedDTO.version.toString()}"`;

        const result = await this.#service.update({
            id: Number.parseInt(liedDTO.id, 10),
            lied,
            version: versionStr,
        });
        if (typeof result === 'object') {
            throw new BadUserInputError(this.#errorMsgUpdateLied(result));
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

    #liedDtoToLied(liedDTO: LiedDTO): Lied {
        const kuenstler = liedDTO.kuestler?.map((kuenstlerDTO) => {
            const kuenst: Kuenstler = {
                id: undefined,
                name: kuenstlerDTO.name,
                lied: undefined,
            };
            return kuenst;
        });
        const lied = {
            id: undefined,
            titel: liedDTO.titel,
            version: undefined,
            rating: liedDTO.rating,
            art: liedDTO.art,
            datum: liedDTO.datum,
            schlagwoerter: liedDTO.schlagwoerter,
            kuenstler,
            abbildungen: kuenstler,
            erzeugt: undefined,
            aktualisiert: undefined,
        };

        // Rueckwaertsverweis
        return lied;
    }

    #liedUpdateDtoToLied(liedDTO: LiedUpdateDTO): Lied {
        return {
            id: undefined,
            version: undefined,
            rating: liedDTO.rating,
            art: liedDTO.art,
            datum: liedDTO.datum,
            schlagwoerter: liedDTO.schlagwoerter,
            titel: undefined,
            kuenstler: undefined,
            erzeugt: undefined,
            aktualisiert: undefined,
        };
    }

    #errorMsgCreateLied(err: CreateError) {
        switch (err.type) {
            case 'TitelExists': {
                return `Der Titel ${err.titel} existiert bereits`;
            }
            default: {
                return 'Unbekannter Fehler';
            }
        }
    }

    #errorMsgUpdateLied(err: UpdateError) {
        switch (err.type) {
            case 'LiedNotExists': {
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
