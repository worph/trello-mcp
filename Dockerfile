FROM oven/bun:1-alpine AS builder

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile 2>/dev/null || bun install

COPY tsconfig.json ./
COPY src/ ./src/
RUN bun run build

FROM oven/bun:1-alpine

WORKDIR /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 9099/udp 9100/tcp

CMD ["bun", "run", "build/index.js"]
