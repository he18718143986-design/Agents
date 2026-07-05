#!/usr/bin/env python3
"""PROTOTYPE — smoke-test requirement input against the OpenHands engine.

Sends a realistic user brief through the same coach prompt used by mvp-ui phase A
and prints the agent's reply for manual quality review.

Usage:
    export LLM_API_KEY=sk-...
    uv run python prototype/test_requirement_input.py
"""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path

from pydantic import SecretStr

from openhands.sdk import Agent, LLM
from openhands.sdk.conversation import LocalConversation
from openhands.sdk.conversation.state import ConversationExecutionStatus
from openhands.sdk.conversation.response_utils import get_agent_final_response
from openhands.sdk.event.llm_convertible.message import MessageEvent
from openhands.sdk.llm.message import content_to_str

REPO_ROOT = Path(__file__).resolve().parent.parent
WORKSPACE = REPO_ROOT / "prototype" / "workspaces" / "requirement-test"

USER_INPUT = (
    "开发一下小软件，在电脑上使用，包含工程进度管控，"
    "财务数据匹配，进度预警，财务预算预警，月度报表。"
)

SYSTEM_PROMPT = """你是 Agent 工坊的体验助手。用户通过左侧聊天与你交流，右侧是产品原型画布（由前端 mock 驱动，你暂时看不到）。

职责概要：
- 阶段 0：帮助用户探索「这个问题值不值得自己做」
- 阶段 1：帮用户理清需求（目标用户、核心功能、验收标准）
- 阶段 2：讨论界面风格与技术路线（用户会在右侧选择，聊天里给建议即可）
- 阶段 3/4：用户会走 mock 制作/上线流程，你主要回答问题

每次回复简洁、友好，用中文。每条用户消息会附带 [阶段上下文] 说明当前进度。

当用户给出较完整的功能列表时，请帮忙：
1. 用结构化方式复述需求（目标、用户、P0 功能、验收标准）
2. 指出还缺哪些关键信息（人数、预算、时间、技术偏好）
3. 给出 1～2 条可执行的下一步建议
"""

STAGE_CONTEXT = """[阶段上下文]
当前 MVP 阶段: 0（探索（值不值得做））
说明：右侧画布由前端 mock 驱动，你暂时看不到。请根据对话引导用户，并在合适时提醒查看右侧。"""


def resolve_api_key() -> str:
    for name in ("LLM_API_KEY", "DEEPSEEK_API_KEY", "OPENAI_API_KEY"):
        value = os.getenv(name)
        if value:
            print(f"Using API key from {name}", file=sys.stderr)
            return value
    print("Error: set LLM_API_KEY or DEEPSEEK_API_KEY", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    WORKSPACE.mkdir(parents=True, exist_ok=True)

    api_key = resolve_api_key()
    model = os.getenv("LLM_MODEL", "deepseek/deepseek-v4-flash")
    base_url = os.getenv("LLM_BASE_URL", "https://api.deepseek.com")

    llm = LLM(
        model=model,
        api_key=SecretStr(api_key),
        base_url=base_url,
        usage_id="prototype-requirement-test",
        drop_params=True,
    )

    agent = Agent(
        llm=llm,
        tools=[],
        system_prompt=SYSTEM_PROMPT,
    )

    conversation = LocalConversation(
        agent=agent,
        workspace=str(WORKSPACE),
        max_iteration_per_run=8,
        delete_on_close=True,
    )

    payload = f"{STAGE_CONTEXT}\n\n用户消息：\n{USER_INPUT}"
    print("=" * 60)
    print("USER INPUT:")
    print(USER_INPUT)
    print("=" * 60)

    started = time.monotonic()
    conversation.send_message(payload)
    conversation.run()
    elapsed = time.monotonic() - started

    status = conversation.state.execution_status
    print(f"\nStatus: {status} ({elapsed:.1f}s)")

    agent_messages: list[str] = []
    for event in conversation.state.events:
        if isinstance(event, MessageEvent) and event.source == "agent":
            text = "\n".join(content_to_str(event.llm_message.content)).strip()
            if text:
                agent_messages.append(text)

    final = get_agent_final_response(conversation.state.events)
    print("\n" + "=" * 60)
    print("AGENT REPLY (last message event):")
    print("=" * 60)
    if agent_messages:
        print(agent_messages[-1])
    else:
        print("(no agent MessageEvent)")

    if final and final != (agent_messages[-1] if agent_messages else ""):
        print("\n" + "=" * 60)
        print("AGENT FINAL RESPONSE (finish / fallback):")
        print("=" * 60)
        print(final)

    conversation.close()

    if status == ConversationExecutionStatus.ERROR:
        sys.exit(1)


if __name__ == "__main__":
    main()
