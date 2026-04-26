FROM node:22-alpine AS base

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps

COPY package.json package-lock.json ./
RUN npm ci

FROM base AS tools

COPY --from=deps /app/node_modules ./node_modules
COPY . .

FROM tools AS builder

RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
RUN rm -f .env .env.*

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "const http=require('node:http'); const port=process.env.PORT||3000; const req=http.get({host:'127.0.0.1', port, path:'/api/health', timeout:4000}, (res)=>process.exit(res.statusCode===200?0:1)); req.on('error',()=>process.exit(1)); req.on('timeout',()=>{req.destroy(); process.exit(1);});"

CMD ["sh", "-c", "node scripts/validate-env.mjs && node server.js"]
