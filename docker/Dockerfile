FROM ubuntu:bionic

RUN apt update
RUN apt -y install \
		sudo \
		# openssh-server \
		git \
		npm

RUN useradd kaya --uid 1000 -m

EXPOSE 4200

WORKDIR /home/kaya
USER kaya

RUN git clone https://github.com/yoeriapts/kaya.git && \
    cd kaya && \
    npm install

ENTRYPOINT cd kaya && \
           npm run debug:fixtures && \
           bash

