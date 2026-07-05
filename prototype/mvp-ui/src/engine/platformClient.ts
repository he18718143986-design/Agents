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

export function friendlyAuthError(error: unknown): string {
  const anyError = error as { response?: { message?: string; data?: Record<string, { message?: string }> }; message?: string };
  const fieldError = anyError.response?.data
    ? Object.values(anyError.response.data)[0]?.message
    : undefined;
  return fieldError || anyError.response?.message || anyError.message || "网络错误";
}
