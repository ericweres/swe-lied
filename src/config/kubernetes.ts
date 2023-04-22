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
 * Das Modul enthält die Information, ob man innerhalb von Kubernetes ist.
 * @packageDocumentation
 */

import { env } from './env.js';
import { hostname } from 'node:os';

// DNS-Name eines Kubernetes-Pod endet z.B. mit -75469ff64b-q3bst
const kubernetesRegexp = /^\w+-[a-z\d]{8,10}-[a-z\d]{5}$/u;
const isK8s = kubernetesRegexp.exec(hostname()) !== null;
const { K8S_TLS, LOG_DEFAULT } = env;

/**
 * Das Konfigurationsobjekt für Kubernetes.
 */
// "as const" fuer readonly
// https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-4.html#const-assertions
// TODO records als "deeply immutable data structure" (Stage 2)
// https://github.com/tc39/proposal-record-tuple
export const k8sConfig = {
    detected: isK8s,
    tls: K8S_TLS === undefined || K8S_TLS.toLowerCase() === 'true',
} as const;

if (LOG_DEFAULT?.toLowerCase() !== 'true') {
    console.debug('k8sConfig: %o', k8sConfig);
}
