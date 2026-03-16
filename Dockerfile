FROM node:22-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist dist/
COPY content/ content/

ENV NODE_ENV=production
ENV TRANSPORT=sse
ENV DB_MODE=sqlite
ENV DB_PATH=/data/validator.db

EXPOSE 3000
CMD ["node", "dist/server.js"]
