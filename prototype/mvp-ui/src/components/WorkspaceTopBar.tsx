import { useEffect, useRef, useState } from "react";
import { DebugExportButton } from "./DebugExportButton";
import { SnailMark } from "./SnailMark";
import type { Stage } from "../types";

interface WorkspaceTopBarProps {
  projectTitle: string;
  engineReady: boolean;
  stage: Stage;
  styleConfirmed: boolean;
  onGoHome: () => void;
  onOpenApiConfig: () => void;
  onReset: () => void;
  onRevertToRequirements: () => void;
  onRevertToStyle: () => void;
}

export function WorkspaceTopBar({
  projectTitle,
  engineReady,
  stage,
  styleConfirmed,
  onGoHome,
  onOpenApiConfig,
  onReset,
  onRevertToRequirements,
  onRevertToStyle,
}: WorkspaceTopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const handleReset = () => {
    setMenuOpen(false);
    const ok = window.confirm(
      "将清空当前对话与阶段进度，并按已保存的 API 配置重新连接。确定重新开始？",
    );
    if (ok) onReset();
  };

  const handleOpenApi = () => {
    setMenuOpen(false);
    onOpenApiConfig();
  };

  const showRevertRequirements = stage >= 2;
  const showRevertStyle = stage >= 3 || styleConfirmed;

  return (
    <header className="stagent-nav shrink-0 border-b border-hairline-soft">
      <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
        <button
          type="button"
          onClick={onGoHome}
          className="stagent-btn stagent-btn--ghost stagent-btn--sm shrink-0 !rounded-lg"
        >
          ← 返回工作台
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <SnailMark className="app-snail-mark hidden sm:block" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-paper">{projectTitle}</p>
            <p className="truncate text-[11px] text-stone">
              {engineReady ? "AI 已连接" : "AI 未连接"}
            </p>
          </div>
        </div>

        <DebugExportButton />

        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            aria-label="更多操作"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={() => setMenuOpen((open) => !open)}
            className="stagent-btn stagent-btn--ghost stagent-btn--sm !rounded-lg !px-3"
          >
            ⋯
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[10.5rem] rounded-xl border border-hairline bg-ink-soft py-1 shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                onClick={handleOpenApi}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-paper hover:bg-ink-softer"
              >
                <span>连接 AI</span>
                {!engineReady && (
                  <span className="stagent-badge stagent-badge--accent">未连接</span>
                )}
              </button>
              {showRevertRequirements && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onRevertToRequirements();
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-paper-dim hover:bg-ink-softer hover:text-paper"
                >
                  回到需求整理
                </button>
              )}
              {showRevertStyle && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onRevertToStyle();
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-paper-dim hover:bg-ink-softer hover:text-paper"
                >
                  回到风格选型
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={handleReset}
                className="w-full px-3 py-2 text-left text-sm text-paper-dim hover:bg-ink-softer hover:text-paper"
              >
                重新开始
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
