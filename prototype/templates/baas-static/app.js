/* eslint-disable */
/**
 * 模板引擎 — 制作 Agent 请勿修改此文件。
 * 业务模块在 modules.js 中声明；配色在 custom.css 中调整。
 *
 * 数据模型：PocketBase 集合 app_data，每条记录 = { module: 模块id, data: 业务字段JSON, creator: 用户id }
 */
(function () {
  "use strict";

  var CONFIG = window.STAGENT_CONFIG || {};
  var APP = window.STAGENT_APP || { title: "我的应用", modules: [] };
  var pb = new PocketBase(CONFIG.pbBase || "/pb/demo");

  var $ = function (id) { return document.getElementById(id); };
  var state = { records: {}, registerMode: false };

  /* ---------- 认证 ---------- */

  function showAuth() {
    $("auth-screen").classList.remove("hidden");
    $("app-screen").classList.add("hidden");
    $("auth-app-name").textContent = APP.title;
    if (CONFIG.demoAccount) {
      $("auth-demo-hint").textContent =
        "演示账号：" + CONFIG.demoAccount.email + " / " + CONFIG.demoAccount.password;
    }
  }

  function showApp() {
    $("auth-screen").classList.add("hidden");
    $("app-screen").classList.remove("hidden");
    document.title = APP.title;
    $("app-title").textContent = APP.title;
    var record = pb.authStore.record || {};
    $("current-user").textContent = record.name || record.email || "已登录";
    renderModules();
  }

  function setAuthError(message) {
    var el = $("auth-error");
    if (!message) { el.classList.add("hidden"); return; }
    el.textContent = message;
    el.classList.remove("hidden");
  }

  $("auth-toggle").addEventListener("click", function () {
    state.registerMode = !state.registerMode;
    $("auth-title").textContent = state.registerMode ? "注册" : "登录";
    $("auth-submit").textContent = state.registerMode ? "注册并登录" : "登录";
    $("auth-toggle").textContent = state.registerMode ? "已有账号？直接登录" : "没有账号？注册一个";
    setAuthError(null);
  });

  $("auth-form").addEventListener("submit", function (event) {
    event.preventDefault();
    setAuthError(null);
    $("auth-submit").disabled = true;
    var email = $("auth-email").value.trim();
    var password = $("auth-password").value;

    var flow = state.registerMode
      ? pb.collection("users").create({ email: email, password: password, passwordConfirm: password })
          .then(function () { return pb.collection("users").authWithPassword(email, password); })
      : pb.collection("users").authWithPassword(email, password);

    flow.then(showApp).catch(function (error) {
      setAuthError(state.registerMode
        ? "注册失败：" + friendlyError(error)
        : "登录失败：请检查邮箱和密码（" + friendlyError(error) + "）");
    }).finally(function () { $("auth-submit").disabled = false; });
  });

  $("logout-btn").addEventListener("click", function () {
    pb.authStore.clear();
    showAuth();
  });

  function friendlyError(error) {
    if (error && error.response && error.response.message) return error.response.message;
    return (error && error.message) || "网络错误";
  }

  /* ---------- 模块渲染 ---------- */

  function renderModules() {
    var tabs = $("module-tabs");
    var panels = $("module-panels");
    tabs.innerHTML = "";
    panels.innerHTML = "";

    APP.modules.forEach(function (module, index) {
      var tab = document.createElement("button");
      tab.className = "tab" + (index === 0 ? " active" : "");
      tab.textContent = module.title;
      tab.addEventListener("click", function () {
        Array.prototype.forEach.call(tabs.children, function (t) { t.classList.remove("active"); });
        Array.prototype.forEach.call(panels.children, function (p) { p.classList.remove("active"); });
        tab.classList.add("active");
        $("panel-" + module.id).classList.add("active");
      });
      tabs.appendChild(tab);

      var panel = document.createElement("section");
      panel.className = "panel" + (index === 0 ? " active" : "");
      panel.id = "panel-" + module.id;
      panel.innerHTML =
        "<h2>" + escapeHtml(module.title) + "</h2>" +
        (module.description ? "<p class='module-desc'>" + escapeHtml(module.description) + "</p>" : "") +
        "<div class='summary-row' id='summary-" + module.id + "'></div>" +
        buildFormHtml(module) +
        "<div id='table-" + module.id + "'><p class='loading'>加载中…</p></div>" +
        "<button type='button' class='btn-small' id='export-" + module.id + "'>导出 CSV</button>";
      panels.appendChild(panel);

      panel.querySelector("form").addEventListener("submit", function (event) {
        event.preventDefault();
        submitRecord(module, event.target);
      });
      $("export-" + module.id).addEventListener("click", function () { exportCsv(module); });

      loadRecords(module);
    });
  }

  function buildFormHtml(module) {
    var inputs = module.fields.map(function (field) {
      var required = field.required ? " required" : "";
      if (field.type === "select") {
        var options = (field.options || []).map(function (option) {
          return "<option value='" + escapeHtml(option) + "'>" + escapeHtml(option) + "</option>";
        }).join("");
        return "<label>" + escapeHtml(field.label) +
          "<select name='" + field.key + "'" + required + "><option value=''>请选择</option>" + options + "</select></label>";
      }
      var type = field.type === "number" ? "number" : field.type === "date" ? "date" : "text";
      var step = field.type === "number" ? " step='any'" : "";
      return "<label>" + escapeHtml(field.label) +
        "<input name='" + field.key + "' type='" + type + "'" + step + required + " /></label>";
    }).join("");
    return "<form class='add-form'>" + inputs + "<button type='submit' class='btn-small'>添加记录</button></form>";
  }

  /* ---------- 数据读写（PocketBase） ---------- */

  function loadRecords(module) {
    pb.collection("app_data").getFullList({
      filter: "module = '" + module.id + "'",
      sort: "-created",
      // 每个模块独立的取消键：并发加载多个模块时 SDK 不会误取消请求
      requestKey: "list-" + module.id,
    }).then(function (items) {
      state.records[module.id] = items;
      renderTable(module);
      renderSummaries(module);
    }).catch(function (error) {
      $("table-" + module.id).innerHTML =
        "<p class='empty-hint'>加载失败：" + escapeHtml(friendlyError(error)) + "</p>";
    });
  }

  function submitRecord(module, form) {
    var data = {};
    module.fields.forEach(function (field) {
      var value = form.elements[field.key].value;
      data[field.key] = field.type === "number" && value !== "" ? Number(value) : value;
    });
    pb.collection("app_data").create({
      module: module.id,
      data: data,
      creator: (pb.authStore.record || {}).id || "",
    }).then(function () {
      form.reset();
      loadRecords(module);
    }).catch(function (error) {
      alert("保存失败：" + friendlyError(error));
    });
  }

  function deleteRecord(module, recordId) {
    if (!window.confirm("确定删除这条记录？")) return;
    pb.collection("app_data").delete(recordId).then(function () {
      loadRecords(module);
    }).catch(function (error) {
      alert("删除失败：" + friendlyError(error));
    });
  }

  /* ---------- 表格 / 汇总 / 预警 / 导出 ---------- */

  function isWarnRecord(module, data) {
    var warn = module.warn;
    if (!warn || data[warn.field] === "" || data[warn.field] == null) return false;
    var value = Number(data[warn.field]);
    if (isNaN(value)) return false;
    if (warn.op === "lt") return value < warn.value;
    if (warn.op === "gt") return value > warn.value;
    return false;
  }

  function renderTable(module) {
    var items = state.records[module.id] || [];
    var container = $("table-" + module.id);
    if (items.length === 0) {
      container.innerHTML = "<p class='empty-hint'>还没有记录，用上方表单添加第一条。</p>";
      return;
    }
    var head = module.fields.map(function (field) {
      return "<th>" + escapeHtml(field.label) + "</th>";
    }).join("") + "<th>录入时间</th><th></th>";

    var rows = items.map(function (item) {
      var data = item.data || {};
      var warnClass = isWarnRecord(module, data) ? " class='warn-row'" : "";
      var cells = module.fields.map(function (field) {
        var value = data[field.key];
        return "<td>" + (value === "" || value == null ? "—" : escapeHtml(String(value))) + "</td>";
      }).join("");
      var created = (item.created || "").slice(0, 16).replace("T", " ");
      return "<tr" + warnClass + ">" + cells + "<td>" + created +
        "</td><td><button type='button' class='btn-danger' data-del='" + item.id + "'>删除</button></td></tr>";
    }).join("");

    container.innerHTML = "<table><thead><tr>" + head + "</tr></thead><tbody>" + rows + "</tbody></table>";
    container.querySelectorAll("[data-del]").forEach(function (button) {
      button.addEventListener("click", function () { deleteRecord(module, button.dataset.del); });
    });
  }

  function renderSummaries(module) {
    var container = $("summary-" + module.id);
    var items = state.records[module.id] || [];
    var cards = (module.summaries || []).map(function (summary) {
      var value;
      if (summary.op === "count") {
        value = items.length;
      } else {
        var numbers = items.map(function (item) {
          return Number((item.data || {})[summary.field]);
        }).filter(function (n) { return !isNaN(n); });
        var sum = numbers.reduce(function (a, b) { return a + b; }, 0);
        value = summary.op === "avg"
          ? (numbers.length ? (sum / numbers.length).toFixed(1) : "0")
          : Math.round(sum * 100) / 100;
      }
      return { label: summary.label, value: value, warn: false };
    });

    if (module.warn) {
      var warnCount = items.filter(function (item) { return isWarnRecord(module, item.data || {}); }).length;
      cards.push({ label: module.warn.message || "预警", value: warnCount + " 条", warn: warnCount > 0 });
    }

    container.innerHTML = cards.map(function (card) {
      return "<div class='summary-card" + (card.warn ? " warn" : "") + "'>" +
        "<div class='label'>" + escapeHtml(card.label) + "</div>" +
        "<div class='value'>" + escapeHtml(String(card.value)) + "</div></div>";
    }).join("");
  }

  function exportCsv(module) {
    var items = state.records[module.id] || [];
    var header = module.fields.map(function (f) { return f.label; }).concat(["录入时间"]);
    var lines = [header.join(",")].concat(items.map(function (item) {
      var data = item.data || {};
      return module.fields.map(function (field) {
        return '"' + String(data[field.key] == null ? "" : data[field.key]).replace(/"/g, '""') + '"';
      }).concat(['"' + (item.created || "").slice(0, 16) + '"']).join(",");
    }));
    var blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = module.title + ".csv";
    link.click();
  }

  function escapeHtml(value) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ---------- 启动 ---------- */

  if (pb.authStore.isValid) {
    showApp();
  } else {
    showAuth();
  }
})();
