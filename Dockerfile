# syntax=docker/dockerfile:1
ARG NODE_VERSION=22-bookworm-slim
FROM node:${NODE_VERSION} AS base
WORKDIR /app
ENV NODE_ENV=production
# skia-canvas renders PNGs without Chrome or a separate browser service.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates fontconfig libfontconfig1 && \
    rm -rf /var/lib/apt/lists/*

FROM base AS build
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential python3 pkg-config && rm -rf /var/lib/apt/lists/*
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=false --network-timeout=120000
COPY . .
# Railway passes service variables to matching Docker build arguments.
# These public URL settings must be identical at build time and runtime.
ARG TI4_BASE_PATH=""
ARG VITE_PUBLIC_ORIGIN=""
ARG VITE_POSTHOG_KEY=""
ENV TI4_BASE_PATH=${TI4_BASE_PATH} VITE_PUBLIC_ORIGIN=${VITE_PUBLIC_ORIGIN}
RUN yarn build
RUN yarn install --frozen-lockfile --production=true --network-timeout=120000 && yarn cache clean

FROM base AS runtime
ARG TI4_BASE_PATH=""
ARG VITE_PUBLIC_ORIGIN=""
ENV TI4_BASE_PATH=${TI4_BASE_PATH} VITE_PUBLIC_ORIGIN=${VITE_PUBLIC_ORIGIN}
ENV TI4_LAB_DATABASE_PATH=file:///data/sqlite.db
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/app ./app
COPY --from=build /app/server.ts /app/package.json /app/tsconfig.json ./
# The renderer reads public assets from disk; reuse the client copy.
RUN ln -s build/client public && mkdir -p /data
EXPOSE 3000
CMD ["node", "--import", "tsx", "server.ts"]
