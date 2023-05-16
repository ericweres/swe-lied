/* eslint-disable max-lines, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-extra-non-null-assertion */
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

import {
    type GraphQLQuery,
    type GraphQLResponseBody,
} from './lied-query.resolver.test.js';
import { afterAll, beforeAll, describe, test } from '@jest/globals';
import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import {
    host,
    httpsAgent,
    port,
    shutdownServer,
    startServer,
} from '../testserver.js';
import { LiedReadService } from '../../src/lied/service/lied-read.service.js';
import { HttpStatus } from '@nestjs/common';
import { loginGraphQL } from '../login.js';

// -----------------------------------------------------------------------------
// T e s t d a t e n
// -----------------------------------------------------------------------------
const idLoeschen = '12';

// -----------------------------------------------------------------------------
// T e s t s
// -----------------------------------------------------------------------------
// Test-Suite
// eslint-disable-next-line max-lines-per-function
describe('GraphQL Mutations', () => {
    let client: AxiosInstance;
    const graphqlPath = 'graphql';

    // Testserver starten und dabei mit der DB verbinden
    beforeAll(async () => {
        await startServer();
        const baseURL = `https://${host}:${port}/`;
        client = axios.create({
            baseURL,
            httpsAgent,
        });
    });

    afterAll(async () => {
        await shutdownServer();
    });

    // -------------------------------------------------------------------------
    test('Neues Lied', async () => {
        // given
        const token = await loginGraphQL(client);
        const authorization = { Authorization: `Bearer ${token}` }; // eslint-disable-line @typescript-eslint/naming-convention
        const body: GraphQLQuery = {
            query: `
                mutation {
                    create(
                        input: {
                            rating: 1,
                            art: CD,
                            datum: "2022-02-28",
                            schlagwoerter: ["JAVASCRIPT", "TYPESCRIPT"],
                            titel: "Titelcreatemutation",
                            kuenstler: [{
                                name: "Künstlercreatemutation",
                            }]
                        }
                    )
                }
            `,
        };

        // when
        const response: AxiosResponse<GraphQLResponseBody> = await client.post(
            graphqlPath,
            body,
            { headers: authorization },
        );

        // then
        const { status, headers, data } = response;

        expect(status).toBe(HttpStatus.OK);
        expect(headers['content-type']).toMatch(/json/iu);
        expect(data.data).toBeDefined();

        const { create } = data.data!;

        // Der Wert der Mutation ist die generierte ObjectID
        expect(create).toBeDefined();
        expect(LiedReadService.ID_PATTERN.test(create as string)).toBe(true);
    });

    // -------------------------------------------------------------------------
    // eslint-disable-next-line max-lines-per-function
    test('Lied mit ungueltigen Werten neu anlegen', async () => {
        // given
        const token = await loginGraphQL(client);
        const authorization = { Authorization: `Bearer ${token}` }; // eslint-disable-line @typescript-eslint/naming-convention
        const body: GraphQLQuery = {
            query: `
                mutation {
                    create(
                        input: {
                            rating: -1,
                            art: MP3,
                            datum: "12345-123-123",
                            titel: "Lied mit ungueltigen Werten neu anlegen",
                            kuenstler: [{
                                name: "KünstlerName",
                            }]
                        }
                    )
                }
            `,
        };
        const expectedMsg = [
            expect.stringMatching(/^rating /u),
            expect.stringMatching(/^datum /u),
        ];

        // when
        const response: AxiosResponse<GraphQLResponseBody> = await client.post(
            graphqlPath,
            body,
            { headers: authorization },
        );

        // then
        const { status, headers, data } = response;

        expect(status).toBe(HttpStatus.OK);
        expect(headers['content-type']).toMatch(/json/iu);
        expect(data.data!.create).toBeNull();

        const { errors } = data;

        expect(errors).toHaveLength(1);

        const [error] = errors!;
        const extensions: any = error?.extensions;

        expect(extensions).toBeDefined();

        const messages: string[] = extensions?.originalError?.message;

        expect(messages).toBeDefined();
        expect(messages).toHaveLength(expectedMsg.length);
        expect(messages).toEqual(expect.arrayContaining(expectedMsg));
    });

    // -------------------------------------------------------------------------
    test('Neues Lied nur als "admin"/"mitarbeiter"', async () => {
        // given
        const token = await loginGraphQL(client, 'dirk.delta', 'p');
        const authorization = { Authorization: `Bearer ${token}` }; // eslint-disable-line @typescript-eslint/naming-convention
        const body: GraphQLQuery = {
            query: `
            mutation {
                create(
                    input: {
                        rating: 1,
                        art: CD,
                        datum: "2022-02-28",
                        schlagwoerter: ["JAVASCRIPT", "TYPESCRIPT"],
                        titel: "Titelcreatemutation",
                        kuenstler: [{
                            name: "Künstlercreatemutation",
                        }]
                    }
                )
            }
            `,
        };

        // when
        const response: AxiosResponse<GraphQLResponseBody> = await client.post(
            graphqlPath,
            body,
            { headers: authorization },
        );

        // then
        const { status, headers, data } = response;

        expect(status).toBe(HttpStatus.OK);
        expect(headers['content-type']).toMatch(/json/iu);

        const { errors } = data;

        expect(errors).toHaveLength(1);

        const [error] = errors!;
        const { message, extensions } = error!;

        expect(message).toBe('Forbidden resource');
        expect(extensions).toBeDefined();
        expect(extensions!.code).toBe('FORBIDDEN');
    });

    // -------------------------------------------------------------------------
    test('Lied aktualisieren', async () => {
        // given
        const token = await loginGraphQL(client);
        const authorization = { Authorization: `Bearer ${token}` }; // eslint-disable-line @typescript-eslint/naming-convention
        const body: GraphQLQuery = {
            query: `
                mutation {
                    update(
                        input: {
                            id: "11",
                            version: 0,
                            rating: 5,
                            art: MP3,
                            datum: "2021-04-04",
                            schlagwoerter: ["JAVASCRIPT", "TYPESCRIPT"],
                            titel: "Titelupdatemutation",
                        }
                    )
                }
            `,
        };

        // when
        const response: AxiosResponse<GraphQLResponseBody> = await client.post(
            graphqlPath,
            body,
            { headers: authorization },
        );

        // then
        const { status, headers, data } = response;

        expect(status).toBe(HttpStatus.OK);
        expect(headers['content-type']).toMatch(/json/iu);
        expect(data.errors).toBeUndefined();

        const { update } = data.data!;

        // Der Wert der Mutation ist die neue Versionsnummer
        expect(update).toBe(1);
    });

    // -------------------------------------------------------------------------
    // eslint-disable-next-line max-lines-per-function
    test('Lied mit ungueltigen Werten aktualisieren', async () => {
        // given
        const token = await loginGraphQL(client);
        const authorization = { Authorization: `Bearer ${token}` }; // eslint-disable-line @typescript-eslint/naming-convention
        const id = '12';
        const body: GraphQLQuery = {
            query: `
                mutation {
                    update(
                        input: {
                            id: "${id}",
                            version: 0,
                            rating: -1,
                            art: MP3,
                            datum: "12345-123-123",
                            schlagwoerter: ["JAVASCRIPT", "TYPESCRIPT"]
                            titel: "Lied mit ungueltigen Werten aktualisieren",
                        }
                    )
                }
            `,
        };
        const expectedMsg = [
            expect.stringMatching(/^rating /u),
            expect.stringMatching(/^datum /u),
        ];

        // when
        const response: AxiosResponse<GraphQLResponseBody> = await client.post(
            graphqlPath,
            body,
            { headers: authorization },
        );

        // then
        const { status, headers, data } = response;

        expect(status).toBe(HttpStatus.OK);
        expect(headers['content-type']).toMatch(/json/iu);
        expect(data.data!.update).toBeNull();

        const { errors } = data;

        expect(errors).toHaveLength(1);

        const [error] = errors!;
        const extensions: any = error?.extensions;

        expect(extensions).toBeDefined();

        const messages: string[] = extensions.originalError.message;

        expect(messages).toBeDefined();
        expect(messages).toHaveLength(expectedMsg.length);
        expect(messages).toEqual(expect.arrayContaining(expectedMsg));
    });

    // -------------------------------------------------------------------------
    test('Nicht-vorhandenes Lied aktualisieren', async () => {
        // given
        const token = await loginGraphQL(client);
        const authorization = { Authorization: `Bearer ${token}` }; // eslint-disable-line @typescript-eslint/naming-convention
        const id = '999999';
        const body: GraphQLQuery = {
            query: `
                mutation {
                    update(
                        input: {
                            id: "${id}",
                            version: 0,
                            rating: 5,
                            art: MP3,
                            datum: "2021-04-04",
                            schlagwoerter: ["JAVASCRIPT", "TYPESCRIPT"],
                            titel: "Titelupdatemutation",
                        }
                    )
                }
            `,
        };

        // when
        const response: AxiosResponse<GraphQLResponseBody> = await client.post(
            graphqlPath,
            body,
            { headers: authorization },
        );

        // then
        const { status, headers, data } = response;

        expect(status).toBe(HttpStatus.OK);
        expect(headers['content-type']).toMatch(/json/iu);
        expect(data.data!.update).toBeNull();

        const { errors } = data;

        expect(errors).toHaveLength(1);

        const [error] = errors!;
        const { message, path, extensions } = error!;

        expect(message).toBe(
            `Es gibt kein Lied mit der ID ${id.toLowerCase()}`,
        );
        expect(path).toBeDefined();
        expect(path!![0]).toBe('update');
        expect(extensions).toBeDefined();
        expect(extensions!.code).toBe('BAD_USER_INPUT');
    });

    // -------------------------------------------------------------------------
    test('Lied loeschen', async () => {
        // given
        const token = await loginGraphQL(client);
        const authorization = { Authorization: `Bearer ${token}` }; // eslint-disable-line @typescript-eslint/naming-convention
        const body: GraphQLQuery = {
            query: `
                mutation {
                    delete(id: "${idLoeschen}")
                }
            `,
        };

        // when
        const response: AxiosResponse<GraphQLResponseBody> = await client.post(
            graphqlPath,
            body,
            { headers: authorization },
        );

        // then
        const { status, headers, data } = response;

        expect(status).toBe(HttpStatus.OK);
        expect(headers['content-type']).toMatch(/json/iu);
        expect(data.errors).toBeUndefined();

        const deleteMutation = data.data!.delete;

        // Der Wert der Mutation ist true (falls geloescht wurde) oder false
        expect(deleteMutation).toBe(true);
    });
});
/* eslint-enable max-lines, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-extra-non-null-assertion */
