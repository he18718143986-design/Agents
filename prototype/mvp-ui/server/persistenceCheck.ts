import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { DEMO_ACCOUNT } from "./pocketbase.ts";

/**
 * R6 断言：真实数据保存（跨会话持久化）。
 *
 * 流程：浏览器上下文 1 登录 → 首个模块录入带唯一标记的记录 → 完全销毁上下文
 * （清空该浏览器全部存储）→ 全新上下文 2 重新登录 → 断言该记录仍在。
 * 这证明数据存在服务器（PocketBase），而非浏览器本地。
 */

export interface PersistenceCheckResult {
  passed: boolean;
  detail: string;
  marker: string;
  firstContextSaw: boolean;
  secondContextSaw: boolean;
  durationMs: number;
}

interface ModuleField {
  key: string;
  label: string;
  type?: string;
  options?: string[];
}

interface AppModule {
  id: string;
  title: string;
  fields: ModuleField[];
}

function readFirstModule(workspaceDir: string): AppModule | null {
  const file = path.join(workspaceDir, "modules.js");
  if (!existsSync(file)) return null;
  try {
    const context: { window: { STAGENT_APP?: { modules?: AppModule[] } } } = { window: {} };
    vm.runInNewContext(readFileSync(file, "utf8"), context, { timeout: 2000 });
    return context.window.STAGENT_APP?.modules?.[0] ?? null;
  } catch {
    return null;
  }
}

function fillValueFor(field: ModuleField, marker: string): string {
  // 第一个文本字段放唯一标记，便于跨会话查找
  if (field.type === "number") return "42";
  if (field.type === "date") return "2026-07-06";
  return marker;
}

export interface PersistenceCheckOptions {
  appUrl: string;
  workspaceDir: string;
  basicAuth?: { user: string; password: string };
}

export async function runPersistenceCheck(
  options: PersistenceCheckOptions,
): Promise<PersistenceCheckResult> {
  const started = Date.now();
  const marker = `R6-${Date.now().toString(36)}`;
  const module = readFirstModule(options.workspaceDir);

  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({ headless: true });

  const newContext = async () => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      httpCredentials: options.basicAuth
        ? { username: options.basicAuth.user, password: options.basicAuth.password }
        : undefined,
    });
    return context;
  };

  const login = async (page: import("playwright-core").Page) => {
    await page.goto(options.appUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.waitForSelector("#auth-email", { timeout: 8000 });
    await page.fill("#auth-email", DEMO_ACCOUNT.email);
    await page.fill("#auth-password", DEMO_ACCOUNT.password);
    await page.click("#auth-submit");
    await page.waitForSelector("#app-screen:not(.hidden)", { timeout: 10_000 });
  };

  const result: PersistenceCheckResult = {
    passed: false,
    detail: "",
    marker,
    firstContextSaw: false,
    secondContextSaw: false,
    durationMs: 0,
  };

  try {
    if (!module) {
      result.detail = "无法解析 modules.js，跳过持久化断言";
      return result;
    }

    // 上下文 1：录入带标记的记录
    const ctx1 = await newContext();
    const page1 = await ctx1.newPage();
    await login(page1);
    const panel1 = page1.locator(".panel.active");
    for (const field of module.fields) {
      const input = panel1.locator(`[name="${field.key}"]`);
      if ((await input.count()) === 0) continue;
      const tag = await input.evaluate((el) => el.tagName.toLowerCase());
      if (tag === "select") {
        const value = field.options?.[0];
        if (value) await input.selectOption(value);
      } else {
        await input.fill(fillValueFor(field, marker));
      }
    }
    await panel1.locator("form.add-form button[type='submit']").click();
    // 等标记出现在表格
    await page1.getByText(marker, { exact: false }).first().waitFor({ timeout: 8000 });
    result.firstContextSaw = true;
    await ctx1.close(); // 完全销毁：清空该浏览器全部存储

    // 上下文 2：全新浏览器会话，重新登录，断言记录仍在
    const ctx2 = await newContext();
    const page2 = await ctx2.newPage();
    await login(page2);
    try {
      await page2.getByText(marker, { exact: false }).first().waitFor({ timeout: 8000 });
      result.secondContextSaw = true;
    } catch {
      result.secondContextSaw = false;
    }
    await ctx2.close();

    result.passed = result.firstContextSaw && result.secondContextSaw;
    result.detail = result.passed
      ? `记录「${marker}」在全新浏览器会话中仍可见 → 数据保存在服务器`
      : `记录在全新会话中${result.secondContextSaw ? "可见" : "丢失"}（录入${result.firstContextSaw ? "成功" : "失败"}）`;
  } catch (error) {
    result.detail = `持久化断言执行出错：${String(error).slice(0, 200)}`;
  } finally {
    await browser.close();
    result.durationMs = Date.now() - started;
  }

  return result;
}
