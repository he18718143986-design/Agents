# ADR-001：用 OpenHands 作为编码引擎

> 状态：已采纳 ｜ 2026-07-05 记录（决策实际发生于原型期）

## 背景

需要一个"AI 写代码"的执行引擎，驱动教练对话、制作 Agent、部署 Agent。

## 决策

使用 **OpenHands（openhands-sdk / openhands-agent-server，MIT）** 作为唯一引擎，通过 HTTP/WS 协议对接（`src/engine/openhandsClient.ts` 抽象层），以 PyPI 依赖方式引入，**不拷贝源码入仓**。

## 备选与否决理由

| 备选 | 否决理由 |
|---|---|
| fork bolt.diy | 架构不同轨（浏览器 WebContainers vs 服务端沙箱）；WebContainers 商用需 StackBlitz 授权；交互设计可借鉴但代码复用价值低 |
| Aider 作第二引擎 | 混两个引擎增加复杂度；借鉴其 repo map / diff 编辑**方法**改造提示词即可 |
| SWE-agent / Hermes | 研究项目/通用框架，非产品级基础设施 |
| 自研 Agent 循环 | 重复造轮子，护城河不在引擎层 |

## 后果

- 正：会话管理、工具执行、workspace 静态托管开箱即用；升级跟随上游（如 1.31 工具注册变更已在 #4 适配）
- 负：受上游 API 破坏性变更影响（已发生一次）；缓解：对接层隔离 + AGENTS.md 记录版本注意事项
- 商业化注意：MIT 不含商标授权，产品名不用 OpenHands 字样，可致谢"Built on OpenHands"
