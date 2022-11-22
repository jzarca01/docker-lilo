FROM node:16
RUN apt-get update
RUN apt-get install -y bluetooth bluez libbluetooth-dev libudev-dev
RUN ln -s /usr/bin/nodejs /usr/bin/node

ENV ENVIRONMENT=DEV

WORKDIR /app

COPY ["package.json", "package-lock.json", "./"]

RUN npm install

COPY . .

CMD [ "node", "index.js" ]