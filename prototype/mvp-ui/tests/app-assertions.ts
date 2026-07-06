/**
 * R6 + R9 一键断言 CLI（供稳定性实验 002 使用，减少人工验收失误）。
 *
 * 用法：
 *   npx tsx tests/app-assertions.ts <conversationId> <projectSlug> [baseUrl]
 * 例：
 *   npx tsx tests/app-assertions.ts 5e19c034-... req1-baas
 *   npx tsx tests/app-assertions.ts <id> <slug> http://127.0.0.1:8080
 *
 * 环境变量：
 *   BASIC_AUTH_USER / BASIC_AUTH_PASSWORD  服务端启用 Basic Auth 时需设置
 *
 * 退出码：0 = R6 与 R9 全部通过；1 = 有失败；2 = 用法/环境错误。
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runAppCheck } from "../server/appCheck.ts";
import { runPersistenceCheck } from "../server/persistenceCheck.ts";

function fail(msg: string, code = 2): never {
  console.error(msg);
  process.exit(code);
}

const [conversationId, slug, baseUrlArg] = process.argv.slice(2);
if (!conversationId || !slug) {
  fail("用法: npx tsx tests/app-assertions.ts <conversationId> <projectSlug> [baseUrl]");
}

const baseUrl = (baseUrlArg ?? "http://127.0.0.1:5173").replace(/\/$/, "");
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const workspaceDir = path.join(
  repoRoot, "prototype", "workspaces", "mvp-demo", "builds", slug,
);
const appUrl = `${baseUrl}/api/conversations/${conversationId}/workspace/index.html`;
const basicUser = process.env.BASIC_AUTH_USER?.trim();
const basicPassword = process.env.BASIC_AUTH_PASSWORD?.trim();
const basicAuth = basicUser && basicPassword ? { user: basicUser, password: basicPassword } : undefined;

function line(ok: boolean, label: string, detail: string): void {
  console.log(`${ok ? "✅" : "❌"} ${label} — ${detail}`);
}

async function main(): Promise<void> {
  console.log(`\n=== 应用断言：${slug} ===`);
  console.log(`URL: ${appUrl}\n`);

  // R9：自动体检（加载/登录/模块/录入/控制台，附截图证据）
  console.log("[R9] 自动体检…");
  const report = await runAppCheck({ appUrl, workspaceDir, basicAuth });
  for (const check of report.checks) {
    line(check.passed, check.label, check.detail);
  }
  const r9Pass = report.status === "passed";
  console.log(
    `[R9] ${r9Pass ? "通过" : "未通过"}：${report.checks.filter((c) => c.passed).length}/${report.checks.length} 项，耗时 ${(report.durationMs / 1000).toFixed(1)}s`,
  );
  if (report.consoleErrors.length > 0) {
    console.log(`     页面错误 ${report.consoleErrors.length} 条：${report.consoleErrors.slice(0, 3).join(" | ")}`);
  }

  // R6：真实数据保存（跨会话持久化）
  console.log("\n[R6] 跨会话持久化…");
  const persistence = await runPersistenceCheck({ appUrl, workspaceDir, basicAuth });
  line(persistence.passed, "数据保存在服务器（换会话仍在）", persistence.detail);
  console.log(`[R6] ${persistence.passed ? "通过" : "未通过"}，耗时 ${(persistence.durationMs / 1000).toFixed(1)}s`);

  const allPass = r9Pass && persistence.passed;
  console.log(`\n=== 结论：${allPass ? "✅ R6+R9 全部通过" : "❌ 存在未通过项"} ===\n`);
  process.exit(allPass ? 0 : 1);
}

main().catch((error) => {
  console.error("断言运行异常：", error);
  process.exit(2);
});
