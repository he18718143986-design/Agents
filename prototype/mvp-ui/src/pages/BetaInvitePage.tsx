import { Link } from "react-router-dom";
import { SnailMark } from "../components/SnailMark";
import "./landing.css";
import "./beta.css";

/**
 * 内测邀请页（可直接发链接给客户）。
 * 品牌中文名与 slogan 尚在商标检索中（ADR-008），本页仅用 "Stagent"。
 * 能力描述以当前真实档位（baas-mvp：网页应用 + 真实数据 + 登录）为准，不over-promise。
 */
export function BetaInvitePage() {
  return (
    <div className="landing">
      <header className="nav">
        <div className="nav__inner">
          <Link to="/" className="brand">
            <SnailMark className="snail-mark" />
            <span className="brand__wordmark">Stagent</span>
          </Link>
          <div className="nav__right">
            <Link to="/app?action=new" className="btn btn--primary btn--sm">
              免费开始
            </Link>
          </div>
        </div>
      </header>

      <div className="beta__wrap">
        <section className="beta__hero">
          <span className="eyebrow">内测邀请</span>
          <h1 className="beta__title">
            把你天天头疼的那件事，<br />
            交给 <em>Stagent</em> 做成一个能用的小软件
          </h1>
          <p className="beta__lead">
            不用写代码，也不用找外包。用大白话把需求说清楚，AI 帮你做出一个能登录、能多人用、数据存在云端的管理工具——课时台账、进销存、预约排班、工程进度这类，都可以。每个关键决定都由你拍板。
          </p>
          <div className="beta__ctas">
            <Link to="/app?action=new" className="btn btn--primary">
              免费开始做第一个
            </Link>
            <Link to="/" className="btn btn--ghost">
              先看看是什么
            </Link>
          </div>
        </section>

        <section className="beta__section">
          <h2 className="beta__h2">内测期，你能免费拿到什么</h2>
          <div className="beta__grid">
            <div className="beta__card">
              <h3>免费做、免费用</h3>
              <p>内测期间制作和托管都免费，生成的软件直接上线给你的团队用。</p>
            </div>
            <div className="beta__card">
              <h3>一对一陪跑</h3>
              <p>我们全程协助你把需求说清楚、把软件验收好，遇到问题随时找我们。</p>
            </div>
            <div className="beta__card">
              <h3>你的需求优先做</h3>
              <p>内测用户提的功能和改进，会被优先排进产品里。</p>
            </div>
          </div>
        </section>

        <section className="beta__section">
          <h2 className="beta__h2">现在能做 / 暂时还不能做</h2>
          <p className="beta__note">我们只承诺做得到的，避免你白期待。</p>
          <div className="beta__can">
            <div>
              <ul className="beta__list beta__list--yes">
                <li>网页版管理工具（电脑、手机浏览器都能打开）</li>
                <li>登录注册、多个同事各自的账号</li>
                <li>数据真实保存在云端，换设备、隔天登录都在</li>
                <li>台账表格、汇总统计、超标自动预警、导出 Excel</li>
                <li>做好后有独立网址，发给同事就能用</li>
              </ul>
            </div>
            <div>
              <ul className="beta__list beta__list--no">
                <li>微信小程序、安卓 / 苹果 App（在规划中）</li>
                <li>对接微信支付、短信、钉钉等外部系统（首版以示例演示）</li>
                <li>非常复杂的多级审批 / 自动化流程</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="beta__section">
          <h2 className="beta__h2">怎么开始（三步）</h2>
          <div className="beta__steps">
            <div className="beta__step">
              <div className="beta__step-num" />
              <div className="beta__step-body">
                <h3>说需求</h3>
                <p>点「免费开始」，像聊天一样描述你要解决的问题，AI 会追问、帮你理清。</p>
              </div>
            </div>
            <div className="beta__step">
              <div className="beta__step-num" />
              <div className="beta__step-body">
                <h3>逐段拍板</h3>
                <p>需求、样子、做出来、上线——每一步都停下来给你确认，不满意就说，改到满意。</p>
              </div>
            </div>
            <div className="beta__step">
              <div className="beta__step-num" />
              <div className="beta__step-body">
                <h3>拿去用</h3>
                <p>验收通过后一键上线，拿到网址发给同事，当天就能开始用。</p>
              </div>
            </div>
          </div>
        </section>

        <section className="beta__section">
          <h2 className="beta__h2">需要你配合的两件事</h2>
          <div className="beta__grid">
            <div className="beta__card">
              <h3>把需求讲清楚</h3>
              <p>软件好不好用，一半取决于需求说得清不清楚。AI 会引导你，但你最了解自己的业务。</p>
            </div>
            <div className="beta__card">
              <h3>亲自验收</h3>
              <p>这是内测版，生成质量还在打磨。请按清单实际操作一遍再确认——尤其是和钱、课时相关的数据。</p>
            </div>
          </div>
        </section>

        <section className="beta__contact">
          <h2 className="beta__h2">准备好了？</h2>
          <p className="beta__note">名额有限，我们会一个个陪你做好。</p>
          <div className="beta__ctas">
            <Link to="/app?action=new" className="btn btn--primary">
              免费开始做第一个
            </Link>
          </div>
          <p className="beta__note" style={{ marginTop: 20 }}>
            有问题想先聊聊？请通过邀请你的渠道联系我们。
          </p>
        </section>

        <footer className="beta__foot">
          <span>© 2026 Stagent · </span>
          <Link to="/terms">用户协议</Link>
          <span> · </span>
          <Link to="/privacy">隐私政策</Link>
        </footer>
      </div>
    </div>
  );
}
