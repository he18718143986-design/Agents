import type { RequirementsData } from "../types";

/**
 * Demo-mode builder: renders a self-contained interactive HTML app from the
 * confirmed requirements and serves it as a Blob URL. No server involved.
 * Data entered by the user persists in the browser via localStorage.
 */

export type DemoEnv = "workspace" | "staging" | "production";

const ENV_LABELS: Record<DemoEnv, string> = {
  workspace: "制作预览",
  staging: "测试环境",
  production: "正式环境",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface DemoBuildInput {
  requirements: RequirementsData;
  warm: boolean;
  env: DemoEnv;
  changeLog: string[];
}

export function renderDemoAppHtml(input: DemoBuildInput): string {
  const { requirements, warm, env, changeLog } = input;
  const goal = escapeHtml(requirements.goal || "我的应用");
  const primary = warm ? "#ea580c" : "#2563eb";
  const bg = warm ? "#fff7ed" : "#f8fafc";
  const features = (
    requirements.p0Features.length > 0 ? requirements.p0Features : ["数据记录"]
  ).slice(0, 6);

  const tabsHtml = features
    .map(
      (feature, index) =>
        `<button class="tab${index === 0 ? " active" : ""}" data-tab="${index}">${escapeHtml(feature)}</button>`,
    )
    .join("");

  const panelsHtml = features
    .map(
      (feature, index) => `
  <section class="panel${index === 0 ? " active" : ""}" data-panel="${index}">
    <h2>${escapeHtml(feature)}</h2>
    <form class="add-form" data-store="demo-store-${index}">
      <input name="name" placeholder="名称 / 事项" required />
      <input name="date" type="date" />
      <input name="amount" type="number" step="any" placeholder="数值（金额/进度%）" />
      <input name="note" placeholder="备注" />
      <button type="submit">添加记录</button>
    </form>
    <div class="summary" id="summary-${index}"></div>
    <table>
      <thead><tr><th>名称</th><th>日期</th><th>数值</th><th>备注</th><th></th></tr></thead>
      <tbody id="rows-${index}"></tbody>
    </table>
    <button class="export" data-export="${index}">导出 CSV</button>
  </section>`,
    )
    .join("");

  const changeLogHtml =
    changeLog.length > 0
      ? `<details class="changelog"><summary>更新记录（${changeLog.length}）</summary><ol>${changeLog
          .map((item) => `<li>${escapeHtml(item)}</li>`)
          .join("")}</ol></details>`
      : "";

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${goal}</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  body { font-family: system-ui, -apple-system, "PingFang SC", sans-serif; background: ${bg}; color: #1f2937; }
  header { background: ${primary}; color: #fff; padding: 14px 20px; }
  header h1 { font-size: 18px; }
  .badge { display: inline-block; margin-top: 6px; font-size: 11px; background: rgba(255,255,255,.2); border-radius: 999px; padding: 2px 10px; }
  .tabs { display: flex; flex-wrap: wrap; gap: 6px; padding: 12px 20px 0; }
  .tab { border: 1px solid #d1d5db; background: #fff; border-radius: 999px; padding: 6px 14px; font-size: 13px; cursor: pointer; }
  .tab.active { background: ${primary}; border-color: ${primary}; color: #fff; }
  .panel { display: none; padding: 16px 20px 32px; }
  .panel.active { display: block; }
  .panel h2 { font-size: 15px; margin-bottom: 12px; }
  .add-form { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
  .add-form input { flex: 1 1 140px; border: 1px solid #d1d5db; border-radius: 8px; padding: 8px 10px; font-size: 13px; }
  .add-form button, .export { background: ${primary}; color: #fff; border: 0; border-radius: 8px; padding: 8px 16px; font-size: 13px; cursor: pointer; }
  .summary { font-size: 12px; color: #6b7280; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; font-size: 13px; margin-bottom: 12px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e5e7eb; }
  th { background: #f3f4f6; font-weight: 600; font-size: 12px; }
  td button { border: 0; background: none; color: #ef4444; cursor: pointer; font-size: 12px; }
  .changelog { margin: 0 20px 24px; font-size: 12px; color: #6b7280; }
  .changelog ol { padding-left: 18px; margin-top: 6px; }
</style>
</head>
<body>
<header>
  <h1>${goal}</h1>
  <span class="badge">${ENV_LABELS[env]} · 演示版 · 数据保存在本机浏览器</span>
</header>
<nav class="tabs">${tabsHtml}</nav>
${panelsHtml}
${changeLogHtml}
<script>
(function () {
  var STORE_PREFIX = "stagent-demo:" + ${JSON.stringify(goal)} + ":";
  function load(i) { try { return JSON.parse(localStorage.getItem(STORE_PREFIX + i)) || []; } catch (e) { return []; } }
  function save(i, rows) { try { localStorage.setItem(STORE_PREFIX + i, JSON.stringify(rows)); } catch (e) {} }
  function render(i) {
    var rows = load(i);
    var tbody = document.getElementById("rows-" + i);
    tbody.innerHTML = rows.map(function (row, ri) {
      return "<tr><td>" + row.name + "</td><td>" + (row.date || "—") + "</td><td>" + (row.amount || "—") +
        "</td><td>" + (row.note || "—") + "</td><td><button data-del='" + i + ":" + ri + "'>删除</button></td></tr>";
    }).join("");
    var total = rows.reduce(function (sum, row) { return sum + (parseFloat(row.amount) || 0); }, 0);
    document.getElementById("summary-" + i).textContent =
      "共 " + rows.length + " 条记录" + (total ? "，数值合计 " + total : "");
  }
  document.querySelectorAll(".tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      document.querySelectorAll(".tab").forEach(function (t) { t.classList.remove("active"); });
      document.querySelectorAll(".panel").forEach(function (p) { p.classList.remove("active"); });
      tab.classList.add("active");
      document.querySelector(".panel[data-panel='" + tab.dataset.tab + "']").classList.add("active");
    });
  });
  document.querySelectorAll(".add-form").forEach(function (form, i) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var data = new FormData(form);
      var rows = load(i);
      rows.push({
        name: (data.get("name") || "").toString().slice(0, 60),
        date: data.get("date"), amount: data.get("amount"),
        note: (data.get("note") || "").toString().slice(0, 100)
      });
      save(i, rows); form.reset(); render(i);
    });
  });
  document.body.addEventListener("click", function (event) {
    var del = event.target.dataset && event.target.dataset.del;
    if (del) {
      var parts = del.split(":"); var rows = load(parts[0]);
      rows.splice(parseInt(parts[1], 10), 1); save(parts[0], rows); render(parts[0]);
    }
    var exp = event.target.dataset && event.target.dataset.export;
    if (exp !== undefined && exp !== "") {
      var rows2 = load(exp);
      var csv = "名称,日期,数值,备注\\n" + rows2.map(function (row) {
        return [row.name, row.date, row.amount, row.note].map(function (cell) {
          return '"' + String(cell == null ? "" : cell).replace(/"/g, '""') + '"';
        }).join(",");
      }).join("\\n");
      var link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob(["\\ufeff" + csv], { type: "text/csv" }));
      link.download = "export.csv"; link.click();
    }
  });
  for (var i = 0; i < ${features.length}; i++) render(i);
})();
</script>
</body>
</html>`;
}

const issuedUrls: string[] = [];

export function createDemoAppUrl(input: DemoBuildInput): string {
  const html = renderDemoAppHtml(input);
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  issuedUrls.push(url);
  return url;
}

export function isDemoArtifactUrl(url: string | null | undefined): boolean {
  return typeof url === "string" && url.startsWith("blob:");
}
