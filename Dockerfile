# Cloud Run용 백엔드(Express) 전용 이미지. Next.js는 Vercel에서 서빙하므로 빌드하지 않음.
FROM node:22

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json tsconfig.server.json ./
COPY server ./server
COPY lib ./lib
COPY product.json ./
RUN npx tsc -p tsconfig.server.json

ENV NODE_ENV=production
CMD ["node", "dist/server/index.js"]
