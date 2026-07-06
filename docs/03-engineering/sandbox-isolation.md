# 沙箱隔离预研：制作/部署 Agent 的每任务隔离

> 状态：**预研（设计已定，待 ECS 实施）** ｜ 最后更新：2026-07-06 ｜ 决策：[ADR-009](../01-strategy/adr/ADR-009-sandbox-isolation.md)
>
> 本文是多用户上线前的安全设计。本机（Cursor Cloud VM）无 Docker，无法运行验证——文末给出可直接在阿里云 ECS 上执行的验证脚本。

## 1. 为什么这是"最后一块板"

制作 Agent 的本质是：**把用户的自然语言"需求"交给 LLM，LLM 生成 shell 命令与文件编辑操作，在服务器上真实执行**（`buildPrompt.ts` 授予 `terminal` / `file_editor` / `task_tracker` 工具）。这意味着——**用户的输入间接控制了服务器上执行的命令**。单用户/内测期可控；一旦对公众开放，这就是远程代码执行面。

## 2. 当前架构与威胁模型

### 2.1 现状（单一共享 agent-server）

```
web 网关(Node)  ──POST /api/conversations──►  单个 agent-server 进程 (127.0.0.1:8000)
   每个制作任务                                   LocalWorkspace，working_dir = 
   传 working_dir                                prototype/workspaces/mvp-demo/builds/<slug>
                                                 ↑ 所有用户的制作 Agent 都在这一个进程/容器里执行 shell
```

- 证据：`gateway.ts` 对每个制作任务 POST `workspace: { working_dir: workspaceDir }` 到同一个 `agentServer`（`127.0.0.1:8000`），三处 bootstrap（coach/build/deploy）共用（`gateway.ts:278,414,459`）。
- agent-server 的 `Config` 有 `max_concurrent_runs`（并发上限）、`session_api_keys`（会话鉴权），但**没有每会话的操作系统级隔离**——它是单进程，所有工具调用在同一文件系统、同一身份下执行。

### 2.2 威胁清单（公众开放后）

| # | 威胁 | 当前是否可防 |
|---|---|---|
| T1 | 恶意"需求"诱导 build agent 读取其他用户的 workspace / PocketBase SQLite（`workspaces/pocketbase/*/data.db`，含他人业务数据） | ❌ 同一文件系统，路径可越界 |
| T2 | 读取平台密钥（`DEEPSEEK_API_KEY` 等环境变量、`.env`） | ❌ 同进程环境变量可见 |
| T3 | 出站网络滥用（挖矿、扫描、数据外传、DDoS 跳板） | ❌ 容器有完整出网 |
| T4 | 资源耗尽（fork 炸弹、占满 CPU/内存/磁盘，拖垮所有租户） | ⚠️ 仅 `max_concurrent_runs` 限并发，无单任务资源上限 |
| T5 | 容器逃逸 / 影响宿主 | ⚠️ 取决于容器运行时 |
| T6 | 生成应用运行期风险（这块已较好：每应用独立 PocketBase 实例 + slug 隔离，见 ADR-003） | ✅ 已隔离 |

**结论**：T6（运行期）已解决；T1–T5（制作/部署期）是缺口。

## 3. OpenHands 原生隔离能力（已核实）

OpenHands SDK 原生支持三种 workspace（`openhands/sdk/workspace/`）：

| Workspace | 隔离级别 | 适配我们的架构 |
|---|---|---|
| `LocalWorkspace` | 无（同进程/同机） | 现状 |
| `DockerWorkspace`（`openhands-workspace` 包 / `openhands.workspace`） | **每任务一个 `ghcr.io/openhands/agent-server` 容器**，SDK 经 HTTP/WS 通信 | 官方推荐的隔离路径；但它是 Python SDK 的上下文管理器，我们网关是 Node |
| `APIRemoteWorkspace` | 托管 runtime（all-hands 云） | 依赖外部服务，不适合境内自托管 |

论文明确："Each agent instance runs in an independent container with a dedicated file system, environment, and resource. This containerized design ... enables SaaS-style multi-tenancy while preserving workspace isolation."（arxiv 2511.03690）——**这正是我们要的模式**。

关键认识：**"每任务一个 agent-server 容器"是官方设计的多租户方案**。分歧只在"谁来编排容器"——SDK 的 `DockerWorkspace` 用 Python 编排；我们是 Node 网关，可以自己编排 `docker run`，也可以引入一个薄 Python 编排服务。

