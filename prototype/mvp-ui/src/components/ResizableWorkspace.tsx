import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_LAYOUT,
  loadLayoutPreferences,
  saveLayoutPreferences,
  type LayoutPreferences,
} from "../engine/layoutPreferences";

const MIN_CHAT_PX = 260;
const MIN_CANVAS_PX = 320;
/** Divider + slack; below this width the workspace stacks vertically. */
const MIN_SIDE_BY_SIDE_PX = MIN_CHAT_PX + MIN_CANVAS_PX + 12;

interface ResizableWorkspaceProps {
  chat: React.ReactNode;
  canvas: React.ReactNode;
}

function clampRatio(ratio: number, containerSize: number): number {
  const minRatio = MIN_CHAT_PX / containerSize;
  const maxRatio = 1 - MIN_CANVAS_PX / containerSize;
  return Math.min(maxRatio, Math.max(minRatio, ratio));
}

export function ResizableWorkspace({ chat, canvas }: ResizableWorkspaceProps) {
  const [layout, setLayout] = useState<LayoutPreferences>(loadLayoutPreferences);
  const [isWide, setIsWide] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateLayoutMode = (width: number) => {
      setIsWide(width >= MIN_SIDE_BY_SIDE_PX);
    };

    updateLayoutMode(container.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      updateLayoutMode(entry.contentRect.width);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const persist = useCallback((next: LayoutPreferences) => {
    setLayout(next);
    saveLayoutPreferences(next);
  }, []);

  const swapSides = useCallback(() => {
    persist({
      ...layout,
      chatSide: layout.chatSide === "left" ? "right" : "left",
    });
  }, [layout, persist]);

  const resetLayout = useCallback(() => {
    persist(DEFAULT_LAYOUT);
  }, [persist]);

  const startDrag = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    draggingRef.current = true;
    document.body.style.cursor = isWide ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";

    const onMove = (event: MouseEvent | TouchEvent) => {
      if (!draggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const point =
        "touches" in event ? event.touches[0] : event;

      let ratio: number;
      if (isWide) {
        const chatOnStart = layout.chatSide === "left";
        const offset = point.clientX - rect.left;
        ratio = chatOnStart ? offset / rect.width : 1 - offset / rect.width;
      } else {
        const chatOnStart = layout.chatSide === "left";
        const offset = point.clientY - rect.top;
        ratio = chatOnStart ? offset / rect.height : 1 - offset / rect.height;
      }

      const containerSize = isWide ? rect.width : rect.height;
      persist({
        ...layout,
        chatRatio: clampRatio(ratio, containerSize),
      });
    };

    const onEnd = () => {
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
  }, [isWide, layout, persist]);

  const chatPaneStyle = {
    flex: `0 0 ${layout.chatRatio * 100}%`,
  } as const;
  const canvasPaneStyle = { flex: "1 1 0", minWidth: 0, minHeight: 0 } as const;

  const chatPane = (
    <div className="flex min-h-0 min-w-0 flex-col overflow-hidden" style={chatPaneStyle}>
      {chat}
    </div>
  );
  const canvasPane = (
    <div className="flex min-h-0 min-w-0 flex-col overflow-hidden" style={canvasPaneStyle}>
      {canvas}
    </div>
  );

  const chatFirst = layout.chatSide === "left";
  const firstPane = chatFirst ? chatPane : canvasPane;
  const secondPane = chatFirst ? canvasPane : chatPane;

  const handleLabel = isWide
    ? layout.chatSide === "left"
      ? "拖动调整左右宽度"
      : "拖动调整左右宽度"
    : layout.chatSide === "left"
      ? "拖动调整上下高度"
      : "拖动调整上下高度";

  return (
    <div
      ref={containerRef}
      className={[
        "flex h-full min-h-0 w-full overflow-hidden",
        isWide ? "flex-row" : "flex-col",
      ].join(" ")}
    >
      {firstPane}

      <div
          className={[
            "group relative z-10 flex shrink-0 items-center justify-center bg-hairline/80",
            isWide ? "w-1.5 cursor-col-resize" : "h-1.5 cursor-row-resize",
          ].join(" ")}
        role="separator"
        aria-orientation={isWide ? "vertical" : "horizontal"}
        aria-label={handleLabel}
        onMouseDown={(event) => {
          event.preventDefault();
          startDrag();
        }}
        onTouchStart={(event) => {
          event.preventDefault();
          startDrag();
        }}
        onDoubleClick={resetLayout}
      >
        <div
          className={[
            "absolute rounded-full bg-stone opacity-0 transition group-hover:opacity-100",
            isWide ? "h-10 w-1" : "h-1 w-10",
          ].join(" ")}
        />
        <button
          type="button"
          title={isWide ? "交换左右" : "交换上下"}
          aria-label={isWide ? "交换左右面板" : "交换上下面板"}
          onClick={(event) => {
            event.stopPropagation();
            swapSides();
          }}
          onMouseDown={(event) => event.stopPropagation()}
          className={[
            "absolute z-20 flex items-center justify-center rounded-md border border-hairline bg-ink-soft text-[10px] font-medium text-paper-dim shadow-sm hover:border-brass hover:text-paper",
            isWide ? "top-1/2 -translate-y-1/2 px-1 py-2" : "left-1/2 -translate-x-1/2 px-2 py-0.5",
          ].join(" ")}
        >
          {isWide ? "⇄" : "⇅"}
        </button>
      </div>

      {secondPane}
    </div>
  );
}
