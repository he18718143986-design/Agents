# ADR-009：制作/部署 Agent 的每任务容器隔离

> 状态：**已采纳（设计）；待 ECS 实施与验证** ｜ 2026-07-06 ｜ 详细预研见 [sandbox-isolation.md](../../03-engineering/sandbox-isolation.md)

## 背景

制作 Agent 让 LLM 根据用户"需求"生成并执行 shell 命令。现状是所有用户的制作任务共享单个 agent-server 进程（`LocalWorkspace`，`gateway.ts` 三处 bootstrap 打到固定 `127.0.0.1:8000`），构成跨租户远程代码执行面：可读他人数据（含各应用 PocketBase 数据库）、读平台密钥、滥用出网、耗尽资源。这是开放公众注册前必须堵上的最后一块安全板。

## 决策

采用**方案 A：Node 网关为每个 build/deploy 任务编排一个一次性、硬化的 `ghcr.io/openhands/agent-server` 容器**：
- 只挂载该任务 workspace；不注入平台密钥（LLM key 经 bootstrap 请求体临时下发）
- 资源上限（内存/CPU/PID/磁盘）、非 root 只读根文件系统、drop 全部 capabilities、no-new-privileges
- 出网仅放行 LLM 端点（egress 白名单/代理，`--network none` 因需调 LLM 不可行）
- 任务结束销毁；coach 纯对话（无工具）可继续用共享 server
- 复用现有 `server/pocketbase.ts` 的实例管理模式（端口分配/健康探测/idle 回收）

**红线**：方案 A 实施并验证前，不开放公众自助注册使用真实引擎制作；内测期以「可信用户 + Basic Auth + QUOTA_DAILY_BUILDS」过渡。

## 备选与否决理由

| 备选 | 否决理由 |
|---|---|
| B. Python 编排服务用 SDK 的 DockerWorkspace | 多一套语言栈与服务，隔离效果与 A 相同但运维更重 |
| C. gVisor 加固现有共享容器 | 内核级隔离挡不住跨租户文件读取（T1/T2），租户仍共享文件系统 |
| D. Firecracker microVM（E2B 式） | 对 P3 规模过重；自托管需 KVM + Terraform/Nomad，运维成本高 |
| 维持现状 | 开放注册后即远程代码执行漏洞，不可接受 |

## 后果

- 正：达到官方论文所述的 SaaS 多租户隔离；协议层零改动（复用 REST/WS，仅换动态 host:port）；与 PocketBase 实例管理同构，可复用代码
- 负：制作从"共享常驻"变"按任务拉起"，冷启动增加耗时（可能需容器预热池）；web 容器编排 docker 引入提权面（socket 挂载需评估，倾向 rootless/独立编排）；egress 白名单需在 ECS 上敲定
- 待验证（ECS）：egress 策略、docker 编排安全方式、冷启动体验、大陆镜像拉取——见预研文档第 6、8 节
