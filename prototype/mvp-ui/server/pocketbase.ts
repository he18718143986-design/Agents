import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";

/**
 * Per-app PocketBase instance manager (baas-mvp tier).
 *
 * Each build slug gets its own PocketBase process + SQLite data dir under
 * prototype/workspaces/pocketbase/<slug>. Instances are started on demand,
 * provisioned idempotently (superuser, app_data collection, demo account),
 * and reached by the frontend through the /pb/<slug>/ reverse proxy.
 */

const PB_VERSION = process.env.PB_VERSION ?? "0.39.5";
const PB_DOWNLOAD_BASE =
  process.env.PB_DOWNLOAD_BASE ??
  "https://github.com/pocketbase/pocketbase/releases/download";
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL ?? "admin@stagent.local";
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD ?? "stagent-admin-2026";

export const DEMO_ACCOUNT = {
  email: "demo@stagent.online",
  password: "demo1234567",
};

const PORT_RANGE_START = 8901;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

export interface PbInstance {
  slug: string;
  port: number;
  dataDir: string;
  process: ChildProcess;
}

const instances = new Map<string, PbInstance>();
const pending = new Map<string, Promise<PbInstance>>();

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

function binaryPath(repoRoot: string): string {
  return path.join(repoRoot, "prototype", ".pocketbase", "bin", "pocketbase");
}

/** Download the PocketBase binary if missing (uses curl + unzip). */
export function ensureBinary(repoRoot: string): string {
  const bin = binaryPath(repoRoot);
  if (existsSync(bin)) return bin;

  const dir = path.dirname(bin);
  mkdirSync(dir, { recursive: true });
  const url = `${PB_DOWNLOAD_BASE}/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip`;
  console.log(`[pocketbase] downloading ${url}`);
  const zipPath = path.join(dir, "pb.zip");
  const download = spawnSync("curl", ["-sL", "--max-time", "120", "-o", zipPath, url]);
  if (download.status !== 0) {
    throw new Error(
      `PocketBase 下载失败（${url}）。大陆服务器请设置 PB_DOWNLOAD_BASE 为镜像地址，或手动放置二进制到 ${bin}`,
    );
  }
  const unzip = spawnSync("unzip", ["-o", "-q", zipPath, "pocketbase", "-d", dir]);
  spawnSync("rm", ["-f", zipPath]);
  if (unzip.status !== 0 || !existsSync(bin)) {
    throw new Error("PocketBase 解压失败，请确认已安装 unzip");
  }
  return bin;
}

function findFreePort(startAt: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", () => {
      probe.close();
      if (startAt > PORT_RANGE_START + 500) {
        reject(new Error("no free port for PocketBase"));
        return;
      }
      resolve(findFreePort(startAt + 1));
    });
    probe.listen(startAt, "127.0.0.1", () => {
      probe.close(() => resolve(startAt));
    });
  });
}

async function waitForHealth(port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
        signal: AbortSignal.timeout(1500),
      });
      if (res.ok) return;
    } catch {
      // keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("PocketBase 实例启动超时");
}

async function adminToken(port: number): Promise<string> {
  const res = await fetch(
    `http://127.0.0.1:${port}/api/collections/_superusers/auth-with-password`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    },
  );
  if (!res.ok) throw new Error(`PocketBase 管理员鉴权失败: ${await res.text()}`);
  const data = (await res.json()) as { token: string };
  return data.token;
}

async function provision(port: number): Promise<void> {
  const token = await adminToken(port);
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const existing = await fetch(
    `http://127.0.0.1:${port}/api/collections/app_data`,
    { headers },
  );
  if (existing.status === 404) {
    const authedRule = '@request.auth.id != ""';
    const created = await fetch(`http://127.0.0.1:${port}/api/collections`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "app_data",
        type: "base",
        fields: [
          { name: "module", type: "text", required: true },
          { name: "data", type: "json" },
          { name: "creator", type: "text" },
        ],
        listRule: authedRule,
        viewRule: authedRule,
        createRule: authedRule,
        updateRule: authedRule,
        deleteRule: authedRule,
      }),
    });
    if (!created.ok) {
      throw new Error(`创建 app_data 集合失败: ${await created.text()}`);
    }
  }

  // Demo account (ignore "already exists" failures).
  await fetch(`http://127.0.0.1:${port}/api/collections/users/records`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: DEMO_ACCOUNT.email,
      password: DEMO_ACCOUNT.password,
      passwordConfirm: DEMO_ACCOUNT.password,
      name: "演示用户",
    }),
  }).catch(() => undefined);
}

async function startInstance(repoRoot: string, slug: string): Promise<PbInstance> {
  const bin = ensureBinary(repoRoot);
  const dataDir = path.join(repoRoot, "prototype", "workspaces", "pocketbase", slug);
  mkdirSync(dataDir, { recursive: true });

  // Superuser upsert must run before serve (single-process SQLite access).
  const upsert = spawnSync(bin, [
    "superuser", "upsert", ADMIN_EMAIL, ADMIN_PASSWORD, "--dir", dataDir,
  ]);
  if (upsert.status !== 0) {
    throw new Error(`PocketBase superuser 初始化失败: ${upsert.stderr?.toString()}`);
  }

  const port = await findFreePort(PORT_RANGE_START + instances.size);
  const child = spawn(bin, ["serve", "--http", `127.0.0.1:${port}`, "--dir", dataDir], {
    stdio: ["ignore", "ignore", "pipe"],
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    console.error(`[pocketbase:${slug}] ${chunk.toString().trim()}`);
  });
  child.on("exit", (code) => {
    console.log(`[pocketbase:${slug}] exited (${code})`);
    instances.delete(slug);
  });

  try {
    await waitForHealth(port, 12_000);
    await provision(port);
  } catch (error) {
    child.kill();
    throw error;
  }

  const instance: PbInstance = { slug, port, dataDir, process: child };
  instances.set(slug, instance);
  console.log(`[pocketbase:${slug}] ready on 127.0.0.1:${port} (${dataDir})`);
  return instance;
}

/** Start (or reuse) the PocketBase instance for a build slug. */
export function ensureInstance(repoRoot: string, slug: string): Promise<PbInstance> {
  if (!isValidSlug(slug)) {
    return Promise.reject(new Error(`invalid pocketbase slug: ${slug}`));
  }
  const running = instances.get(slug);
  if (running) return Promise.resolve(running);

  const inflight = pending.get(slug);
  if (inflight) return inflight;

  const task = startInstance(repoRoot, slug).finally(() => pending.delete(slug));
  pending.set(slug, task);
  return task;
}

/** Parse "/pb/<slug>/rest..." → { slug, rest } or null. */
export function parsePbPath(url: string): { slug: string; rest: string } | null {
  const match = url.match(/^\/pb\/([a-z0-9][a-z0-9-]{0,63})(\/.*)?$/);
  if (!match) return null;
  return { slug: match[1], rest: match[2] || "/" };
}

export function stopAll(): void {
  for (const instance of instances.values()) {
    instance.process.kill();
  }
  instances.clear();
}
