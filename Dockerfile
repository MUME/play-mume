FROM node:lts-alpine as builder

WORKDIR /usr/src/app

COPY . .
RUN npm install
RUN npm run tsc
RUN npm test

FROM nginx:alpine
COPY --from=builder /usr/src/app/play.css /usr/share/nginx/html/
COPY --from=builder /usr/src/app/index.html /usr/share/nginx/html/
COPY --from=builder /usr/src/app/manifest.webmanifest /usr/share/nginx/html/
COPY --from=builder /usr/src/app/built /usr/share/nginx/html/built
COPY --from=builder /usr/src/app/icons /usr/share/nginx/html/icons
COPY --from=builder /usr/src/app/DecafMUD /usr/share/nginx/html/DecafMUD
COPY --from=builder /usr/src/app/node_modules/jquery/dist/jquery.min.js /usr/share/nginx/html/node_modules/jquery/dist/jquery.min.js
COPY --from=builder /usr/src/app/node_modules/jquery-throttle-debounce/jquery.ba-throttle-debounce.min.js /usr/share/nginx/html/node_modules/jquery-throttle-debounce/jquery.ba-throttle-debounce.min.js
COPY --from=builder /usr/src/app/node_modules/split.js/dist/split.min.js /usr/share/nginx/html/node_modules/split.js/dist/split.min.js
COPY --from=builder /usr/src/app/node_modules/pixi.js/dist/pixi.min.js /usr/share/nginx/html/node_modules/pixi.js/dist/pixi.min.js
COPY --from=builder /usr/src/app/node_modules/spark-md5/spark-md5.min.js /usr/share/nginx/html/node_modules/spark-md5/spark-md5.min.js

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
