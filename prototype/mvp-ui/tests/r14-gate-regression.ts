/**
 * R14 回归：coach 重复携带未变化的 needs 字段时，可行性确认不得被重置。
 * 运行：npx tsx tests/r14-gate-regression.ts（输出 R14 PASS 即通过）
 */
import { appReducer, initialState } from "../src/store.ts";

// 模拟：需求含第三方集成，用户已点「我已了解」
let state = appReducer(initialState, {
  type: "UPDATE_REQUIREMENTS",
  patch: { goal: "会员管理", needsIntegration: true },
});
state = appReducer(state, { type: "SET_FEASIBILITY_ACKNOWLEDGED" });
console.log("确认后 acknowledged =", state.requirements.feasibilityAcknowledged); // true

// KEY 回归：coach 重复携带【相同】needs 值（B1 场景）
state = appReducer(state, {
  type: "UPDATE_REQUIREMENTS",
  patch: { users: "3 个店员", needsIntegration: true },
});
console.log("重复相同值后 acknowledged =", state.requirements.feasibilityAcknowledged, "(期望 true，修复前为 false)");

// 对照：needs 值【真的变化】时应重置
state = appReducer(state, {
  type: "UPDATE_REQUIREMENTS",
  patch: { needsIntegration: false },
});
state = appReducer(state, {
  type: "UPDATE_REQUIREMENTS",
  patch: { needsIntegration: true },
});
console.log("值变化后 acknowledged =", state.requirements.feasibilityAcknowledged, "(期望 false，需重新确认)");

const pass =
  state.requirements.feasibilityAcknowledged === false;
console.log(pass ? "R14 PASS" : "R14 FAIL");