## 4. 候选方案对比

| 方案 | 描述 | 隔离强度 | 改动量 | 运维复杂度 |
|---|---|---|---|---|
| **A. Node 编排 per-task 容器**（推荐） | 网关为每个 build/deploy 任务 `docker run` 一个 `ghcr.io/openhands/agent-server` 容器，只挂载该任务 workspace、限资源、限网络、不传平台密钥；任务结束销毁 | 高（容器级 + 文件/网络/资源边界） | 中（网关新增容器编排；agent-server 从"共享常驻"变"按任务拉起"） | 中 |
| B. 引入 Python 编排服务用 `DockerWorkspace` | 新增一个 Python 微服务，用 SDK 的 DockerWorkspace 管理容器，Node 网关调它 | 高（同 A） | 大（多一个服务 + 语言栈） | 高 |
| C. gVisor / Kata 强化现有共享容器 | 保持单 agent-server，但跑在 gVisor（runsc）沙箱内核上 | 中（内核级隔离，但**租户间仍共享文件系统**，防不住 T1/T2） | 小 | 中 |
| D. Firecramaker microVM（E2B 式） | 每任务一个 microVM | 最高 | 很大 | 很高（需要 KVM，阿里云需特定实例族） |

**否决理由**：B 多一套语言栈不值得；C 挡不住核心的跨租户读取（T1/T2）；D 对 P3 规模过重（E2B 自托管需 Terraform+Nomad，之前调研已记录）。

## 5. 推荐方案 A：Node 编排 per-task 容器

### 5.1 目标形态

```
web 网关(Node)
  │ 每个制作/部署任务：
  │  1. docker run 一个一次性 agent-server 容器（下方硬化参数）
  │  2. 等待容器内 /health，拿到映射端口
  │  3. 把 bootstrap 请求打到该容器（沿用现有 REST/WS 协议，仅换 host:port）
  │  4. 产物通过挂载的 workspace 目录取回；任务结束 docker rm
  ▼
[task 容器 A]  [task 容器 B]  ...   ← 相互隔离，各自只见自己的 workspace
```

**优势**：现有 gateway 的 bootstrap/事件流协议**完全复用**，只是把固定的 `127.0.0.1:8000` 换成"每任务动态 host:port"——与我们已经为 PocketBase 做的"按 slug 拉起实例 + 端口分配"（`server/pocketbase.ts`）是同一套模式，可复用其 `findFreePort` / 健康探测 / 生命周期管理代码。

### 5.2 容器硬化参数（每个任务容器）

| 维度 | 参数 | 防御 |
|---|---|---|
| 文件系统 | 只 `-v <该任务workspace>:/workspace`，不挂任何其他目录 | T1（跨租户读取） |
| 密钥 | **不注入平台 `DEEPSEEK_API_KEY`**；LLM key 由网关在 bootstrap 请求体里按需下发给该容器，用完即弃 | T2 |
| 网络 | `--network none`（制作阶段不需出网；如需拉 npm 包则用受限代理网络 + 白名单） | T3 |
| 资源 | `--memory=1g --cpus=1 --pids-limit=256 --storage-opt size=2g` | T4 |
| 身份 | `--user 10001:10001`（非 root，镜像已内置 UID 10001）+ `--read-only` 根文件系统 + `--tmpfs /tmp` | T5 |
| 能力 | `--cap-drop=ALL --security-opt no-new-privileges` | T5 |
| 生命周期 | `--rm` + 网关侧超时强杀（如 10 分钟） | T4/T5 |
| 内核（可选加固） | 宿主装 gVisor，`--runtime=runsc` | T5 |

### 5.3 与 baas 数据底座的关系

生成应用的 PocketBase 实例（运行期数据）**不进任务容器**——制作只产出静态模板文件（`modules.js` 等），数据库由平台侧管理（现状）。因此任务容器可以 `--network none`，不影响生成应用后续的真实数据能力。这条边界很干净。

### 5.4 需要改动的代码点

