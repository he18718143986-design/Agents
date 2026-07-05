import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { DEMO_ACCOUNT } from "./pocketbase.ts";

/**
 * 自动体检（验收证据报告）：用无头浏览器对生成应用跑一组确定性检查，
 * 产出逐项通过/失败 + 截图证据。baas 应用是模板化产物，检查无需 LLM。
 *
 * 证据落盘到 workspace 的 checks/ 目录（经 agent-server 静态托管可直接访问）。
 */

export interface AppCheckItem {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
  /** workspace 相对路径，如 checks/module-progress.png */
  screenshot?: string;
}

export interface AppCheckReport {
  status: "passed" | "failed" | "error";
  ranAt: string;
  durationMs: number;
  appTitle: string | null;
  checks: AppCheckItem[];
  consoleErrors: string[];
}

interface ModuleField {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: string[];
}

interface AppModule {
  id: string;
  title: string;
  fields: ModuleField[];
}

/** 在受限上下文中执行 modules.js，读取声明的模块列表。 */
function readDeclaredModules(workspaceDir: string): { title: string; modules: AppModule[] } | null {
  const file = path.join(workspaceDir, "modules.js");
  if (!existsSync(file)) return null;
  try {
    const context: { window: { STAGENT_APP?: { title?: string; modules?: AppModule[] } } } = {
      window: {},
    };
    vm.runInNewContext(readFileSync(file, "utf8"), context, { timeout: 2000 });
    const app = context.window.STAGENT_APP;
    if (!app || !Array.isArray(app.modules)) return null;
    return { title: app.title ?? "", modules: app.modules };
  } catch {
    return null;
  }
}

function fillValueFor(field: ModuleField): string {
  if (field.type === "number") return "42";
  if (field.type === "date") return "2026-07-05";
  return `体检-${field.label}`.slice(0, 20);
}

export interface RunAppCheckOptions {
  /** 应用入口（含 /pb 代理的源），如 http://127.0.0.1:8080/api/conversations/<id>/workspace/index.html */
  appUrl: string;
  workspaceDir: string;
  /** 服务器启用 Basic Auth 时的内部凭证 */
  basicAuth?: { user: string; password: string };
}

