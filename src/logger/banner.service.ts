/*
 * Copyright (C) 2021 - present Juergen Zimmermann, Florian Goebel, Hochschule Karlsruhe
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
 * Das Modul enthält die Funktion, um die Test-DB neu zu laden.
 * @packageDocumentation
 */

import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { release, type, userInfo } from 'node:os';
import { dbType } from '../config/dbtype.js';
import figlet from 'figlet';
import { getLogger } from './logger.js';
import { hash } from 'argon2';
import { k8sConfig } from '../config/kubernetes.js';
import { nodeConfig } from '../config/node.js';
import process from 'node:process';

/**
 * Beim Start ein Banner ausgeben durch `onApplicationBootstrap()`.
 */
@Injectable()
export class BannerService implements OnApplicationBootstrap {
    readonly #logger = getLogger(BannerService.name);

    /**
     * Die Test-DB wird im Development-Modus neu geladen.
     */
    async onApplicationBootstrap() {
        const { host, httpsOptions, nodeEnv, port, serviceHost, servicePort } =
            nodeConfig;
        const isK8s = k8sConfig.detected;
        const plattform = isK8s
            ? `Kubernetes: BUCH_SERVICE_HOST=${serviceHost}, BUCH_SERVICE_PORT=${servicePort}`
            : 'Kubernetes: N/A';

        figlet('buch', (_, data) => console.info(data));
        // https://nodejs.org/api/process.html
        // "Template String" ab ES 2015
        this.#logger.info('Node: %s', process.version);
        this.#logger.info('NODE_ENV: %s', nodeEnv);
        this.#logger.info(plattform);

        const desPods = isK8s ? ' des Pods' : '';
        this.#logger.info('Rechnername%s: %s', desPods, host);
        this.#logger.info('Port%s: %s', desPods, port);
        this.#logger.info(
            '%s',
            httpsOptions === undefined ? 'HTTP (ohne TLS)' : 'HTTPS',
        );
        this.#logger.info('DB-System: %s', dbType);
        this.#logger.info('Betriebssystem: %s (%s)', type(), release());
        this.#logger.info('Username: %s', userInfo().username);
        this.#logger.info('GraphQL playground: %s', '/graphql');

        // const options: argon2.Options = {...};
        // Argon2 Defaultwerte https://www.rfc-editor.org/rfc/rfc9106.txt
        // t=1 iteration,
        // p=4 lanes,
        // m=2^21 (2 GiB of RAM),
        // 128-bit salt, and
        // 256-bit tag size
        const hashValue = await hash('p');
        this.#logger.debug('argon2id: p -> %s', hashValue);
    }
}
