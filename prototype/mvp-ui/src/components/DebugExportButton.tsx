import { downloadDebugLog } from "../engine/debugLog";
import { useDebugEnabled } from "../engine/useDebugEnabled";

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
