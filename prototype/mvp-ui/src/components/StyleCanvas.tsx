import { STYLE_OPTIONS, TECH_OPTIONS } from "../mockAgent";
import { CanvasTabs } from "./CanvasTabs";
import type { TechChoice, TechGuidance } from "../types";

interface StyleCanvasProps {
  selectedTechId: TechChoice;
  selectedStyleId: "A" | "B" | null;
  styleVersion: number;
  styleWarmth: number;
  styleButtonSize: number;
  pageTitle: string;
  techGuidance: TechGuidance | null;
  techRecommendation: TechChoice;
  onSelectTech: (id: TechChoice) => void;
  onSelectStyle: (id: "A" | "B") => void;
}

function PreviewMock({
  styleId,
  warmth,
  buttonSize,
  pageTitle,
}: {
  styleId: "A" | "B";
  warmth: number;
  buttonSize: number;
  pageTitle: string;
}) {
  const isWarm = styleId === "B" || warmth > 55;
  const primary = isWarm ? "#ea580c" : "#2563eb";
  const bg = isWarm ? "#fff7ed" : "#f8fafc";
  const card = "#ffffff";
  const buttonPaddingY = 8 + Math.round((buttonSize / 100) * 10);
  const buttonPaddingX = 16 + Math.round((buttonSize / 100) * 12);
  const buttonFontSize = 12 + Math.round((buttonSize / 100) * 6);
  const title = pageTitle.trim() || "功能页面";

  return (
    <div
      className="overflow-hidden rounded-2xl border shadow-inner"
      style={{ background: bg, borderColor: isWarm ? "#fed7aa" : "#dbeafe" }}
    >
      <div className="border-b px-4 py-2 text-xs text-stone" style={{ background: card }}>
        关键页面预览 · {title}
      </div>
      <div className="flex min-h-[360px] items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-2xl border bg-ink-soft p-5 shadow-sm" style={{ borderColor: isWarm ? "#ffedd5" : "#e2e8f0" }}>
          <div className="mb-1 text-lg font-semibold" style={{ color: isWarm ? "#9a3412" : "#1e3a8a" }}>
            {title}
          </div>
          <div className="mb-4 text-xs text-stone">示意布局，非真实数据</div>
          <div className="space-y-3">
            {["字段 A", "字段 B", "字段 C", "字段 D"].map((label) => (
              <div key={label}>
                <div className="mb-1 text-xs text-paper-dim">{label}</div>
                <div className="h-9 rounded-lg border bg-ink-softer" style={{ borderColor: isWarm ? "#fdba74" : "#cbd5e1" }} />
              </div>
            ))}
          </div>
          <button
            type="button"
            className="mt-4 w-full rounded-xl font-medium text-paper"
            style={{
              background: primary,
              padding: `${buttonPaddingY}px ${buttonPaddingX}px`,
              fontSize: `${buttonFontSize}px`,
            }}
          >
            提交
          </button>
        </div>
      </div>
    </div>
  );
}

export function StyleCanvas({
  selectedTechId,
  selectedStyleId,
  styleVersion,
  styleWarmth,
  styleButtonSize,
  pageTitle,
  techGuidance,
  techRecommendation,
  onSelectTech,
  onSelectStyle,
}: StyleCanvasProps) {
  const activeStyle = selectedStyleId ?? "B";

  const tabs = [
    {
      id: "tech",
      label: "技术路线",
      badge: selectedTechId ? "已选" : undefined,
      content: (
        <div className="grid gap-3 sm:grid-cols-3">
          {TECH_OPTIONS.map((option) => {
            const selected = selectedTechId === option.id;
            const guidance = techGuidance?.[option.id];
            const recommended =
              techRecommendation === option.id || option.recommended;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onSelectTech(option.id)}
                className={[
                  "rounded-2xl border p-4 text-left transition",
                  selected
                    ? "border-sky-400 bg-sky-50 ring-2 ring-sky-200"
                    : "border-hairline bg-ink-soft hover:border-sky-200",
                ].join(" ")}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="font-semibold text-paper">{option.name}</div>
                  {recommended && (
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700">
                      {techRecommendation === option.id ? "Agent 推荐" : "推荐"}
                    </span>
                  )}
                </div>
                <p className="mb-2 text-sm text-paper-dim">{option.summary}</p>
                {guidance?.summary && (
                  <p className="mb-2 text-xs leading-5 text-cinnabar-tint">
                    适合你吗：{guidance.summary}
                  </p>
                )}
                {guidance?.tradeoffs && (
                  <p className="mb-2 text-xs leading-5 text-stone">{guidance.tradeoffs}</p>
                )}
                <p className="text-xs text-stone">{option.cost}</p>
              </button>
            );
          })}
        </div>
      ),
    },
    {
      id: "pick",
      label: "选风格",
      badge: selectedStyleId ? `已选 ${selectedStyleId}` : undefined,
      content: (
        <div className="grid gap-3 sm:grid-cols-2">
          {STYLE_OPTIONS.map((style) => {
            const selected = selectedStyleId === style.id;
            return (
              <button
                key={style.id}
                type="button"
                onClick={() => onSelectStyle(style.id)}
                className={[
                  "rounded-2xl border p-4 text-left transition",
                  selected
                    ? "border-orange-400 bg-orange-50 ring-2 ring-orange-200"
                    : "border-hairline bg-ink-soft hover:border-orange-200 hover:bg-orange-50/40",
                ].join(" ")}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="font-semibold text-paper">
                    风格 {style.id} · {style.name}
                  </div>
                  {style.recommended && (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700">
                      推荐
                    </span>
                  )}
                </div>
                <p className="mb-3 text-sm text-paper-dim">{style.description}</p>
                <div className="flex gap-2">
                  {style.colors.map((color) => (
                    <div
                      key={color}
                      className="h-6 w-6 rounded-full border border-white shadow"
                      style={{ background: color }}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      ),
    },
    {
      id: "preview",
      label: "页面预览",
      badge: `v${styleVersion}`,
      content: (
        <div>
          <PreviewMock
            styleId={activeStyle}
            warmth={styleWarmth}
            buttonSize={styleButtonSize}
            pageTitle={pageTitle}
          />
          <div className="mt-3 text-xs text-stone">可在左侧聊天继续修改</div>
        </div>
      ),
    },
  ];

  return <CanvasTabs tabs={tabs} />;
}
