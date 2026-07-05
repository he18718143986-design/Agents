import { useState } from "react";
import type { PathChoice } from "../types";
import { CanvasTabs } from "./CanvasTabs";

const SAAS_PRODUCTS = [
  {
    id: "feishu",
    name: "飞书审批",
    tag: "推荐",
    time: "约 15 分钟",
    summary: "模板多、导出方便，适合已用飞书的公司",
    link: "https://www.feishu.cn/approval",
  },
  {
    id: "dingtalk",
    name: "钉钉审批",
    tag: null,
    time: "约 20 分钟",
    summary: "与钉钉通讯录打通，适合制造业、连锁门店",
    link: "https://www.dingtalk.com",
  },
  {
    id: "tencent",
    name: "腾讯文档收集表",
    tag: null,
    time: "约 10 分钟",
    summary: "零门槛，适合临时收集、轻量登记",
    link: "https://docs.qq.com",
  },
];

const ADMIN_STEPS = [
  {
    id: "pick",
    title: "选定产品并登录管理后台",
    detail: "建议优先飞书审批；若公司已在用钉钉，选钉钉更省事。",
  },
  {
    id: "template",
    title: "复制合适模板并发布",
    detail: "按你的需求配置字段，并确认可导出或汇总数据。",
  },
  {
    id: "invite",
    title: "邀请全员或指定部门",
    detail: "把入口发到公司群，或写入员工手册链接。",
  },
  {
    id: "test",
    title: "自己先提交一条测试数据",
    detail: "确认能收到通知、能导出，再让员工正式使用。",
  },
];

const EMPLOYEE_STEPS = [
  { n: 1, title: "打开链接", body: "从群公告或通知里点开应用入口" },
  { n: 2, title: "填写信息", body: "按页面提示填写，一般 1 分钟内完成" },
  { n: 3, title: "提交即可", body: "数据会自动汇总，无需额外催办" },
];

interface SaasOnboardingCanvasProps {
  pathChoice: PathChoice;
  discoveryBrief?: string;
}

