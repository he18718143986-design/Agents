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

## 部署步骤

### 1. 安装 Docker（Ubuntu）

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker
```

国内网络建议配置镜像加速（阿里云容器镜像服务 → 镜像加速器）。

### 2. 拉取代码并配置密钥

```bash
git clone https://github.com/he18718143986-design/Agents.git stagent
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
docker compose up -d --build
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
