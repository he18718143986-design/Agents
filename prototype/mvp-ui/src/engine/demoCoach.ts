import type {
  AppState,
  PathComparison,
  RequirementsData,
  TechChoice,
  TechGuidance,
} from "../types";
import type { CanvasPatch, GateHints } from "./parseCanvasPatch";

/** Scripted coach for demo mode (体验模式): deterministic, no LLM, works fully offline. */

export interface DemoReply {
  text: string;
  patch: CanvasPatch | null;
  gateHints: GateHints;
}

export function demoWelcomeText(): string {
  return [
    "你好，我是 Stagent 体验助手。当前是体验模式：整个流程由内置脚本驱动，不消耗 AI 额度，制作结果为演示应用。",
    "想解决什么问题？用一两句话描述就行，比如「帮我们小团队做一个工程进度和财务对账的小工具」。",
  ].join("\n");
}

const SPLIT_PATTERN = /[、，,;；]|\s+和\s+|\n+/;
const NOISE_PREFIX = /^(请|帮我|帮我们|我想|我们想|想要|需要|希望|开发|做一个|做个|做)/;
const PLATFORM_STATEMENT = /^(在)?(电脑|手机|微信|浏览器|pc|移动端)(上|端|里)?(使用|用|打开|运行)?$/i;
const CONTENT_PREFIX = /^(包含|包括|要有|需要有|支持|实现|提供)/;

function extractFeatures(text: string): string[] {
  return text
    .replace(/[。.!！?？]+$/g, "")
    .split(SPLIT_PATTERN)
    .map((part) => part.trim().replace(CONTENT_PREFIX, ""))
    .filter(
      (part) =>
        part.length >= 2 &&
        part.length <= 30 &&
        !NOISE_PREFIX.test(part) &&
        !PLATFORM_STATEMENT.test(part) &&
        !/(软件|系统|平台|工具|app)$/i.test(part),
    )
    .slice(0, 8);
}

function guessNeeds(text: string): Pick<
  RequirementsData,
  "needsPersistence" | "needsAuth" | "needsIntegration"
> {
  return {
    needsPersistence: /保存|记录|台账|历史|数据|报表|统计|档案/.test(text),
    needsAuth: /登录|账号|权限|多人|协作|角色|员工/.test(text),
    needsIntegration: /微信|支付|短信|钉钉|对接|接口|同步|导入/.test(text),
  };
}

function demoPathComparison(goal: string): PathComparison {
  const topic = goal ? `「${goal.slice(0, 18)}」` : "这个需求";
  return {
    saas: {
      fit: `如果市面上已有覆盖${topic}的成熟产品，直接订阅通常最快。`,
      caveat: "以上为通用参考；差异化流程和字段可能无法完全满足。",
    },
    low_code: {
      fit: "表单 + 台账类需求可以用低代码平台自行拖拽搭建。",
      caveat: "以上为通用参考；复杂联动逻辑维护起来较吃力。",
    },
    self_build: {
      fit: `${topic}若有自己的规则和流程，自研能完全贴合你的用法。`,
      caveat: "需要投入时间参与需求确认和验收。",
    },
    competitorNote: "体验模式提示：正式版会结合你的行业给出更具体的对比。",
  };
}

function demoTechGuidance(): { guidance: TechGuidance; recommendation: TechChoice } {
  return {
    guidance: {
      web: {
        summary: "浏览器直接打开，手机电脑都能用，分享一个链接即可。",
        tradeoffs: "需要网络；后续加登录和数据库最方便。",
      },
      wechat: {
        summary: "员工在微信里打开，无需安装，上手门槛最低。",
        tradeoffs: "需要企业主体注册小程序并通过微信审核。",
      },
      desktop: {
        summary: "安装在办公电脑上，本地使用，不依赖网络。",
        tradeoffs: "更新和多人协作不如网页方便。",
      },
    },
    recommendation: "web",
  };
}

function deriveAcceptance(p0Features: string[]): string[] {
  const items = p0Features.slice(0, 4).map((feature) => `能完成「${feature}」的完整操作`);
  items.push("页面在电脑和手机浏览器都能正常打开");
  return items;
}

