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
import { Args, Query, Resolver } from '@nestjs/graphql';
import { type Buch } from '../entity/buch.entity.js';
import { BadUserInputError } from './errors.js';
import { BuchReadService } from '../service/lied-read.service.js';
import { ResponseTimeInterceptor } from '../../logger/response-time.interceptor.js';
import { UseInterceptors } from '@nestjs/common';
import { getLogger } from '../../logger/logger.js';

export type BuchDTO = Omit<Buch, 'abbildungen' | 'aktualisiert' | 'erzeugt'>;
export interface IdInput {
    id: number;
}

@Resolver()
@UseInterceptors(ResponseTimeInterceptor)
export class BuchQueryResolver {
    readonly #service: BuchReadService;

    readonly #logger = getLogger(BuchQueryResolver.name);

    constructor(service: BuchReadService) {
        this.#service = service;
    }

    @Query()
    async buch(@Args() idInput: IdInput) {
        const { id } = idInput;
        this.#logger.debug('findById: id=%d', id);

        const buch = await this.#service.findById({ id });
        if (buch === undefined) {
            // https://www.apollographql.com/docs/apollo-server/data/errors
            throw new BadUserInputError(
                `Es wurde kein Buch mit der ID ${id} gefunden.`,
            );
        }
        const buchDTO = this.#toBuchDTO(buch);
        this.#logger.debug('findById: buchDTO=%o', buchDTO);
        return buchDTO;
    }

    @Query()
    async buecher(@Args() titel: { titel: string } | undefined) {
        const titelStr = titel?.titel;
        this.#logger.debug('find: titel=%s', titelStr);
        const suchkriterium = titelStr === undefined ? {} : { titel: titelStr };
        const buecher = await this.#service.find(suchkriterium);
        if (buecher.length === 0) {
            throw new BadUserInputError('Es wurden keine Buecher gefunden.');
        }

        const buecherDTO = buecher.map((buch) => this.#toBuchDTO(buch));
        this.#logger.debug('find: buecherDTO=%o', buecherDTO);
        return buecherDTO;
    }

    #toBuchDTO(buch: Buch): BuchDTO {
        return {
            id: buch.id,
            version: buch.version,
            isbn: buch.isbn,
            rating: buch.rating,
            art: buch.art,
            preis: buch.preis,
            rabatt: buch.rabatt,
            lieferbar: buch.lieferbar,
            datum: buch.datum,
            homepage: buch.homepage,
            schlagwoerter: buch.schlagwoerter,
            titel: buch.titel,
        };
    }
}
