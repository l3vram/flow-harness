# syntax=docker/dockerfile:1
#
# Multi-stage build for the flow harness. Everything — dependency install, compile, tests —
# happens inside the container, so nothing platform-specific is installed on the host and the
# same image runs identically locally and remotely.

# --- build: install workspace deps (with source present) and compile ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json tsconfig.json vitest.config.ts ./
COPY packages ./packages
RUN npm ci
RUN npm run build

# --- test: run the unit + CLI-parity suites (target for `docker compose run test`) ---
FROM build AS test
CMD ["npm", "test"]

# --- runtime: the `flow` CLI; run state persists on the /work volume ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages ./packages
# Commands run from /work so the .flow event log + state land on the mounted volume.
WORKDIR /work
ENV FLOW_STATE=/work/.flow/state.json
ENTRYPOINT ["node", "/app/packages/cli/dist/cli.js"]
CMD ["help"]
