import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { SnailIcon, SnailMark } from "../components/SnailMark";
import "./landing.css";

const SHOWCASE_WORKS = [
  {
    glyph: "读",
    bg: "linear-gradient(150deg,#2A3A2E,#1E2A22)",
    name: "读墨",
    desc: "按标签整理读书笔记，搜索比脑子快。",
  },
  {
    glyph: "摊",
    bg: "linear-gradient(150deg,#3A2A22,#241C16)",
    name: "摊主日记",
    desc: "摆摊小贩的一本进销记账本。",
  },
  {
    glyph: "晚",
    bg: "linear-gradient(150deg,#2A2F3A,#1C1F26)",
    name: "晚风",
    desc: "记录猫主子每天的喂养和体重。",
  },
  {
    glyph: "拼",
    bg: "linear-gradient(150deg,#3A2A30,#241620)",
    name: "拼班",
    desc: "小型培训班的排课和签到小助手。",
  },
];

export function LandingPage() {
  const [navOpen, setNavOpen] = useState(false);
  const [pathLeg, setPathLeg] = useState<0 | 1 | 2>(0);
  const [markerAt, setMarkerAt] = useState<"start" | "gate" | "end">("start");
  const [gateStamped, setGateStamped] = useState(false);
  const [decision, setDecision] = useState<string | null>(null);
  const landingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = landingRef.current;
    if (!root) return;

    const revealEls = root.querySelectorAll(".reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 },
    );
    revealEls.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setPathLeg(2);
      setMarkerAt("end");
      setGateStamped(true);
      return;
    }

    const t1 = window.setTimeout(() => {
      setPathLeg(1);
      setMarkerAt("gate");
    }, 500);
    const t2 = window.setTimeout(() => setGateStamped(true), 1300);
    const t3 = window.setTimeout(() => {
      setPathLeg(2);
      setMarkerAt("end");
    }, 1900);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, []);

  const pathClass = pathLeg === 2 ? "leg-2" : pathLeg === 1 ? "leg-1" : "";
  const markerClass =
    markerAt === "end" ? "to-end" : markerAt === "gate" ? "to-gate" : "";

  return (
    <div className="landing" ref={landingRef}>
      <header className="nav">
        <div className="nav__inner">
          <Link to="/" className="brand">
            <SnailMark className="snail-mark" />
            <span className="brand__wordmark">Stagent</span>
          </Link>
          <nav className={`nav__links${navOpen ? " is-open" : ""}`}>
            <a href="#howto" onClick={() => setNavOpen(false)}>
              怎么用
            </a>
            <a href="#showcase" onClick={() => setNavOpen(false)}>
              作品广场
            </a>
            <a href="#pricing" onClick={() => setNavOpen(false)}>
              价格
            </a>
          </nav>
          <div className="nav__right">
            <Link to="/app?action=new" className="btn btn--primary btn--sm">
              免费开始
            </Link>
            <button
              type="button"
              className="nav__toggle"
              aria-label="展开菜单"
              aria-expanded={navOpen}
              onClick={() => setNavOpen((open) => !open)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="hero__inner">
          <span className="hero__kicker">不写代码，也能把想法做成真东西</span>
          <h1 className="hero__title">
            你决定，<em>Stagent</em> 来搭。
          </h1>
          <p className="hero__sub">
            不用写一行代码，把想法说出来就行。AI 会动手去做；遇到真正需要拿主意的地方，它会停下来，用大白话问你——你点头，它才接着往下走。首版交付可试用、可分享的演示应用；需要真实数据库或登录的版本正在 roadmap。
          </p>
          <div className="hero__ctas">
            <Link to="/app?action=new" className="btn btn--primary">
              免费开始我的第一个想法
            </Link>
            <a href="#showcase" className="btn btn--ghost">
              看看广场里的作品
            </a>
          </div>

          <div className={`hero__path ${pathClass}`}>
            <div className="path-track">
              <div className={`path-marker ${markerClass}`} />
            </div>
            <div className="path-nodes">
              <div className="path-node path-node--start">
                <div className="node-dot" />
                <div className="node-label">想法</div>
              </div>
              <div className="path-node path-node--gate">
                <SnailMark
                  className={`node-snail${gateStamped ? " stamp-in" : ""}`}
                />
                <div className="node-label">你决定</div>
              </div>
              <div className="path-node path-node--end">
                <div className="node-dot" />
                <div className="node-label">发布</div>
              </div>
            </div>
          </div>
          <p className="hero__path-caption">
            You decide at every gate — Stagent handles the rest
          </p>
        </div>
      </section>

      <section id="positioning">
        <div className="section__head reveal">
          <span className="eyebrow">为什么不太一样</span>
          <h2 className="section__title">
            别的工具一句话吐出一整个 App——你看不懂，也不敢真用。
          </h2>
          <p className="section__sub">
            Stagent 把同一件事拆成看得见的几步。客观的活儿，AI 包了；主观的决定，永远留给你。
          </p>
        </div>
        <div className="contrast__grid">
          <div className="contrast-card reveal">
            <span className="contrast-label">常见的 AI 建站工具</span>
            <div className="blackbox-line" />
            <div className="blackbox-tags">
              <span>想法</span>
              <span>成果</span>
            </div>
            <p className="contrast-caption">
              全自动一把梭。改不动、看不懂，出了问题也不知道是哪一步出的错。
            </p>
          </div>
          <div className="contrast-card contrast-card--gate reveal reveal-d2">
            <span className="contrast-label">Stagent 的做法</span>
            <div className="gateline">
              <div className="gdot" />
              <div className="seg" />
              <div className="gdot" />
              <div className="seg" />
              <div className="gdot" />
              <div className="seg" />
              <div className="gdot" />
            </div>
            <div className="gate-tags">
              <span>想法</span>
              <span>发布</span>
            </div>
            <p className="contrast-caption">
              每一步都有据可查。AI 做执行，你在关键节点确认——看得懂、改得了，出问题能定位到哪一步。
            </p>
          </div>
        </div>
      </section>

      <section className="pillars">
        <div className="pillars__grid">
          {[
            ["01", "阶段门哲学", "主观的决定永远是你的，客观的执行交给 AI。每一步都用大白话讲清楚在做什么、为什么——不是技术黑话。"],
            ["02", "双轨部署", "想立刻用，云端直接开始；在意数据归属，整套系统也能部署在你自己的环境里。"],
            ["03", "全生命周期", "不只是吐代码。从验收、发布，到后续怎么改、怎么长，AI 一路跟着，不是做完一次就撒手。"],
            ["04", "开放生态", "核心代码开源（MIT），你可以换成自己喜欢的模型，接自己的 Agent，不被锁死在一家。"],
          ].map(([num, title, body], index) => (
            <div
              key={num}
              className={`pillar reveal${index > 0 ? ` reveal-d${index}` : ""}`}
            >
              <span className="pillar__num">{num}</span>
              <h3 className="pillar__title">{title}</h3>
              <p className="pillar__body">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="howto" id="howto">
        <div className="container">
          <div className="section__head reveal">
            <span className="eyebrow">怎么用</span>
            <h2 className="section__title">从一句话，到一个能用、能分享的东西</h2>
          </div>
          <div className="howto__steps">
            <div className="step reveal">
              <div className="step__num">01</div>
              <div>
                <h3 className="step__title">说出你的想法</h3>
                <p className="step__body">
                  不用懂任何技术名词，就像跟朋友描述一样。比如：「我想要一个能记读书笔记、还能按标签搜索的小工具。」
                </p>
              </div>
            </div>
            <div className="step reveal">
              <div className="step__num">02</div>
              <div>
                <h3 className="step__title">AI 动手起草</h3>
                <p className="step__body">
                  能确定的部分，AI 先做出来——页面长什么样、交互怎么走、模块怎么排，这些不用你操心。
                </p>
              </div>
            </div>
            <div className="step reveal">
              <div className="step__num">03</div>
              <div style={{ flex: 1 }}>
                <h3 className="step__title">真正该你拿主意的地方，它会停下来问</h3>
                <p className="step__body">比如下面这种问题——点一下试试：</p>
                <div className={`decision-card${decision ? " is-decided" : ""}`}>
                  <p className="decision-q">「笔记要不要支持多人协作？」</p>
                  <div className="decision-btns">
                    {["要", "暂时不用"].map((choice) => (
                      <button
                        key={choice}
                        type="button"
                        className={`decision-btn${decision === choice ? " is-chosen" : ""}`}
                        onClick={() => !decision && setDecision(choice)}
                      >
                        {choice}
                      </button>
                    ))}
                  </div>
                  <div className="decision-status-row">
                    <SnailMark
                      className={`decision-snail${decision ? " stamp-in" : ""}`}
                    />
                    <span
                      className={`decision-status${decision ? " is-confirmed" : ""}`}
                    >
                      {decision
                        ? "已确认 ✓ Stagent 继续往下做"
                        : "这个决定会影响后面怎么搭——你来定。"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="step reveal">
              <div className="step__num">04</div>
              <div>
                <h3 className="step__title">发布，拿到一个能分享的链接</h3>
                <p className="step__body">
                  不用自己折腾部署、配置服务器。点一下发布，立刻有个网址，发给任何人，打开就能用。
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="showcase">
        <div className="section__head reveal">
          <span className="eyebrow">广场里在发生什么</span>
          <h2 className="section__title">每天都有新想法，在这里变成真东西</h2>
          <p className="section__sub">
            公开发布的作品会出现在广场里——被更多人看到、用到。做得好的，甚至有人想接手买走。
          </p>
        </div>
        <div className="showcase__grid">
          {SHOWCASE_WORKS.map((work, index) => (
            <div
              key={work.name}
              className={`work-card reveal${index > 0 ? ` reveal-d${index}` : ""}`}
            >
              <div className="work-card__thumb" style={{ background: work.bg }}>
                {work.glyph}
              </div>
              <h4 className="work-card__name">{work.name}</h4>
              <p className="work-card__desc">{work.desc}</p>
              <span className="work-card__badge">
                <SnailIcon />
                Built with Stagent
              </span>
            </div>
          ))}
        </div>
        <div className="showcase__more reveal">
          <Link to="/app" className="btn btn--ghost">
            进入应用，浏览更多示例 →
          </Link>
        </div>
      </section>

      <section id="pricing">
        <div className="section__head reveal">
          <span className="eyebrow">免费开始，按你的节奏往上走</span>
          <h2 className="section__title">做东西这件事，不该是你担心成本的事</h2>
        </div>
        <div className="pricing__grid">
          <div className="tier-card reveal">
            <h3 className="tier-name">免费创作</h3>
            <p className="tier-desc">
              零成本起步。每天有免费额度，够你完整体验一次从想法到发布。
            </p>
            <ul className="tier-list">
              <li>
                <SnailIcon />
                每日免费创作额度
              </li>
              <li>
                <SnailIcon />
                额度用完可填自己的模型 Key，继续免费用
              </li>
              <li>
                <SnailIcon />
                作品可发布到广场
              </li>
            </ul>
            <Link to="/app?action=new" className="btn btn--primary btn--block">
              免费开始
            </Link>
          </div>
          <div className="tier-card tier-card--featured reveal reveal-d1">
            <h3 className="tier-name">Pro</h3>
            <p className="tier-desc">
              认真做东西的人可以往上升：更多额度、自定义域名、去广告、私有作品不公开发布。
            </p>
            <ul className="tier-list">
              <li>
                <SnailIcon />
                更高创作额度
              </li>
              <li>
                <SnailIcon />
                自定义域名 · 去广告
              </li>
              <li>
                <SnailIcon />
                作品可设为私有
              </li>
            </ul>
            <span className="btn btn--ghost btn--block">提前登记</span>
          </div>
          <div className="tier-card reveal reveal-d2">
            <h3 className="tier-name">团队 / 自托管</h3>
            <p className="tier-desc">
              对数据敏感的团队，可以把整套系统部署在自己的环境里——代码、数据，始终在自己手上。
            </p>
            <ul className="tier-list">
              <li>
                <SnailIcon />
                私有化部署
              </li>
              <li>
                <SnailIcon />
                支持与 SLA
              </li>
              <li>
                <SnailIcon />
                数据不出自己的环境
              </li>
            </ul>
            <span className="btn btn--ghost btn--block">联系我们</span>
          </div>
        </div>
        <p className="pricing__note reveal">
          Stagent 对创作免费；广场的曝光、Pro 升级和团队版本，撑起整个系统的运转——这样你做东西的成本，不需要是你要操心的事。
        </p>
      </section>

      <section className="final-cta">
        <h2 className="final-cta__title reveal">
          你的下一个想法，
          <br />
          现在就能开始。
        </h2>
        <p className="final-cta__sub reveal reveal-d1">
          不用准备什么，想到什么，说出来就行。
        </p>
        <Link to="/app?action=new" className="btn btn--primary reveal reveal-d2">
          免费开始
        </Link>
      </section>

      <footer className="footer">
        <div className="footer__inner">
          <div className="footer__top">
            <div className="footer__brand">
              <Link to="/" className="brand">
                <SnailMark className="snail-mark" />
                <span className="brand__wordmark">Stagent</span>
              </Link>
              <p className="footer__tagline">
                You decide, Stagent delivers. 核心代码基于 MIT 协议开源。
              </p>
            </div>
            <div className="footer__cols">
              <div className="footer__col">
                <div className="footer__col-title">产品</div>
                <a href="#howto">怎么用</a>
                <a href="#showcase">作品广场</a>
                <a href="#pricing">价格</a>
              </div>
              <div className="footer__col">
                <div className="footer__col-title">资源</div>
                <a href="https://github.com/TinaHe1995/Agent" target="_blank" rel="noreferrer">
                  开源仓库
                </a>
                <Link to="/app">进入应用</Link>
              </div>
            </div>
          </div>
          <div className="footer__bottom">
            <span>© 2026 Stagent</span>
            <span>stagent.ai</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
