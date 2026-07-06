/**
 * R16 回归：需求字段齐全但 coach 未发 requirementsReady 信号时，
 * 提供人工兜底（requirementsReadyButAiSilent=true），且用户手动确认后能推进。
 * 复现实验 002 A2 的卡死场景并验证修复。
 * 运行：npx tsx tests/r16-requirements-fallback.ts（输出 R16 PASS 即通过）
 */
import { appReducer, initialState } from "../src/store.ts";
import { requirementsReadyButAiSilent } from "../src/engine/gateReadiness.ts";

// 进入阶段 1（自研路线已确认）
let state = appReducer(initialState, { type: "CONFIRM_PATH_SELF_BUILD" });

// coach 补全全部需求字段，但【未】发 requirementsReady（模拟 A2 时序问题）
state = appReducer(state, {
  type: "UPDATE_REQUIREMENTS",
  patch: {
    goal: "会员管理工具",
    users: "门店 3 名店员",
    p0Features: ["会员登记", "积分记录"],
    acceptance: ["能导出会员名单"],
    timeline: "两周内",
  },
});

const silentBefore = requirementsReadyButAiSilent(state);
console.log("字段齐全但 AI 沉默 → 兜底可用 =", silentBefore, "(期望 true)");
console.log("此时 requirementsComplete =", state.requirementsComplete, "(期望 false，正常门禁不出现)");

// 用户点「需求已齐全，确认」→ 手动置为 complete → 门禁出现
state = appReducer(state, { type: "SET_REQUIREMENTS_COMPLETE" });
console.log("手动确认后 requirementsComplete =", state.requirementsComplete, "(期望 true)");
console.log("手动确认后 pendingGate =", state.pendingGate, "(期望 requirements)");

// 兜底提示应消失（已 complete）
const silentAfter = requirementsReadyButAiSilent(state);

// 对照：字段不全时兜底不应出现
let partial = appReducer(initialState, { type: "CONFIRM_PATH_SELF_BUILD" });
partial = appReducer(partial, {
  type: "UPDATE_REQUIREMENTS",
  patch: { goal: "只有目标" },
});
const silentPartial = requirementsReadyButAiSilent(partial);
console.log("字段不全时兜底 =", silentPartial, "(期望 false)");

const pass =
  silentBefore === true &&
  state.requirementsComplete === true &&
  state.pendingGate === "requirements" &&
  silentAfter === false &&
  silentPartial === false;
console.log(pass ? "R16 PASS" : "R16 FAIL");
process.exit(pass ? 0 : 1);
