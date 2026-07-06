import { Link } from "react-router-dom";
import { SnailMark } from "../components/SnailMark";

/**
 * 用户协议与隐私政策（草稿版）。
 * ⚠️ 上线前须由专业律师审阅定稿；本文为工程草稿，用于备案与内测告知。
 */

const TERMS_SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "一、服务说明",
    body: [
      "本平台（Stagent）为用户提供基于人工智能的软件生成与托管服务：用户通过对话描述需求，平台辅助生成可运行的网页应用并提供托管。",
      "平台按「阶段拍板」方式工作：需求确认、制作验收、上线发布等关键决策均由用户本人确认。用户对其确认的需求内容与验收结果负责。",
    ],
  },
  {
    title: "二、账号与数据",
    body: [
      "注册账号需提供有效邮箱。账号仅限本人使用，请妥善保管密码。",
      "用户在生成应用中录入的业务数据归用户所有，存储于平台服务器并每日备份。用户可随时导出（CSV）；项目删除后数据将在 30 日内清除。",
      "平台不会将用户业务数据用于向第三方提供服务或训练模型。",
    ],
  },
  {
    title: "三、使用规范",
    body: [
      "禁止利用本平台生成、发布违反法律法规的内容或应用，包括但不限于：违法信息传播、侵犯他人知识产权、金融证券自动交易、赌博等。",
      "发布到案例墙的作品须为用户有权公开的内容。平台对公开作品有审核与下架的权利。",
      "禁止以任何方式滥用平台算力资源（含绕过用量限制、恶意批量请求）。",
    ],
  },
  {
    title: "四、AI 生成内容说明",
    body: [
      "平台生成的应用与内容由人工智能辅助产生，并已按规定添加标识。生成内容可能存在错误，重要业务决策请以人工核验为准。",
      "平台使用境内已备案的大模型服务（DeepSeek）。",
    ],
  },
  {
    title: "五、责任限制",
    body: [
      "平台按「现状」提供内测服务，不对生成应用的持续可用性、适销性作担保。因不可抗力或第三方服务（云服务商、模型服务商）中断导致的损失，平台在法律允许范围内免责。",
      "本协议为内测期草稿，正式版本将在公开运营前更新并通知用户。",
    ],
  },
];

const PRIVACY_SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "一、我们收集哪些信息",
    body: [
      "账号信息：注册邮箱、加密存储的密码。",
      "项目数据：你在平台创建的项目需求、对话记录与快照（用于跨设备同步）。",
      "生成应用中的业务数据：由你和你的团队成员录入，存储于该应用独立的数据库实例。",
      "日志信息：为保障服务安全与排查故障记录的访问日志（IP、时间、操作）。",
    ],
  },
  {
    title: "二、我们如何使用信息",
    body: [
      "提供并改进服务（项目同步、应用托管、故障排查）。",
      "向大模型服务商（DeepSeek）发送生成所需的需求描述以完成应用制作；不会发送你生成应用中的业务数据。",
      "不向任何第三方出售个人信息。",
    ],
  },
  {
    title: "三、存储与保护",
    body: [
      "全部数据存储于中国境内服务器，每日自动备份。",
      "传输采用 HTTPS 加密；密码经不可逆加密存储。",
      "内测期间平台访问受访问口令保护。",
    ],
  },
  {
    title: "四、你的权利",
    body: [
      "你可以随时导出业务数据（CSV）、删除项目，或联系我们注销账号并清除全部相关数据。",
      "如需行使上述权利或有隐私相关疑问，请通过页脚联系方式与我们联系。",
    ],
  },
  {
    title: "五、政策更新",
    body: [
      "本政策为内测期草稿，正式运营前将由专业律师审阅并更新，重大变更会以站内通知方式告知。",
    ],
  },
];

function LegalLayout({
  title,
  updated,
  sections,
}: {
  title: string;
  updated: string;
  sections: { title: string; body: string[] }[];
}) {
  return (
    <div className="stagent-shell min-h-screen">
      <header className="stagent-nav">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <SnailMark className="app-snail-mark" />
            <span className="stagent-title text-lg">Stagent</span>
          </Link>
          <Link to="/app" className="stagent-btn stagent-btn--ghost stagent-btn--sm">
            进入应用
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="stagent-title text-2xl">{title}</h1>
        <p className="mt-2 text-xs text-stone">
          更新日期：{updated} ｜ ⚠️ 内测期草稿，正式版将经法律审阅后发布
        </p>
        <div className="mt-8 space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="mb-3 text-base font-semibold text-paper">{section.title}</h2>
              <div className="space-y-2">
                {section.body.map((paragraph, index) => (
                  <p key={index} className="text-sm leading-7 text-paper-dim">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className="mt-12 border-t border-hairline pt-6 text-sm text-stone">
          <Link to="/terms" className="text-cinnabar-tint hover:underline">
            用户协议
          </Link>
          <span className="mx-2">·</span>
          <Link to="/privacy" className="text-cinnabar-tint hover:underline">
            隐私政策
          </Link>
          <span className="mx-2">·</span>
          <Link to="/" className="hover:text-paper">
            返回首页
          </Link>
        </div>
      </main>
    </div>
  );
}

export function TermsPage() {
  return (
    <LegalLayout title="用户协议" updated="2026-07-05" sections={TERMS_SECTIONS} />
  );
}

export function PrivacyPage() {
  return (
    <LegalLayout title="隐私政策" updated="2026-07-05" sections={PRIVACY_SECTIONS} />
  );
}
