export type ChatSide = "left" | "right";

export type LayoutPreferences = {
  chatSide: ChatSide;
  /** Chat panel share of the split (0.2–0.55). */
  chatRatio: number;
};

const STORAGE_KEY = "mvp-ui-layout-v1";

const DEFAULT_LAYOUT: LayoutPreferences = {
  chatSide: "left",
  chatRatio: 0.32,
};

export function loadLayoutPreferences(): LayoutPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw) as Partial<LayoutPreferences>;
    const chatSide = parsed.chatSide === "right" ? "right" : "left";
    const chatRatio =
      typeof parsed.chatRatio === "number"
        ? Math.min(0.55, Math.max(0.2, parsed.chatRatio))
        : DEFAULT_LAYOUT.chatRatio;
    return { chatSide, chatRatio };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function saveLayoutPreferences(layout: LayoutPreferences): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}

export { DEFAULT_LAYOUT };
