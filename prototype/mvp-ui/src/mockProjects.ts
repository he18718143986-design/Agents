import type { Stage } from "./types";

export type ProjectStatus = "active" | "completed";

export type MockProject = {
  id: string;
  title: string;
  summary: string;
  stage: Stage;
  status: ProjectStatus;
  updatedAt: number;
  completedAt?: number;
};

export type ShowcaseItem = {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  author: string;
  stageLabel: string;
};

export const STAGE_LABELS: Record<Stage, string> = {
  0: "探索",
  1: "需求整理",
  2: "风格选型",
  3: "制作验收",
  4: "测试上线",
};

export const SHOWCASE_ITEMS: ShowcaseItem[] = [
  {
    id: "showcase-leave",
    title: "团队请假登记",
    summary: "员工手机登记、行政一键导出，适合 20～50 人小公司。",
    tags: ["内部工具", "行政"],
    author: "官方示例",
    stageLabel: "已上线",
  },
  {
    id: "showcase-finance",
    title: "工程财务管控",
    summary: "桌面端进度与财务数据对照，预算与进度预警，月度报表。",
    tags: ["桌面", "工程"],
    author: "官方示例",
    stageLabel: "需求已定",
  },
  {
    id: "showcase-kb",
    title: "部门知识库",
    summary: "常见问题沉淀、全文搜索、新人 onboarding 引导。",
    tags: ["知识管理", "协作"],
    author: "官方示例",
    stageLabel: "探索中",
  },
  {
    id: "showcase-event",
    title: "活动报名收集",
    summary: "在线表单、人数统计、导出名单，适合社团与培训场景。",
    tags: ["表单", "活动"],
    author: "社区精选",
    stageLabel: "可试用",
  },
];

export const SEED_PROJECTS: MockProject[] = [
  {
    id: "demo-paused",
    title: "内部待办清单",
    summary: "上次停在探索阶段，还差人数与预算信息。",
    stage: 0,
    status: "active",
    updatedAt: Date.now() - 1000 * 60 * 60 * 26,
  },
];
