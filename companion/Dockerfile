# Build from the repository root:
#   docker build -f companion/Dockerfile -t lunchmoney-sync .

FROM node:22-alpine AS build
WORKDIR /app
RUN npm install --global pnpm@10
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build:companion

# The runtime image is Node plus one bundled script: no node_modules.
FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/companion/dist/main.js ./main.js
ENV NODE_ENV=production
USER node
EXPOSE 8080
# Unhealthy after a failed sync (until one succeeds) or on an add-on version mismatch.
# BusyBox wget ships with Alpine. 127.0.0.1, not localhost: localhost can resolve to ::1
# first, which fails where IPv6 is off.
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=30s \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/health || exit 1
CMD ["node", "main.js"]
