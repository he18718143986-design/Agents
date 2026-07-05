FROM node:22-slim

WORKDIR /app/prototype/mvp-ui
COPY prototype/mvp-ui/package.json prototype/mvp-ui/package-lock.json ./
# 国内服务器如网络不畅，可加 --registry=https://registry.npmmirror.com
RUN npm ci

COPY prototype/mvp-ui ./
RUN npm run build

RUN mkdir -p /app/prototype/workspaces/mvp-demo

EXPOSE 8080
CMD ["npx", "tsx", "server/index.ts"]
