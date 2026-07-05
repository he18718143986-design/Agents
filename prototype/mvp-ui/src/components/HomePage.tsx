import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DebugExportButton } from "./DebugExportButton";
import { SnailMark } from "./SnailMark";
import { STAGE_LABELS, type MockProject } from "../mockProjects";
import { listMockProjects } from "../engine/projectCatalog";

function formatRelativeTime(timestamp: number): string {
  const deltaMs = Date.now() - timestamp;
  const minutes = Math.floor(deltaMs / (1000 * 60));
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  return new Date(timestamp).toLocaleDateString("zh-CN");
}

interface HomePageProps {
  onNewProject: () => void;
  onOpenProject: (project: MockProject, iteration?: boolean) => void;
  engineReady?: boolean;
  onOpenApiConfig?: () => void;
}

export function HomePage({
  onNewProject,
  onOpenProject,
  engineReady = false,
  onOpenApiConfig,
}: HomePageProps) {
  const [projects, setProjects] = useState(() => listMockProjects());
  const refresh = () => setProjects(listMockProjects());

  const continueProject = useMemo(
    () => projects.find((p) => p.status === "active") ?? projects[0],
    [projects],
  );

  const handleNew = () => {
    onNewProject();
    refresh();
  };

  return (
    <div className="stagent-shell min-h-screen">
      <header className="stagent-nav">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <SnailMark className="app-snail-mark" />
            <div>
              <div className="stagent-eyebrow">Stagent · 应用</div>
              <h1 className="stagent-title text-lg">工作台</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DebugExportButton />
            <Link to="/#showcase" className="stagent-btn stagent-btn--ghost stagent-btn--sm">
              作品广场
            </Link>
            <Link to="/" className="stagent-btn stagent-btn--ghost stagent-btn--sm">
              营销首页
            </Link>
            <button
              type="button"
              onClick={handleNew}
              className="stagent-btn stagent-btn--primary stagent-btn--sm"
            >
              新建项目
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        <section className="stagent-card stagent-card--accent p-6 sm:p-8">
          {continueProject ? (
            <>
              <span className="stagent-eyebrow">继续创作</span>
              <h2 className="stagent-title mt-2 text-2xl">欢迎回来</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-paper-dim">
                上次在「{continueProject.title}」做到
                <span className="text-paper"> {STAGE_LABELS[continueProject.stage]} </span>
                阶段，{formatRelativeTime(continueProject.updatedAt)} 更新。
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => onOpenProject(continueProject)}
                  className="stagent-btn stagent-btn--primary"
                >
                  继续：{continueProject.title}
                </button>
                {continueProject.status === "completed" && (
                  <button
                    type="button"
                    onClick={() => onOpenProject(continueProject, true)}
                    className="stagent-btn stagent-btn--ghost"
                  >
                    继续迭代
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleNew}
                  className="stagent-btn stagent-btn--ghost"
                >
                  新建另一个项目
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="stagent-eyebrow">开始</span>
              <h2 className="stagent-title mt-2 text-2xl">还没有进行中的项目</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-paper-dim">
                新建一个项目，在左侧和 Agent 聊想法，右侧会同步需求与方案。
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleNew}
                  className="stagent-btn stagent-btn--primary"
                >
                  新建项目
                </button>
                <Link to="/#showcase" className="stagent-btn stagent-btn--ghost">
                  去广场找灵感
                </Link>
              </div>
            </>
          )}
        </section>

        {onOpenApiConfig && (
          <section className="stagent-card flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
            <div>
              <div className="text-sm font-medium text-paper">大模型引擎</div>
              <p className="mt-0.5 text-xs text-stone">
                {engineReady
                  ? "已连接，进入项目后即可与 Agent 对话。"
                  : "尚未连接 API，进入项目前请先配置。"}
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenApiConfig}
              className="stagent-btn stagent-btn--ghost stagent-btn--sm"
            >
              {engineReady ? "API 设置" : "连接引擎"}
            </button>
          </section>
        )}

        <section>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <span className="stagent-eyebrow">我的项目</span>
              <h2 className="stagent-title mt-2 text-base">全部项目</h2>
              <p className="mt-1 text-sm text-stone">
                点击卡片进入工作台，左侧聊天、右侧画布会接着上次进度。
              </p>
            </div>
            <button
              type="button"
              onClick={handleNew}
              className="stagent-btn stagent-btn--ghost stagent-btn--sm shrink-0"
            >
              + 新建
            </button>
          </div>

          {projects.length === 0 ? (
            <div className="stagent-card border-dashed px-6 py-12 text-center">
              <p className="text-sm text-stone">还没有项目。</p>
              <button
                type="button"
                onClick={handleNew}
                className="stagent-btn stagent-btn--primary stagent-btn--sm mt-4"
              >
                新建第一个项目
              </button>
              <p className="mt-4 text-xs text-stone">
                或{" "}
                <Link to="/#showcase" className="text-cinnabar-tint underline">
                  去广场看看别人做了什么
                </Link>
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="stagent-card p-4 text-left transition hover:border-brass/50 hover:-translate-y-0.5"
                >
                  <button
                    type="button"
                    onClick={() => onOpenProject(project)}
                    className="w-full text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display font-semibold text-paper">{project.title}</h3>
                      <span className="stagent-badge">
                        {project.status === "completed" ? "已上线" : STAGE_LABELS[project.stage]}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-paper-dim">
                      {project.summary}
                    </p>
                    <p className="mt-3 font-mono text-xs text-stone">
                      更新于 {formatRelativeTime(project.updatedAt)}
                    </p>
                  </button>
                  {project.status === "completed" && (
                    <button
                      type="button"
                      onClick={() => onOpenProject(project, true)}
                      className="stagent-btn stagent-btn--ghost stagent-btn--sm mt-3 w-full"
                    >
                      继续迭代
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <p className="text-center text-sm text-stone">
          想看看公开发布的作品？{" "}
          <Link to="/#showcase" className="text-cinnabar-tint hover:text-paper">
            逛逛作品广场 →
          </Link>
        </p>
      </main>
    </div>
  );
}
