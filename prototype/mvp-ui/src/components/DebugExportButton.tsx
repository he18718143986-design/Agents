import { useEffect, useState } from "react";
import { downloadDebugLog, isDebugEnabled } from "../engine/debugLog";

export function useDebugEnabled(): boolean {
  const [debugOn, setDebugOn] = useState(() => isDebugEnabled());

  useEffect(() => {
    const sync = () => setDebugOn(isDebugEnabled());
    window.addEventListener("stagent-debug-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("stagent-debug-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return debugOn;
}

interface DebugExportButtonProps {
  className?: string;
}

export function DebugExportButton({ className }: DebugExportButtonProps) {
  const debugOn = useDebugEnabled();
  if (!debugOn) return null;

  return (
    <button
      type="button"
      onClick={() => downloadDebugLog()}
      title="下载本次测试的调试日志（JSON）"
      className={
        className ??
        "stagent-btn stagent-btn--ghost stagent-btn--sm shrink-0 !rounded-lg border border-fuchsia-500/30 !px-2.5 text-[11px] text-fuchsia-300 hover:border-fuchsia-400/50 hover:text-fuchsia-200"
      }
    >
      导出日志
    </button>
  );
}
