FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache dumb-init openssl

FROM base AS deps
COPY package*.json ./
COPY backend/package.json ./backend/
COPY shared/package.json ./shared/
COPY frontend/package.json ./frontend/
RUN npm ci --omit=dev

FROM base AS build
COPY package*.json ./
COPY backend/package.json ./backend/
COPY shared/package.json ./shared/
COPY frontend/package.json ./frontend/
RUN npm ci
COPY backend ./backend
COPY shared ./shared
RUN npx prisma generate --schema backend/prisma/schema.prisma
RUN npm run build --workspace=shared
RUN npm run build --workspace=backend

FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY backend/start.sh ./start.sh
RUN chmod +x start.sh

EXPOSE 3001

ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "start.sh"]
