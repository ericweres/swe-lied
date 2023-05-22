/* eslint-disable max-classes-per-file */
/*
 * Copyright (C) 2016 - present Juergen Zimmermann, Florian Goebel, Hochschule Karlsruhe
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
 * Das Modul besteht aus der Entity-Klasse.
 * @packageDocumentation
 */

import {
    ArrayUnique,
    IsArray,
    IsISO8601,
    IsInt,
    IsOptional,
    Matches,
    Max,
    Min,
    ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { KuenstlerDTO } from './kuenstlerDTO.entity.js';
import { LiedArt } from '../entity/lied.entity.js';
import { Type } from 'class-transformer';

export const MAX_RATING = 5;

/**
 * Entity-Klasse für Lieder ohne TypeORM und ohne Referenzen.
 */
export class LiedDtoOhneRef {
    @IsInt()
    @Min(0)
    @Max(MAX_RATING)
    @ApiProperty({ example: 5, type: Number })
    readonly rating: number | undefined;

    @Matches(/^CD$|^MP3$/u)
    @IsOptional()
    @ApiProperty({ example: 'DRUCKAUSGABE', type: String })
    readonly art: LiedArt | undefined;

    @IsISO8601({ strict: true })
    @IsOptional()
    @ApiProperty({ example: '2021-01-31' })
    readonly datum: Date | string | undefined;

    @IsOptional()
    @ArrayUnique()
    @ApiProperty({ example: ['JAVASCRIPT', 'TYPESCRIPT'] })
    readonly schlagwoerter: string[] | undefined;

    @ApiProperty({ example: 'Der Titel', type: String })
    readonly titel!: string; //NOSONAR
}

/**
 * Entity-Klasse für Lieder ohne TypeORM.
 */
export class LiedDTO extends LiedDtoOhneRef {
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => KuenstlerDTO)
    @ApiProperty({ example: 'Die Abbildungen', type: String })
    readonly kuenstler: KuenstlerDTO[] | undefined;

    // AbbildungDTO
}
/* eslint-enable max-classes-per-file */
