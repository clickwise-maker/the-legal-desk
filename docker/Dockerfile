# LegalFlow — production container image
FROM node:20-alpine AS base
WORKDIR /app

# Dependencies layer (leverages build cache)
FROM base AS deps
RUN apk add --no-cache libc6-compat poppler-utils
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Build layer
FROM base AS builder
RUN apk add --no-cache libc6-compat poppler-utils python3 make g++
COPY package.json package-lock.json* ./
RUN npm ci
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

# Runtime layer
FROM base AS runner
RUN apk add --no-cache libc6-compat poppler-utils
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Standalone Next.js output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["sh", "-c", "node_modules/.bin/prisma db push --skip-generate && node server.js"]
