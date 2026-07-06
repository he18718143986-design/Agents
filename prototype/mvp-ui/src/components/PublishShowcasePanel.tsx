import { useState } from "react";
import {
  currentUser,
  friendlyAuthError,
  publishShowcase,
} from "../engine/platformClient";

interface PublishShowcasePanelProps {
  title: string;
  summary?: string;
  url: string;
}

/** 上线完成后：将作品发布到案例墙（opt-in，需登录）。 */
export function PublishShowcasePanel({ title, summary, url }: PublishShowcasePanelProps) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const user = currentUser();

  // 体验模式的 Blob 产物无法公开访问，不提供发布
  if (url.startsWith("blob:")) return null;

  const publish = async () => {
    setBusy(true);
    setError(null);
    try {
      const absolute = url.startsWith("http")
        ? url
        : `${window.location.origin}${url}`;
      await publishShowcase({ title, summary, url: absolute });
      setDone(true);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-hairline bg-ink-softer/40 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-paper">发布到案例墙</div>
          <div className="text-xs text-stone">
            让你的作品出现在首页广场，被更多人看到（可选）
          </div>
        </div>
        {done ? (
          <span className="shrink-0 text-xs font-medium text-pine-tint">✅ 已发布</span>
        ) : user ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void publish()}
            className="stagent-btn stagent-btn--primary stagent-btn--sm shrink-0"
          >
            {busy ? "发布中…" : "发布"}
          </button>
        ) : (
          <span className="shrink-0 text-xs text-stone">登录平台账号后可发布</span>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-rose-400">发布失败:{error}</p>}
    </div>
  );
}
