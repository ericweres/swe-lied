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
import { UseInterceptors } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { getLogger } from '../../logger/logger.js';
import { ResponseTimeInterceptor } from '../../logger/response-time.interceptor.js';
import { LiedReadService } from '../service/lied-read.service.js';
import { BadUserInputError } from './errors.js';
import { Lied } from '../entity/lied.entity.js';

export type LiedDTO = Omit<Lied, 'aktualisiert' | 'erzeugt'>;
export interface IdInput {
    id: number;
}

@Resolver()
@UseInterceptors(ResponseTimeInterceptor)
export class LiedQueryResolver {
    readonly #service: LiedReadService;

    readonly #logger = getLogger(LiedQueryResolver.name);

    constructor(service: LiedReadService) {
        this.#service = service;
    }

    @Query()
    async lied(@Args() idInput: IdInput) {
        const { id } = idInput;
        this.#logger.debug('findById: id=%d', id);

        const lied = await this.#service.findById({ id });
        if (lied === undefined) {
            // https://www.apollographql.com/docs/apollo-server/data/errors
            throw new BadUserInputError(
                `Es wurde kein Lied mit der ID ${id} gefunden.`,
            );
        }
        const liedDTO = this.#toLiedDTO(lied);
        this.#logger.debug('findById: liedDTO=%o', liedDTO);
        return liedDTO;
    }

    @Query()
    async lieder(@Args() titel: { titel: string } | undefined) {
        const titelStr = titel?.titel;
        this.#logger.debug('find: titel=%s', titelStr);
        const suchkriterium = titelStr === undefined ? {} : { titel: titelStr };
        const lieder = await this.#service.find(suchkriterium);
        if (lieder.length === 0) {
            throw new BadUserInputError('Es wurden keine Lieder gefunden.');
        }

        const liederDTO = lieder.map((lied) => this.#toLiedDTO(lied));
        this.#logger.debug('find: liederDTO=%o', liederDTO);
        return liederDTO;
    }

    #toLiedDTO(lied: Lied): LiedDTO {
        return {
            id: lied.id,
            version: lied.version,
            rating: lied.rating,
            art: lied.art,
            datum: lied.datum,
            schlagwoerter: lied.schlagwoerter,
            titel: lied.titel ?? 'N/A',
            kuenstler: lied.kuenstler,
        };
    }
}
