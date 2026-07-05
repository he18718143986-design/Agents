import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ChatMessage } from "../types";
import type { Stage } from "../types";

interface ChatPanelProps {
  messages: ChatMessage[];
  isAgentTyping: boolean;
  quickReplies?: string[];
  onSend: (text: string) => void;
  disabled?: boolean;
  embedded?: boolean;
  beforeInput?: ReactNode;
}

export function ChatPanel({
  messages,
  isAgentTyping,
  quickReplies = [],
  onSend,
  disabled,
  embedded = false,
  beforeInput,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAgentTyping]);

  const handleSubmit = () => {
    if (!input.trim() || disabled) return;
    onSend(input);
    setInput("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {!embedded && (
        <div className="border-b border-hairline-soft px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cinnabar text-sm text-paper">
              AI
            </div>
            <div>
              <div className="text-sm font-semibold text-paper">与 Agent 对话</div>
              <div className="text-xs text-stone">左侧聊天，右侧查看成果</div>
            </div>
          </div>
        </div>
      )}

      <div
        className={[
          "chat-scroll flex-1 space-y-4 overflow-y-auto",
          embedded ? "px-4 py-4" : "px-4 py-4",
        ].join(" ")}
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={`animate-fade-in flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {message.role === "user" ? (
              <div className="max-w-[92%] whitespace-pre-wrap rounded-2xl bg-cinnabar px-3.5 py-2.5 text-sm leading-6 text-paper">
                {message.content}
              </div>
            ) : (
              <div className="max-w-[92%] whitespace-pre-wrap text-sm leading-7 text-paper">
                {message.content}
              </div>
            )}
          </div>
        ))}
        {isAgentTyping && (
          <div className="animate-pulse-soft text-sm text-stone">Agent 正在输入…</div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-hairline-soft/70 px-4 py-3">
        {quickReplies.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {quickReplies.map((reply) => (
              <button
                key={reply}
                type="button"
                disabled={disabled}
                onClick={() => onSend(reply)}
                className="rounded-full px-3 py-1 text-xs text-paper-dim transition hover:text-cinnabar-tint disabled:opacity-50"
              >
                {reply}
              </button>
            ))}
          </div>
        )}

        {beforeInput ? <div className="mb-3">{beforeInput}</div> : null}

        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            disabled={disabled}
            placeholder="说点什么…"
            className="min-w-0 flex-1 border-0 bg-transparent text-sm text-paper outline-none placeholder:text-stone disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={disabled || !input.trim()}
            className="shrink-0 text-sm font-medium text-cinnabar-tint transition hover:text-paper disabled:cursor-not-allowed disabled:opacity-40"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}

export function getQuickReplies(stage: Stage): string[] {
  if (stage === 0) {
    return ["3～5 人小团队用", "数据从 Excel 导入", "希望一个月内能用"];
  }
  if (stage === 1) {
    return ["验收：能导出月度报表", "不做移动端", "两周内看到第一版"];
  }
  if (stage === 2) {
    return ["按钮再大一点", "颜色更温暖一点", "整体更简洁"];
  }
  if (stage === 3) {
    return ["手机端打不开", "导出字段顺序改一下", "整体满意"];
  }
  return [];
}
