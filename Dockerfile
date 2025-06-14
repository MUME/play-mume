FROM node:lts-alpine as builder

WORKDIR /usr/src/app

COPY . .
RUN npm install
RUN npm run lint:check
RUN npm run build
RUN npm test

FROM nginx:alpine
COPY --from=builder /usr/src/app/dist/ /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
