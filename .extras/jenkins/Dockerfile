# syntax=docker/dockerfile:1.5.2

# Copyright (C) 2022 - present Juergen Zimmermann, Hochschule Karlsruhe
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

# Aufruf:   docker buildx build --tag juergenzimmermann/jenkins:2023.1.0 .
#           Get-Content Dockerfile | docker run --rm --interactive hadolint/hadolint:2.12.1-beta-debian
#           docker sbom juergenzimmermann/jenkins:2023.1.0

# https://www.jenkins.io/doc/book/installing/docker
# https://manpages.debian.org/bullseye/apt/apt-get.8.en.html

ARG JENKINS_VERSION=2.402-jdk17
FROM jenkins/jenkins:${JENKINS_VERSION}

USER root

RUN set -ex && \
    apt-get update --yes && \
    apt-get install --no-install-recommends --yes --show-progress lsb-release && \
    apt-get upgrade --yes && \
    apt-get autoremove --yes && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN set -ex && \
    curl -fsSLo /usr/share/keyrings/docker-archive-keyring.asc https://download.docker.com/linux/debian/gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.asc] https://download.docker.com/linux/debian $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list && \
    apt-get update --yes && \
    apt-get install --no-install-recommends --yes --show-progress docker-ce-cli && \
    apt-get upgrade --yes && \
    apt-get autoremove --yes && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

USER jenkins

RUN jenkins-plugin-cli --plugins "blueocean:1.27.3 docker-workflow:563.vd5d2e5c4007f"
