import PocketBase from "pocketbase";

/**
 * 平台账号与项目云端存储客户端（/pb/platform/ 专用实例）。
 * 登录状态由 PocketBase SDK 持久化在 localStorage（pocketbase_auth）。
 */

export const platformPb = new PocketBase("/pb/platform");
platformPb.autoCancellation(false);

export interface PlatformUser {
  id: string;
  email: string;
  name?: string;
}

export function currentUser(): PlatformUser | null {
  if (!platformPb.authStore.isValid) return null;
  const record = platformPb.authStore.record;
  if (!record) return null;
  return {
    id: record.id,
    email: (record["email"] as string) ?? "",
    name: (record["name"] as string) || undefined,
  };
}

export function onAuthChange(handler: () => void): () => void {
  return platformPb.authStore.onChange(handler);
}

export async function login(email: string, password: string): Promise<PlatformUser> {
  await platformPb.collection("users").authWithPassword(email, password);
  const user = currentUser();
  if (!user) throw new Error("登录状态异常");
  return user;
}

export async function register(email: string, password: string): Promise<PlatformUser> {
  await platformPb.collection("users").create({
    email,
    password,
    passwordConfirm: password,
  });
  return login(email, password);
}

export function logout(): void {
  platformPb.authStore.clear();
}

/** 当前平台认证 token（未登录返回空串），供网关用量校验携带。 */
export function platformToken(): string {
  return platformPb.authStore.isValid ? platformPb.authStore.token : "";
}

export interface ShowcaseEntry {
  id: string;
  title: string;
  summary: string;
  url: string;
  author: string;
  tags: string[];
}

interface ShowcaseRecord {
  id: string;
  title?: string;
  summary?: string;
  url?: string;
  author?: string;
  tags?: string[] | null;
}

/** 公开案例墙列表（匿名可读；失败时返回空数组由调用方回退静态内容）。 */
export async function listShowcase(limit = 8): Promise<ShowcaseEntry[]> {
  try {
    const result = await platformPb
      .collection("showcase")
      .getList<ShowcaseRecord>(1, limit, { sort: "-created" });
    return result.items.map((item) => ({
      id: item.id,
      title: item.title || "未命名作品",
      summary: item.summary || "",
      url: item.url || "#",
      author: item.author || "匿名创作者",
      tags: Array.isArray(item.tags) ? item.tags : [],
    }));
  } catch {
    return [];
  }
}

/** 发布作品到案例墙（需登录）。 */
export async function publishShowcase(entry: {
  title: string;
  summary?: string;
  url: string;
  tags?: string[];
}): Promise<void> {
  const user = currentUser();
  if (!user) throw new Error("请先登录平台账号");
  await platformPb.collection("showcase").create({
    owner: user.id,
    title: entry.title.slice(0, 60),
    summary: entry.summary?.slice(0, 120) ?? "",
    url: entry.url,
    author: user.name || user.email.split("@")[0],
    tags: entry.tags ?? [],
  });
}

export function friendlyAuthError(error: unknown): string {
  const anyError = error as { response?: { message?: string; data?: Record<string, { message?: string }> }; message?: string };
  const fieldError = anyError.response?.data
    ? Object.values(anyError.response.data)[0]?.message
    : undefined;
  return fieldError || anyError.response?.message || anyError.message || "网络错误";
}
