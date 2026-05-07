FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json vitest.config.ts ./
COPY src ./src
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/server.js"]
