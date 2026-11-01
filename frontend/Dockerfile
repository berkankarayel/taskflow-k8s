# ---------- Stage 1: build the React app ----------
FROM node:24-alpine AS build

WORKDIR /app

# Package registry. Later this points to the Nexus npm-proxy:
#   docker build --build-arg NPM_REGISTRY=http://<nexus>:8081/repository/npm-proxy/ ...
ARG NPM_REGISTRY=https://registry.npmjs.org/

# Dependencies first: this layer is rebuilt only when the lock file changes,
# not on every source code change.
COPY package.json package-lock.json ./
RUN npm ci --registry="$NPM_REGISTRY" --no-audit --no-fund

COPY . .
RUN npm run build


# ---------- Stage 2: serve the static files with nginx ----------
FROM nginxinc/nginx-unprivileged:1.28-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Numeric UID (the image's nginx user) so Kubernetes `runAsNonRoot` can verify it.
USER 101

EXPOSE 8080