1. `server/pocketbase.ts` 的实例管理（`findFreePort` / `ensureInstance` / 健康探测 / idle 回收）抽象为通用「容器实例管理器」，PocketBase 与 agent-server 任务容器共用。
2. `gateway.ts`：`handleBuildBootstrap` / `handleDeployBootstrap` 从"POST 到固定 agentServer"改为"拉起任务容器 → POST 到该容器 → 完成后回收"。coach 对话（无工具、纯 LLM）可继续用共享 server（无 RCE 面），只有带工具的 build/deploy 需要隔离。
3. `deploy/docker-compose.yml`：web 容器需要能 `docker run`（挂载 `/var/run/docker.sock` 或用 DinD/rootless docker——**socket 挂载本身是提权面，需评估**；更稳的是 web 容器通过受限的 docker API 代理，或 web 跑在宿主而非容器）。
4. 预拉取 `ghcr.io/openhands/agent-server:<pinned>` 镜像（大陆需镜像加速，同部署文档策略）。

## 6. 在 ECS 上的验证方案（可直接执行）

> 本机无 Docker，以下脚本在阿里云 ECS（已装 Docker）上执行以验证隔离设计成立。

### 验证 1：per-task 容器可拉起并跑通 bootstrap
```bash
# 拉官方镜像（大陆用加速器）
docker pull ghcr.io/openhands/agent-server:latest-python || \
  docker pull <镜像加速地址>/openhands/agent-server:latest-python

# 硬化参数启动一次性任务容器
docker run -d --name oh-task-test \
  --rm --user 10001:10001 \
  --network none \
  --memory=1g --cpus=1 --pids-limit=256 \
  --cap-drop=ALL --security-opt no-new-privileges \
  --read-only --tmpfs /tmp \
  -v "$PWD/task-ws:/workspace" \
  -p 18010:8000 \
  ghcr.io/openhands/agent-server:latest-python
# 注意：--network none 时无法映射端口；验证网络策略时改用自定义 bridge + 无出网规则
```

### 验证 2：跨租户读取被阻断（核心断言）
在容器内让 agent 尝试 `cat /etc/hostname`（应成功）与访问宿主其他 workspace 路径（应失败，因未挂载）。断言：容器内 `ls /workspace` 只有本任务文件，无其他 slug。

### 验证 3：密钥不可见
断言：容器内 `env | grep -i deepseek` 为空；LLM key 仅在 bootstrap 请求体内出现，不在容器环境变量里。

### 验证 4：出网被阻断
断言：`--network none` 下容器内 `curl https://api.deepseek.com` 失败——**这引出一个设计约束**：LLM 调用是 agent-server 容器发起的，需要出网到 DeepSeek。因此 `--network none` 不可行，应改为**自定义 bridge 网络 + iptables 白名单（仅放行 DeepSeek API 域名/IP）**，或让 LLM 调用经由网关侧代理。这一点必须在验证阶段敲定。

> ⚠️ 验证 4 暴露的问题是本设计最需要在 ECS 上敲定的细节：制作容器既要出网调 LLM，又要防止任意出网。方案倾向：容器走一个只放行 DeepSeek 端点的 egress 代理。

## 7. 分阶段落地建议

| 阶段 | 动作 | 触发条件 |
|---|---|---|
| 现在（内测） | 保持共享 server + **Basic Auth 限制访问人群**（已实现）+ `QUOTA_DAILY_BUILDS`（已实现）；内测用户是已知可信的真实客户，RCE 面可接受 | — |
| P3 前（放开注册前） | 实施方案 A：per-task 容器 + 硬化参数 + egress 白名单；ECS 上完成验证 1–4 | 开放公众注册**之前必须完成** |
| 规模化 | 视负载引入容器编排（K8s / Nomad）、gVisor 内核加固、镜像与 egress 代理的集中管理 | 并发量上升后 |

**硬性红线**：**在实施方案 A 之前，不得开放公众自助注册使用真实引擎制作**。内测阶段靠"可信用户 + Basic Auth + 限额"控制风险是可接受的过渡。

## 8. 待 ECS 敲定的开放问题

1. egress 策略：`--network none` 不可行（需调 LLM），最终用白名单代理还是自定义 bridge + iptables？
2. web 容器如何安全地编排 docker：挂 socket（提权面）vs rootless docker vs 独立编排服务？
3. 任务容器冷启动耗时（拉起 + /health）对用户体验的影响，是否需要预热容器池？
4. 镜像大陆拉取：`ghcr.io` 加速方案（同部署文档的 Docker Hub 策略）。