export async function runAppCheck(options: RunAppCheckOptions): Promise<AppCheckReport> {
  const started = Date.now();
  const checks: AppCheckItem[] = [];
  const consoleErrors: string[] = [];
  const checksDir = path.join(options.workspaceDir, "checks");
  mkdirSync(checksDir, { recursive: true });

  const declared = readDeclaredModules(options.workspaceDir);

  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({ headless: true });

  const record = (item: AppCheckItem) => {
    checks.push(item);
  };

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      httpCredentials: options.basicAuth
        ? { username: options.basicAuth.user, password: options.basicAuth.password }
        : undefined,
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => consoleErrors.push(String(error.message).slice(0, 300)));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text().slice(0, 300));
    });

    const shot = async (name: string) => {
      const file = `checks/${name}.png`;
      await page.screenshot({ path: path.join(options.workspaceDir, file) });
      return file;
    };

    // 1. 页面加载
    try {
      const response = await page.goto(options.appUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });
      record({
        id: "load",
        label: "应用页面可访问",
        passed: Boolean(response?.ok()),
        detail: response ? `HTTP ${response.status()}` : "无响应",
      });
    } catch (error) {
      record({ id: "load", label: "应用页面可访问", passed: false, detail: String(error).slice(0, 200) });
      throw new Error("页面加载失败，后续检查跳过");
    }

    // 2. 登录（演示账号）
    try {
      await page.waitForSelector("#auth-email", { timeout: 8000 });
      const loginShot = await shot("login");
      await page.fill("#auth-email", DEMO_ACCOUNT.email);
      await page.fill("#auth-password", DEMO_ACCOUNT.password);
      await page.click("#auth-submit");
      await page.waitForSelector("#app-screen:not(.hidden)", { timeout: 10_000 });
      record({
        id: "login",
        label: "演示账号可登录",
        passed: true,
        detail: DEMO_ACCOUNT.email,
        screenshot: loginShot,
      });
    } catch (error) {
      record({
        id: "login",
        label: "演示账号可登录",
        passed: false,
        detail: String(error).slice(0, 200),
        screenshot: await shot("login-failed"),
      });
      throw new Error("登录失败，后续检查跳过");
    }

    // 3. 模块声明与渲染一致
    const tabs = page.locator("#module-tabs .tab");
    const tabCount = await tabs.count();
    const declaredCount = declared?.modules.length ?? null;
    record({
      id: "modules",
      label: "业务模块完整渲染",
      passed: declaredCount === null ? tabCount > 0 : tabCount === declaredCount,
      detail:
        declaredCount === null
          ? `渲染 ${tabCount} 个模块（未能解析 modules.js 声明）`
          : `声明 ${declaredCount} 个 / 渲染 ${tabCount} 个`,
    });

    // 4. 每个模块：页签可切换、表单与表格存在、截图
    const moduleList = declared?.modules ?? [];
    for (let index = 0; index < tabCount; index++) {
      const meta = moduleList[index];
      const tab = tabs.nth(index);
      const title = (await tab.textContent())?.trim() || meta?.title || `模块${index + 1}`;
      try {
        await tab.click();
        const panel = page.locator(".panel.active");
        await panel.waitFor({ timeout: 5000 });
        const hasForm = (await panel.locator("form.add-form").count()) > 0;
        const hasExport = (await panel.locator("button[id^='export-']").count()) > 0;
        record({
          id: `module-${meta?.id ?? index}`,
          label: `「${title}」录入表单与导出可用`,
          passed: hasForm && hasExport,
          detail: `表单 ${hasForm ? "✓" : "✗"} / CSV 导出 ${hasExport ? "✓" : "✗"}`,
          screenshot: await shot(`module-${meta?.id ?? index}`),
        });
      } catch (error) {
        record({
          id: `module-${meta?.id ?? index}`,
          label: `「${title}」渲染`,
          passed: false,
          detail: String(error).slice(0, 200),
        });
      }
    }

    // 5. 真实录入一条体检数据并删除（验证数据链路，且不污染业务数据）
    if (tabCount > 0 && moduleList.length > 0) {
      const module = moduleList[0];
      try {
        await tabs.nth(0).click();
        const panel = page.locator(".panel.active");
        const beforeRows = await panel.locator("tbody tr").count();
        for (const field of module.fields) {
          const input = panel.locator(`[name="${field.key}"]`);
          if ((await input.count()) === 0) continue;
          const tag = await input.evaluate((el) => el.tagName.toLowerCase());
          if (tag === "select") {
            const value = field.options?.[0];
            if (value) await input.selectOption(value);
          } else {
            await input.fill(fillValueFor(field));
          }
        }
        await panel.locator("form.add-form button[type='submit']").click();
        // 等到表格行数超过录入前（第 beforeRows 行出现即新增成功）
        await panel.locator("tbody tr").nth(beforeRows).waitFor({ timeout: 8000 });
        const afterShot = await shot("record-created");

        // 清理体检数据
        page.once("dialog", (dialog) => void dialog.accept());
        await panel.locator("tbody tr").first().locator("button[data-del]").click();
        await page.waitForTimeout(800);

        record({
          id: "crud",
          label: "数据真实写入云端（录入后表格出现新行）",
          passed: true,
          detail: `「${module.title}」录入成功，体检数据已清理`,
          screenshot: afterShot,
        });
      } catch (error) {
        record({
          id: "crud",
          label: "数据真实写入云端",
          passed: false,
          detail: String(error).slice(0, 200),
          screenshot: await shot("record-failed"),
        });
      }
    }

    // 6. 控制台错误
    record({
      id: "console",
      label: "无页面脚本错误",
      passed: consoleErrors.length === 0,
      detail: consoleErrors.length === 0 ? "控制台干净" : `${consoleErrors.length} 条错误（见报告）`,
    });
  } catch (error) {
    if (checks.length === 0) {
      checks.push({
        id: "fatal",
        label: "体检执行",
        passed: false,
        detail: String(error).slice(0, 300),
      });
    }
  } finally {
    await browser.close();
  }

  const report: AppCheckReport = {
    status: checks.every((check) => check.passed) ? "passed" : "failed",
    ranAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    appTitle: declared?.title ?? null,
    checks,
    consoleErrors: consoleErrors.slice(0, 20),
  };

  writeFileSync(
    path.join(options.workspaceDir, "checks", "report.json"),
    JSON.stringify(report, null, 2),
  );
  return report;
}
