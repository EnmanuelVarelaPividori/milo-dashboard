FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json vitest.config.ts ./
COPY src ./src
COPY migrations ./migrations
RUN npm run build
EXPOSE 3000
CMD ["sh", "-c", "node dist/scripts/migrate.js && node dist/server.js"]