export function SaasOnboardingCanvas({
  pathChoice,
  discoveryBrief,
}: SaasOnboardingCanvasProps) {
  const isLowCode = pathChoice === "low_code";
  const [selectedProduct, setSelectedProduct] = useState("feishu");
  const [adminDone, setAdminDone] = useState<Record<string, boolean>>({});
  const [employeeStep, setEmployeeStep] = useState(1);

  const adminCount = ADMIN_STEPS.filter((s) => adminDone[s.id]).length;
  const product = SAAS_PRODUCTS.find((p) => p.id === selectedProduct) ?? SAAS_PRODUCTS[0];

  const welcomeTab = {
    id: "welcome",
    label: "欢迎引导",
    content: (
      <div className="space-y-5">
        <div className="rounded-2xl bg-gradient-to-br from-cinnabar to-cinnabar-soft p-6 text-paper shadow-md">
          <div className="text-xs font-medium uppercase tracking-wide text-paper-dim">
            {isLowCode ? "低代码路线" : "SaaS 路线"}
          </div>
          <h2 className="mt-2 text-xl font-semibold">外部方案已就绪</h2>
          <p className="mt-2 text-sm leading-6 text-paper-dim">
            不用写代码，今天就能用起来。管理员按右侧步骤开通，同事打开链接即可使用。
          </p>
          {discoveryBrief && (
            <div className="mt-4 rounded-xl bg-ink-soft/10 px-4 py-3 text-sm text-paper-dim">
              <span className="font-medium text-paper">你的情况：</span>
              {discoveryBrief.split("\n").slice(-1)[0]}
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: "1", title: "管理员开通", desc: "约 15～20 分钟" },
            { icon: "2", title: "发给员工", desc: "分享引导页链接" },
            { icon: "3", title: "试跑一条", desc: "确认能导出" },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-hairline bg-ink-softer/60 p-4 text-center"
            >
              <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-ink-softer text-sm font-semibold text-cinnabar-tint">
                {item.icon}
              </div>
              <div className="text-sm font-medium text-paper">{item.title}</div>
              <div className="mt-1 text-xs text-stone">{item.desc}</div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {isLowCode
            ? "低代码方案可在可视化后台自己改字段；若后续需求变复杂，仍可回来选择自研。"
            : "SaaS 方案适合标准场景。若以后要深度定制，可随时在对话里说「改走自研」。"}
        </div>
      </div>
    ),
  };

  const setupTab = {
    id: "setup",
    label: "开通步骤",
    badge: `${adminCount}/${ADMIN_STEPS.length}`,
    content: (
      <div className="space-y-5">
        <div>
          <div className="mb-2 text-sm font-medium text-paper">先选一个产品</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {SAAS_PRODUCTS.map((p) => {
              const active = selectedProduct === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedProduct(p.id)}
                  className={[
                    "rounded-xl border p-3 text-left transition",
                    active
                      ? "border-brass bg-ink-softer ring-2 ring-cinnabar/20"
                      : "border-hairline bg-ink-soft hover:border-cinnabar/40",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-paper">{p.name}</span>
                    {p.tag && (
                      <span className="rounded-full bg-ink-softer px-1.5 py-0.5 text-[10px] text-cinnabar-tint">
                        {p.tag}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-stone">{p.time}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-hairline bg-ink-softer px-4 py-3">
          <div>
            <div className="text-sm font-medium text-paper">已选：{product.name}</div>
            <div className="text-xs text-stone">{product.summary}</div>
          </div>
          <a
            href={product.link}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-lg bg-cinnabar px-3 py-2 text-xs font-medium text-paper hover:bg-cinnabar-tint"
          >
            打开官网
          </a>
        </div>

        <div className="space-y-2">
          {ADMIN_STEPS.map((step, index) => {
            const done = adminDone[step.id];
            return (
              <label
                key={step.id}
                className={[
                  "flex cursor-pointer gap-3 rounded-xl border p-4 transition",
                  done ? "border-pine-tint/40 bg-pine/20/50" : "border-hairline hover:bg-ink-softer",
                ].join(" ")}
              >
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() =>
                    setAdminDone((prev) => ({ ...prev, [step.id]: !prev[step.id] }))
                  }
                  className="mt-1"
                />
                <div>
                  <div className="text-sm font-medium text-paper">
                    {index + 1}. {step.title}
                  </div>
                  <div className="mt-1 text-xs text-stone">{step.detail}</div>
                </div>
              </label>
            );
          })}
        </div>
      </div>
    ),
  };

  const employeeTab = {
    id: "employee",
    label: "员工打开页",
    badge: `第 ${employeeStep} 步`,
    content: (
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <p className="text-sm text-paper-dim">
            员工第一次打开网页时，可展示这样的引导（3 步，约 30 秒看完）：
          </p>
          {EMPLOYEE_STEPS.map((step) => {
            const active = employeeStep === step.n;
            return (
              <button
                key={step.n}
                type="button"
                onClick={() => setEmployeeStep(step.n)}
                className={[
                  "w-full rounded-xl border p-4 text-left transition",
                  active
                    ? "border-brass bg-ink-softer ring-2 ring-cinnabar/20"
                    : "border-hairline bg-ink-soft hover:border-cinnabar/40",
                ].join(" ")}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={[
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      active ? "bg-cinnabar text-paper" : "bg-ink-soft text-paper-dim",
                    ].join(" ")}
                  >
                    {step.n}
                  </span>
                  <div>
                    <div className="text-sm font-medium text-paper">{step.title}</div>
                    <div className="text-xs text-stone">{step.body}</div>
                  </div>
                </div>
              </button>
            );
          })}
          <div className="rounded-xl border border-dashed border-hairline bg-ink-softer px-4 py-3 text-xs text-stone">
            完整版可生成「员工引导链接」或二维码，发到公司群一键打开。
          </div>
        </div>

        <EmployeePageMock step={employeeStep} productName={product.name} />
      </div>
    ),
  };

  const handoffTab = {
    id: "handoff",
    label: "发给同事",
    disabled: adminCount < ADMIN_STEPS.length,
    badge: adminCount >= ADMIN_STEPS.length ? "可发送" : "先完成开通",
    content: (
      <div className="space-y-4">
        <div className="rounded-xl border border-pine-tint/40 bg-pine/20 px-4 py-3 text-sm text-pine-tint">
          开通步骤已完成。把下面文案复制到公司群即可。
        </div>
        <div className="rounded-xl border border-hairline bg-ink-softer p-4 font-mono text-xs leading-6 text-paper-dim">
          【新工具上线啦】
          <br />
          请大家用 {product.name} 完成登记，链接见群公告。
          <br />
          操作很简单：打开 → 填信息 → 提交，1 分钟搞定。
          <br />
          有问题联系 @{`{你的名字}`}
        </div>
        <button
          type="button"
          className="rounded-xl bg-cinnabar px-4 py-2.5 text-sm font-medium text-paper hover:bg-cinnabar-tint"
          onClick={() =>
            navigator.clipboard?.writeText(
              `【新工具上线啦】请大家用 ${product.name} 完成登记，链接见群公告。`,
            )
          }
        >
          复制群公告文案
        </button>
      </div>
    ),
  };

  const tabs = isLowCode
    ? [welcomeTab, setupTab, employeeTab]
    : [welcomeTab, setupTab, employeeTab, handoffTab];

  return <CanvasTabs tabs={tabs} />;
}

function EmployeePageMock({ step, productName }: { step: number; productName: string }) {
  return (
    <div className="mx-auto w-full max-w-[280px]">
      <div className="rounded-[2rem] border-4 border-ink bg-ink p-2 shadow-xl">
        <div className="overflow-hidden rounded-[1.4rem] bg-ink-soft">
          <div className="bg-ink-soft px-4 py-2 text-center text-[10px] text-stone">
            {productName} · 应用入口
          </div>

          <div className="relative min-h-[340px] p-4">
            {step === 1 && (
              <div className="absolute inset-x-4 top-3 rounded-lg border-2 border-dashed border-brass bg-ink-softer/90 px-3 py-2 text-center text-xs font-medium text-cinnabar-tint">
                👆 从群公告点这里进入
              </div>
            )}

            <div className="mt-10 space-y-3">
              <div className="text-base font-semibold text-paper">功能页面</div>
              {["字段 A", "字段 B", "字段 C", "字段 D"].map((label, i) => (
                <div
                  key={label}
                  className={[
                    "relative rounded-lg border px-3 py-2",
                    step === 2 && i < 2
                      ? "border-brass bg-ink-softer ring-2 ring-cinnabar/20"
                      : "border-hairline bg-ink-softer",
                  ].join(" ")}
                >
                  <div className="text-[10px] text-stone">{label}</div>
                  <div className="h-4 text-xs text-stone">待填写</div>
                  {step === 2 && i === 0 && (
                    <div className="absolute -right-1 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-cinnabar text-[10px] font-bold text-paper">
                      2
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              className={[
                "mt-4 w-full rounded-xl py-2.5 text-sm font-medium text-paper",
                step === 3 ? "bg-pine/200 ring-4 ring-emerald-200" : "bg-cinnabar",
              ].join(" ")}
            >
              {step === 3 ? "✓ 提交成功" : "提交"}
            </button>

            {step === 3 && (
              <div className="mt-3 rounded-lg bg-pine/20 px-3 py-2 text-center text-xs text-pine-tint">
                已提交，数据可在后台查看
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-stone">员工手机打开网页后的引导预览</p>
    </div>
  );
}
