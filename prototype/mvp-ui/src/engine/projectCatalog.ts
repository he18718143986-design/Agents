import { SEED_PROJECTS, type MockProject, type ProjectStatus } from "../mockProjects";
import type { Stage } from "../types";

const STORAGE_KEY = "mvp-ui-projects-v1";

function readAll(): MockProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...SEED_PROJECTS];
    const parsed = JSON.parse(raw) as MockProject[];
    return parsed.length > 0
      ? parsed.map((project) => ({
          ...project,
          status: project.status ?? "active",
        }))
      : [...SEED_PROJECTS];
  } catch {
    return [...SEED_PROJECTS];
  }
}

function writeAll(projects: MockProject[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function listMockProjects(): MockProject[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getMockProject(id: string): MockProject | undefined {
  return readAll().find((project) => project.id === id);
}

export function createMockProject(title = "新项目"): MockProject {
  const project: MockProject = {
    id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    summary: "刚开始探索，还没有整理需求。",
    stage: 0,
    status: "active",
    updatedAt: Date.now(),
  };
  const projects = [project, ...readAll().filter((item) => item.id !== project.id)];
  writeAll(projects);
  return project;
}

export function upsertMockProject(
  id: string,
  patch: Partial<
    Pick<MockProject, "title" | "summary" | "stage" | "status" | "completedAt">
  >,
): MockProject | undefined {
  const projects = readAll();
  const index = projects.findIndex((project) => project.id === id);
  if (index < 0) return undefined;

  const updated: MockProject = {
    ...projects[index],
    ...patch,
    updatedAt: Date.now(),
  };
  projects[index] = updated;
  writeAll(projects);
  return updated;
}

export function syncProjectFromWorkspace(
  id: string,
  input: {
    title?: string;
    summary?: string;
    stage: Stage;
    status?: ProjectStatus;
    completedAt?: number;
  },
): void {
  const existing = getMockProject(id);
  if (!existing) return;

  upsertMockProject(id, {
    title: input.title?.trim() || existing.title,
    summary: input.summary?.trim() || existing.summary,
    stage: input.stage,
    status: input.status ?? existing.status,
    completedAt: input.completedAt ?? existing.completedAt,
  });
}
