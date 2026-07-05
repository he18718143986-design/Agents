import type { RequirementsData } from "../types";

interface RequirementsDraftPreviewProps {
  requirements: RequirementsData;
  fromChat?: boolean;
}

export function RequirementsDraftPreview({
  requirements,
  fromChat,
}: RequirementsDraftPreviewProps) {
  const hasContent =
    requirements.goal ||
    requirements.p0Features.length > 0 ||
    requirements.acceptance.length > 0;

  if (!hasContent) {
    return (
      <p className="text-sm text-stone">
        在左侧描述你想做的软件，Agent 和前端会在这里同步整理需求草稿。
      </p>
    );
  }

  return (
    <div className="space-y-3 text-sm leading-6 text-paper-dim">
      {fromChat && (
        <p className="rounded-lg border border-cinnabar/40 bg-ink-softer px-3 py-2 text-xs text-cinnabar-tint">
          已根据对话自动整理（可继续在聊天中修改）
        </p>
      )}
      {requirements.goal && (
        <div>
          <div className="text-xs font-medium text-stone">目标</div>
          <p>{requirements.goal}</p>
        </div>
      )}
      {requirements.users && (
        <div>
          <div className="text-xs font-medium text-stone">用户</div>
          <p>{requirements.users}</p>
        </div>
      )}
      {requirements.p0Features.length > 0 && (
        <div>
          <div className="text-xs font-medium text-stone">P0 功能</div>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {requirements.p0Features.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {requirements.acceptance.length > 0 && (
        <div>
          <div className="text-xs font-medium text-stone">验收草案</div>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {requirements.acceptance.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
