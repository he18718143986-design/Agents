/** Hidden user turn that asks the coach agent for the stage-0 welcome message. */
export const WELCOME_TRIGGER_TEXT =
  "[阶段上下文]\n当前 MVP 阶段: 0（探索）\n\n" +
  "用户刚开始体验，尚未描述任何想法。请用中文写欢迎语：最多 2 句（问候 + 问想解决什么问题），" +
  "不要列表、不要介绍界面布局。不要附加 canvas-json。";

export function welcomeTriggerPayload() {
  return {
    role: "user" as const,
    content: [{ type: "text" as const, text: WELCOME_TRIGGER_TEXT }],
    run: true,
  };
}
