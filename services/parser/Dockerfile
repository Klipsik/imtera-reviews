FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --production

RUN bunx playwright install --with-deps chromium

COPY . .

EXPOSE 3001
CMD ["bun", "run", "start"]
