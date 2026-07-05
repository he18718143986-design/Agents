# Stagent 阿里云部署指南

将 Stagent（前端 + 引擎网关 + OpenHands agent-server）部署到阿里云 ECS，绑定域名 stagent.online。

## 架构

```
用户浏览器
   │ https (443)
nginx（TLS 终结，ICP 备案通过后绑定域名）
   │ http 127.0.0.1:8080
web 容器（Node：静态前端 + 引擎网关 + /api、/sockets 反向代理）
   │ http agent-server:8000（Docker 内网）
agent-server 容器（OpenHands，调用 DeepSeek API）
```

## 前置条件

- ECS：建议 2 vCPU / 4 GB 起（agent-server 运行制作任务时占内存），操作系统 Ubuntu 22.04/24.04
- 安全组：放行 80、443（调试期可临时放行 8080）
- 域名 stagent.online 已实名认证；**ICP 备案通过前，域名不能解析到该服务器对外服务**（调试用 `http://服务器IP:8080`）

## 大陆网络环境要点（必读）

境内 ECS 无法稳定访问 Docker Hub、GitHub、Google 等境外服务，本部署包已按以下策略适配：

| 依赖 | 大陆可用性 | 本项目的处理 |
| --- | --- | --- |
| DeepSeek API | ✅ 境内服务，直连 | 默认引擎（不要换成 OpenAI/Claude 等境外 API，会不可达） |
| Docker Hub 基础镜像 | ❌ 直连受限 | Dockerfile 支持 `--build-arg` 替换为镜像站（见下方命令） |
| npm registry | ⚠️ 慢/不稳 | web.Dockerfile 默认使用 npmmirror（淘宝源） |
| PyPI | ⚠️ 慢/不稳 | agent-server.Dockerfile 默认使用阿里云 PyPI 镜像 |
| GitHub 克隆代码 | ⚠️ 慢/易断 | 建议在 Gitee 一键导入 GitHub 仓库作镜像，从 Gitee 克隆 |
| get.docker.com | ⚠️ 慢 | 安装命令带 `--mirror Aliyun` |
| Let's Encrypt (certbot) | ✅ 可用 | 正常使用 |
| Google Fonts | ❌ 阻断 | 前端已移除外链字体，全部使用系统字体栈 |
| GitHub Pages 演示页 | ⚠️ 大陆访问不稳定 | 部署完成后改用你自己的服务器地址做演示 |

## 部署步骤

### 1. 安装 Docker（Ubuntu，阿里云镜像）

```bash
curl -fsSL https://get.docker.com | sh -s -- --mirror Aliyun
sudo usermod -aG docker $USER && newgrp docker
```

### 2. 拉取代码并配置密钥

```bash
# 推荐：先在 gitee.com 用「从 GitHub 导入仓库」创建镜像，再从 Gitee 克隆
git clone https://gitee.com/你的账号/Agents.git stagent
# 或直连 GitHub（可能较慢）：git clone https://github.com/he18718143986-design/Agents.git stagent
cd stagent/deploy
cat > .env <<'EOF'
DEEPSEEK_API_KEY=sk-你的真实密钥
# 可选：
# LLM_MODEL=deepseek/deepseek-chat
# LLM_BASE_URL=https://api.deepseek.com
EOF
chmod 600 .env
```

`.env` 已被 .gitignore 忽略，密钥不会进入仓库。

### 3. 构建并启动

```bash
# Docker Hub 直连通常受限，用镜像站的基础镜像构建：
docker compose build \
  --build-arg PY_BASE=docker.m.daocloud.io/library/python:3.12-slim \
  --build-arg NODE_BASE=docker.m.daocloud.io/library/node:22-slim
docker compose up -d
docker compose ps          # 两个服务应为 running (healthy)
curl http://127.0.0.1:8080/prototype/api/engine-status
# 期望输出 {"agentServer":true,"envKey":true,...}
```

浏览器访问 `http://服务器IP:8080/app` 验证（体验模式 + 真实引擎均可用）。

### 4. nginx + HTTPS（ICP 备案通过后）

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo cp nginx.conf.example /etc/nginx/sites-available/stagent.online
sudo ln -s /etc/nginx/sites-available/stagent.online /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d stagent.online -d www.stagent.online
```

然后在阿里云 DNS 控制台把 `stagent.online` / `www` 的 A 记录指向 ECS 公网 IP。

### 5. 日常运维

```bash
docker compose logs -f web           # 网关日志
docker compose logs -f agent-server  # 引擎日志
docker compose up -d --build         # 更新代码后重新发布
docker compose down                  # 停止（数据卷保留）
```

用户项目产物在 Docker 卷 `stagent_workspaces` 中，建议配置定时备份：

```bash
docker run --rm -v stagent_workspaces:/data -v /backup:/backup alpine \
  tar czf /backup/workspaces-$(date +%F).tar.gz -C /data .
```

## 安全注意事项

- **当前原型没有用户账号体系**：任何知道地址的人都能消耗你的 DeepSeek 额度。公网开放前建议至少加 nginx Basic Auth：
  `sudo apt install apache2-utils && sudo htpasswd -c /etc/nginx/.htpasswd admin`，
  并在 nginx `location /` 中加入 `auth_basic "Stagent"; auth_basic_user_file /etc/nginx/.htpasswd;`
- agent-server 拥有容器内的终端执行能力，请勿将 8000 端口暴露到公网（compose 中仅 expose 给内网）
- 定期查看 DeepSeek 控制台的用量与费用告警
