# 大陆服务器 Docker Hub 直连受限时，用镜像站替换基础镜像，例如：
#   docker compose build --build-arg NODE_BASE=docker.m.daocloud.io/library/node:22-slim
ARG NODE_BASE=node:22-slim
FROM ${NODE_BASE}

# npm 用国内镜像，避免境外源超时
ARG NPM_REGISTRY=https://registry.npmmirror.com
# PocketBase 下载源（大陆可改为 ghproxy 等镜像：--build-arg PB_DOWNLOAD_BASE=https://ghproxy.cn/https://github.com/pocketbase/pocketbase/releases/download）
ARG PB_DOWNLOAD_BASE=https://github.com/pocketbase/pocketbase/releases/download
ARG PB_VERSION=0.39.5

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates unzip \
    && rm -rf /var/lib/apt/lists/*

# 预下载 PocketBase 二进制（运行时 server/pocketbase.ts 直接使用，不再联网）
RUN mkdir -p /app/prototype/.pocketbase/bin \
    && curl -sL --max-time 180 -o /tmp/pb.zip \
       "${PB_DOWNLOAD_BASE}/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" \
    && unzip -o -q /tmp/pb.zip pocketbase -d /app/prototype/.pocketbase/bin \
    && rm /tmp/pb.zip \
    && /app/prototype/.pocketbase/bin/pocketbase --version

WORKDIR /app/prototype/mvp-ui
COPY prototype/mvp-ui/package.json prototype/mvp-ui/package-lock.json ./
RUN npm ci --registry=${NPM_REGISTRY}

COPY prototype/mvp-ui ./
RUN npm run build

COPY prototype/templates /app/prototype/templates
RUN mkdir -p /app/prototype/workspaces/mvp-demo /app/prototype/workspaces/pocketbase

# 自动体检用无头浏览器（约 300MB；如需精简镜像可删除本段，体检端点将返回 501）
RUN npx playwright install chromium --with-deps 2>/dev/null || \
    npx playwright install chromium

EXPOSE 8080
CMD ["npx", "tsx", "server/index.ts"]
