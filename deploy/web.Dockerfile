# 大陆服务器 Docker Hub 直连受限时，用镜像站替换基础镜像，例如：
#   docker compose build --build-arg NODE_BASE=docker.m.daocloud.io/library/node:22-slim
ARG NODE_BASE=node:22-slim
FROM ${NODE_BASE}

# npm 用国内镜像，避免境外源超时
ARG NPM_REGISTRY=https://registry.npmmirror.com

WORKDIR /app/prototype/mvp-ui
COPY prototype/mvp-ui/package.json prototype/mvp-ui/package-lock.json ./
RUN npm ci --registry=${NPM_REGISTRY}

COPY prototype/mvp-ui ./
RUN npm run build

RUN mkdir -p /app/prototype/workspaces/mvp-demo

EXPOSE 8080
CMD ["npx", "tsx", "server/index.ts"]
