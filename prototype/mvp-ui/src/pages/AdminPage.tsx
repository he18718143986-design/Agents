import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SnailMark } from "../components/SnailMark";

/**
 * 运营后台（内测运营用）：需管理令牌（ADMIN_TOKEN）。
 * 令牌仅存当前标签页；后端用平台 superuser 聚合，不暴露用户业务数据。
 */

interface Overview {
  generatedAt: string;
  users: { total: number; recent: { email: string; created: string }[] };
  projects: {
    total: number;
    recentStatusBreakdown: Record<string, number>;
    recent: { title: string; stage: number; status: string; updated: string }[];
  };
  showcaseTotal: number;
  buildsToday: number;
  estimatedCostTodayCny: number;
  quotaDailyBuilds: number | null;
}

const TOKEN_KEY = "stagent-admin-token";
const STAGE_LABELS = ["探索", "需求整理", "风格选型", "制作验收", "测试上线"];

function fmtTime(iso: string): string {
  if (!iso) return "—";
  return iso.slice(0, 16).replace("T", " ");
}

export function AdminPage() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) ?? "");
  const [input, setInput] = useState("");
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async (tok: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/prototype/api/admin/overview", {
        headers: { "x-admin-token": tok },
      });
      const body = (await res.json()) as Overview & { error?: string };
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setData(body);
      sessionStorage.setItem(TOKEN_KEY, tok);
      setToken(tok);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) void load(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken("");
    setData(null);
  };

  return (
    <div className="stagent-shell min-h-screen">
      <header className="stagent-nav">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <SnailMark className="app-snail-mark" />
            <span className="stagent-title text-lg">Stagent · 运营后台</span>
          </Link>
          {token && (
            <button type="button" onClick={logout} className="stagent-btn stagent-btn--ghost stagent-btn--sm">
              退出
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {!token || (!data && !loading) ? (
          <div className="stagent-card mx-auto max-w-sm p-6">
            <h1 className="stagent-title mb-1 text-lg">管理令牌</h1>
            <p className="mb-4 text-xs text-stone">输入 ADMIN_TOKEN 查看运营数据。</p>
            <input
              type="password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void load(input.trim())}
              placeholder="管理令牌"
              className="stagent-input"
            />
            {error && <p className="stagent-alert stagent-alert--error mt-3">{error}</p>}
            <button
              type="button"
              disabled={!input.trim() || loading}
              onClick={() => void load(input.trim())}
              className="stagent-btn stagent-btn--primary mt-4 w-full"
            >
              {loading ? "加载中…" : "进入"}
            </button>
          </div>
        ) : loading ? (
          <p className="text-sm text-stone">加载中…</p>
        ) : data ? (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "注册用户", value: data.users.total },
                { label: "项目总数", value: data.projects.total },
                { label: "今日制作次数", value: data.buildsToday },
                { label: "今日成本估算", value: `¥${data.estimatedCostTodayCny}` },
              ].map((card) => (
                <div key={card.label} className="stagent-card p-4">
                  <div className="text-xs text-stone">{card.label}</div>
                  <div className="mt-1 text-2xl font-semibold text-paper">{card.value}</div>
                </div>
              ))}
            </div>

            <p className="text-xs text-stone">
              案例墙作品 {data.showcaseTotal} 个 ·{" "}
              {data.quotaDailyBuilds ? `每账号日制作上限 ${data.quotaDailyBuilds} 次` : "未设制作限额"} ·
              数据时间 {fmtTime(data.generatedAt)}
            </p>

            <section className="stagent-card p-5">
              <h2 className="mb-3 text-sm font-semibold text-paper">最近项目</h2>
              {data.projects.recent.length === 0 ? (
                <p className="text-sm text-stone">暂无项目。</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-stone">
                      <th className="pb-2">项目</th>
                      <th className="pb-2">阶段</th>
                      <th className="pb-2">状态</th>
                      <th className="pb-2">更新时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.projects.recent.map((p, i) => (
                      <tr key={i} className="border-t border-hairline">
                        <td className="py-2 text-paper">{p.title}</td>
                        <td className="py-2 text-paper-dim">{STAGE_LABELS[p.stage] ?? p.stage}</td>
                        <td className="py-2 text-paper-dim">{p.status === "completed" ? "已上线" : "进行中"}</td>
                        <td className="py-2 text-stone">{fmtTime(p.updated)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="stagent-card p-5">
              <h2 className="mb-3 text-sm font-semibold text-paper">最近注册</h2>
              {data.users.recent.length === 0 ? (
                <p className="text-sm text-stone">暂无用户。</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {data.users.recent.map((u, i) => (
                    <li key={i} className="flex justify-between border-t border-hairline py-2">
                      <span className="text-paper">{u.email}</span>
                      <span className="text-stone">{fmtTime(u.created)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <button
              type="button"
              onClick={() => void load(token)}
              className="stagent-btn stagent-btn--ghost stagent-btn--sm"
            >
              刷新
            </button>
          </div>
        ) : null}
      </main>
    </div>
  );
}
