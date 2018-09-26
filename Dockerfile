FROM node:10.11.0-slim

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 4200

CMD  [ "node", "server.js", "--save" ]