interface DemoContext {
  stage: AppState["stage"];
  text: string;
  requirements: RequirementsData;
  userMessageCountInStage: number;
}

export function demoCoachReply(ctx: DemoContext): DemoReply {
  const { stage, text, requirements } = ctx;

  if (stage === 0) {
    const features = extractFeatures(text);
    const needs = guessNeeds(text);

    if (!requirements.goal) {
      const goal = text.trim().slice(0, 40);
      const patch: CanvasPatch = {
        goal,
        ...(features.length > 1 ? { p0Features: features } : {}),
        ...needs,
        pathComparison: demoPathComparison(goal),
      };
      return {
        text: [
          "收到，我先把你的想法整理到右侧需求草稿里了。",
          "再帮我确认两件事：",
          "1. 主要给谁用？大概几个人？",
          "2. 现在这件事是怎么做的（Excel、纸质、微信群）？",
        ].join("\n"),
        patch,
        gateHints: {},
      };
    }

    const extraFeatures = features.filter(
      (feature) => !requirements.p0Features.includes(feature),
    );
    const patch: CanvasPatch = {
      ...(extraFeatures.length > 0 && requirements.p0Features.length === 0
        ? { p0Features: extraFeatures }
        : {}),
      ...(/人|团队|同事|员工|个/.test(text) ? { users: text.trim().slice(0, 30) } : {}),
      pathComparison: demoPathComparison(requirements.goal),
    };
    return {
      text: [
        "明白了，信息已经补充到右侧。",
        "从你的描述看，这个需求有自己的流程规则，自研能贴合你的用法；右侧也列了 SaaS 和低代码方案的对比。",
        "可以在右侧选择一条路线，然后点击「确认」拍板。",
      ].join("\n"),
      patch,
      gateHints: { pathReady: true },
    };
  }

  if (stage === 1) {
    const patch: CanvasPatch = {};
    if (!requirements.users) {
      patch.users = /人|团队|同事/.test(text) ? text.trim().slice(0, 30) : "你和你的同事（3～10 人）";
    }
    if (requirements.acceptance.length === 0) {
      patch.acceptance = deriveAcceptance(
        requirements.p0Features.length > 0 ? requirements.p0Features : extractFeatures(text),
      );
    }
    if (!requirements.timeline) {
      patch.timeline = /周|月|天|急/.test(text) ? text.trim().slice(0, 20) : "两周内看到第一版";
    }
    const needs = guessNeeds(`${text} ${requirements.goal} ${requirements.p0Features.join(" ")}`);
    Object.assign(patch, needs);

    return {
      text: [
        "需求文档我已经帮你补全了：目标用户、验收标准、时间预期都填在右侧。",
        "请逐条看一遍，尤其是「验收标准」——之后制作完成后就按这几条来验收。",
        "有要改的直接说；没问题就点击「确认需求，继续」。",
      ].join("\n"),
      patch,
      gateHints: { requirementsReady: true },
    };
  }

  if (stage === 2) {
    const { guidance, recommendation } = demoTechGuidance();
    return {
      text: "关于技术路线：日常办公场景我推荐先做网页应用，一个链接就能分享给同事。右侧可以选路线和界面风格，选好后点击「确认，开始制作」。",
      patch: { techGuidance: guidance, techRecommendation: recommendation },
      gateHints: {},
    };
  }

  if (stage === 3) {
    return {
      text: "收到。可以在右侧「试用预览」里实际点一点，再对照「验收清单」逐条勾选；要修改就点「还不行，继续改」然后告诉我改哪里。",
      patch: null,
      gateHints: {},
    };
  }

  return {
    text: "部署相关的问题都可以问我。测试环境就绪后建议先让同事试用，再决定是否正式上线。",
    patch: null,
    gateHints: {},
  };
}

export function demoChangeRequestReply(request: string): string {
  return `收到修改请求：「${request.trim().slice(0, 60)}」。正在按这个方向更新演示应用，请稍候…`;
}
