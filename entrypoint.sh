#!/bin/bash

sed -i "s/port: 4200/port: $PORT/g" /usr/src/app/config.js
sed -i 's/remote: true/remote: $REMOTE/g' /usr/src/app/config.js

exec node /usr/src/app/server.js --save $@
