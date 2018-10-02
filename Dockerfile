FROM node:10.11.0-stretch as builder

WORKDIR /tmp/

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && apt-get install -y --no-install-recommends build-essential \
    && apt-get install -y --no-install-recommends m4 \
    && apt-get install -y --no-install-recommends aspcud \
    && apt-get install -y --no-install-recommends ocaml \
    && apt-get install -y --no-install-recommends opam \
    && apt-get install -y --no-install-recommends pkg-config \
    && apt-get install -y --no-install-recommends zlib1g-dev \
    && apt-get install -y --no-install-recommends libgmp-dev \
    && apt-get install -y --no-install-recommends libffi-dev \
    && apt-get install -y --no-install-recommends libssl-dev \
    && apt-get install -y --no-install-recommends libboost-system-dev \
    && apt-get install -y --no-install-recommends apt-transport-https \
    && apt-get install -y --no-install-recommends ca-certificates \
    && apt-get install -y --no-install-recommends software-properties-common \
    && apt-get install -y --no-install-recommends git \
    && cd /tmp/ \
    && git clone https://github.com/Zilliqa/scilla.git \
    && cd scilla \
    && make opamdep \
    && eval `opam config env` \
    && make clean; make \
    && make test

FROM node:10.11.0-stretch as runtime
WORKDIR /usr/src/app
ENV PORT 4200
ENV REMOTE true
COPY package*.json ./
COPY entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh \
    && chown node: /usr/src/app

USER node

RUN npm install

COPY . .
COPY --from=builder /tmp/scilla/bin/scilla-runner /usr/src/app/bin/

ENTRYPOINT [ "/usr/local/bin/entrypoint.sh" ]
