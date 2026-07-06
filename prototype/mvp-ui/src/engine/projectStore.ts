import type { AppState, PersistedWorkspaceSnapshot, Stage } from "../types";
import type { MockProject, ProjectStatus } from "../mockProjects";
import {
  createMockProject,
  getMockProject,
  listMockProjects,
  removeMockProject,
  syncProjectFromWorkspace,
} from "./projectCatalog";
import {
  deleteProjectSnapshot,
  extractPersistableSnapshot,
  loadProjectSnapshot,
  saveProjectSnapshot,
} from "./projectPersistence";
import { currentUser, platformPb } from "./platformClient";
import { logPersistence } from "./debugLog";

/**
 * 统一项目存储：登录后走云端（平台 PocketBase 的 projects 集合），
 * 未登录回退浏览器 localStorage（原行为）。
 *
 * 云端记录 = 项目元数据字段 + snapshot(JSON 全量快照)。
 */

const CLOUD_ID_PREFIX = "cloud-";

function isCloudId(id: string): boolean {
  return id.startsWith(CLOUD_ID_PREFIX);
}

function toRecordId(id: string): string {
  return id.slice(CLOUD_ID_PREFIX.length);
}

interface ProjectRecord {
  id: string;
  title?: string;
  summary?: string;
  stage?: number;
  status?: string;
  completedAt?: number;
  snapshot?: PersistedWorkspaceSnapshot | null;
  updated?: string;
}

function toProject(record: ProjectRecord): MockProject {
  return {
    id: `${CLOUD_ID_PREFIX}${record.id}`,
    title: record.title || "新项目",
    summary: record.summary || "",
    stage: (record.stage ?? 0) as Stage,
    status: (record.status as ProjectStatus) || "active",
    updatedAt: record.updated ? new Date(record.updated).getTime() : Date.now(),
    completedAt: record.completedAt || undefined,
  };
}

export function isLoggedIn(): boolean {
  return currentUser() !== null;
}

export async function listProjects(): Promise<MockProject[]> {
  const user = currentUser();
  if (!user) return listMockProjects();
  const records = await platformPb
    .collection("projects")
    .getFullList<ProjectRecord>({ sort: "-updated" });
  return records.map(toProject);
}

export async function createProject(title = "新项目"): Promise<MockProject> {
  const user = currentUser();
  if (!user) return createMockProject(title);
  const record = await platformPb.collection("projects").create<ProjectRecord>({
    owner: user.id,
    title,
    summary: "刚开始探索，还没有整理需求。",
    stage: 0,
    status: "active",
    snapshot: null,
  });
  logPersistence("cloud.project.created", { id: record.id });
  return toProject(record);
}

export async function getProject(id: string): Promise<MockProject | undefined> {
  if (!isCloudId(id)) return getMockProject(id);
  try {
    const record = await platformPb
      .collection("projects")
      .getOne<ProjectRecord>(toRecordId(id));
    return toProject(record);
  } catch {
    return undefined;
  }
}

export async function loadSnapshot(
  id: string,
): Promise<Partial<PersistedWorkspaceSnapshot> | null> {
  if (!isCloudId(id)) return loadProjectSnapshot(id);
  try {
    const record = await platformPb
      .collection("projects")
      .getOne<ProjectRecord>(toRecordId(id));
    logPersistence("cloud.snapshot.loaded", { id, hasSnapshot: Boolean(record.snapshot) });
    return record.snapshot ?? null;
  } catch {
    return null;
  }
}

/**
 * 登录后一次性迁移：把本地（localStorage）有实质进度的项目上传到云端，
 * 成功后删除本地副本。返回迁移数量。
 */
export async function migrateLocalProjects(): Promise<number> {
  const user = currentUser();
  if (!user) return 0;

  let migrated = 0;
  for (const project of listMockProjects()) {
    const snapshot = loadProjectSnapshot(project.id);
    // 只迁移有对话进度的项目（跳过种子示例和空项目）
    if (!snapshot || (snapshot.messages?.length ?? 0) === 0) continue;
    try {
      await platformPb.collection("projects").create({
        owner: user.id,
        title: project.title,
        summary: project.summary,
        stage: project.stage,
        status: project.status,
        ...(project.completedAt ? { completedAt: project.completedAt } : {}),
        snapshot,
      });
      deleteProjectSnapshot(project.id);
      removeMockProject(project.id);
      migrated += 1;
    } catch (error) {
      logPersistence("cloud.migrate.failed", { id: project.id, error: String(error) });
    }
  }
  if (migrated > 0) {
    logPersistence("cloud.migrate.done", { migrated });
  }
  return migrated;
}

/** 保存快照 + 同步项目卡片元数据（云端一次请求完成）。 */
export async function saveSnapshot(id: string, state: AppState): Promise<void> {
  const meta = {
    title: state.requirements.goal || undefined,
    summary:
      state.discoveryBrief.split("\n").filter(Boolean).slice(-1)[0] || undefined,
    stage: state.stage,
    status: state.projectStatus,
    completedAt: state.projectStatus === "completed" ? Date.now() : undefined,
  };

  if (!isCloudId(id)) {
    saveProjectSnapshot(id, state);
    syncProjectFromWorkspace(id, meta);
    return;
  }

  try {
    await platformPb.collection("projects").update(toRecordId(id), {
      ...(meta.title ? { title: meta.title } : {}),
      ...(meta.summary ? { summary: meta.summary } : {}),
      stage: meta.stage,
      status: meta.status,
      ...(meta.completedAt ? { completedAt: meta.completedAt } : {}),
      snapshot: extractPersistableSnapshot(state),
    });
    logPersistence("cloud.snapshot.saved", { id, stage: state.stage });
  } catch (error) {
    logPersistence("cloud.snapshot.save-failed", { id, error: String(error) });
  }
}
