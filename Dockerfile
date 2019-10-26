FROM node:lts-alpine

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app/libs
COPY package.json /usr/src/app
RUN npm install

COPY . /usr/src/app
WORKDIR /usr/src/app
RUN npm run tsc

CMD [ "npm", "start" ]
EXPOSE 4000
