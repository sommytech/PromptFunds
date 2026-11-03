# Container deployment (Render, Railway, Fly.io, AWS ECS, Azure Container Apps).
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
USER node
EXPOSE 3000
# Run migrations as a release step: `npx prisma migrate deploy && npm run db:seed`
CMD ["node", "server.js"]
