import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Link,
  NavLink,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  LayoutDashboard,
  Send,
  Clock3,
  CircleHelp,
  Wallet,
  ShieldCheck,
  FileText,
  Globe2,
  Upload,
  Check,
  Moon,
  Sun,
  User,
  X,
  ChevronDown,
} from "lucide-react";
import { keccak256, isAddress } from "viem";
import { es } from "./i18n/es";
import { en } from "./i18n/en";
import { amountValue, initialLanguage, initialThemeDark, isStellarAddress } from "./model";
import { PATHS, isKnownPath, pageFromPath, pathForPage, type AppPage } from "./routes";
import "./style.css";

type Page = AppPage;
type Provider = {
  request(args: { method: string }): Promise<unknown>;
  on?: (event: string, callback: (accounts: unknown) => void) => void;
  removeListener?: (
    event: string,
    callback: (accounts: unknown) => void
  ) => void;
};
/*
 * Deployment references. Deliberately not surfaced in the landing or the four main tabs:
 * an institution evaluating the product does not need a contract address to decide, and the
 * chain detail belongs with the disclosures. These are consumed by the legal section (#48).
 *
 * Verified source: hardhat verify against the post-redirect Blockscout host (see
 * docs/hsk-chain-integration.md). The legacy #3 vault predates acknowledgePayment and
 * claimRefund, so it must not be referenced here.
 */
export const VAULT = "0x3028a9AfCD5E2c3C2E1fD35d984Be65640ca4e07";
export const EXPLORER = "https://testnet-explorer.hsk.xyz";

const provider = () => (window as Window & { ethereum?: Provider }).ethereum;

/**
 * The ZIP-0 mark: a zero crossed by a settlement rail.
 *
 * Drawn inline and geometric rather than loaded as a font glyph, so it renders identically
 * without webfonts and inherits currentColor on any surface. See docs/brand.md.
 */
function Mark() {
  return (
    <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="6">
        <path d="M 32 7 A 25 25 0 0 1 55.4 39.2" />
        <path d="M 32 57 A 25 25 0 0 1 8.6 24.8" />
        <path d="M 2 32 H 62" />
      </g>
    </svg>
  );
}


/**
 * Legal disclosure.
 *
 * Deliberately not written as Terms of Service. ZIP-0 is an unlicensed prototype with a trusted
 * operator and unaudited contracts; publishing authoritative-looking terms would misrepresent
 * what it is, with legal exposure attached.
 *
 * What earns institutional credibility is not imitating a bank's paperwork — it is showing that
 * we know precisely which obligations apply and stating honestly which we do not yet meet. The
 * regulatory section is therefore written as "this is what would be required", not as a claim.
 *
 * This is also where the chain detail lives. An institution evaluating the product does not need
 * a contract address to decide, but a counsel reading carefully should be able to find it.
 */
function LegalPage({ t }: { t: typeof es }) {
  const regulatory: Array<[string, string]> = [
    [t.legalReg1, t.legalReg1Body],
    [t.legalReg2, t.legalReg2Body],
    [t.legalReg3, t.legalReg3Body],
    [t.legalReg4, t.legalReg4Body],
    [t.legalReg5, t.legalReg5Body],
  ];

  const risks: Array<[string, string]> = [
    [t.legalRisk1, t.legalRisk1Body],
    [t.legalRisk2, t.legalRisk2Body],
    [t.legalRisk3, t.legalRisk3Body],
    [t.legalRisk4, t.legalRisk4Body],
    [t.legalRisk5, t.legalRisk5Body],
  ];

  return (
    <div className="legal">
      <nav className="legal-index" aria-label={t.legalTitle}>
        <h3>{t.legalTitle}</h3>
        <ol>
          <li><a href="#legal-status">{t.legalStatusTitle}</a></li>
          <li><a href="#legal-reg">{t.legalRegTitle}</a></li>
          <li><a href="#legal-risk">{t.legalRiskTitle}</a></li>
          <li><a href="#legal-privacy">{t.legalPrivacyTitle}</a></li>
          <li><a href="#legal-ref">{t.legalRefTitle}</a></li>
        </ol>
      </nav>

      <header className="legal-head">
        <h2>{t.legalTitle}</h2>
        <p className="legal-updated">{t.legalUpdated}</p>
        <p className="legal-intro">{t.legalIntro}</p>
      </header>

      <div className="legal-body">
      {/* Status first. Everything below is read differently once this is known. */}
      <section id="legal-status" className="legal-status">
        <ShieldCheck size={20} aria-hidden="true" />
        <div>
          <h3>{t.legalStatusTitle}</h3>
          <p>{t.legalStatusBody}</p>
          <p className="legal-status-warn">{t.legalStatusWarn}</p>
        </div>
      </section>

      <section id="legal-reg" className="legal-section">
        <h3>{t.legalRegTitle}</h3>
        <p className="legal-lead">{t.legalRegIntro}</p>
        <dl className="legal-list">
          {regulatory.map(([term, body]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="legal-risk" className="legal-section">
        <h3>{t.legalRiskTitle}</h3>
        <p className="legal-lead">{t.legalRiskIntro}</p>
        <dl className="legal-list">
          {risks.map(([term, body]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{body}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/*
        Verified against the code rather than written from assumption: localStorage holds only
        zip0-language and zip0-theme, and there is no analytics, telemetry or cookie anywhere.
      */}
      <section id="legal-privacy" className="legal-section">
        <h3>{t.legalPrivacyTitle}</h3>
        <p className="legal-lead">{t.legalPrivacyBody}</p>
        <ul className="legal-bullets">
          <li>{t.legalPrivacy1}</li>
          <li>{t.legalPrivacy2}</li>
        </ul>
        <p className="legal-lead">{t.legalPrivacyWallet}</p>
      </section>

      <section id="legal-ref" className="legal-section">
        <h3>{t.legalRefTitle}</h3>
        <p className="legal-lead">{t.legalRefBody}</p>
        <dl className="legal-ref">
          <div>
            <dt>{t.legalRefVault}</dt>
            <dd>
              <a
                className="legal-hash"
                href={`${EXPLORER}/address/${VAULT}`}
                target="_blank"
                rel="noreferrer"
              >
                {VAULT}
                <ArrowUpRight size={14} />
              </a>
            </dd>
          </div>
          <div>
            <dt>{t.legalRefNetwork}</dt>
            <dd className="legal-hash">HashKey Chain Testnet · 133</dd>
          </div>
        </dl>
      </section>

      <p className="legal-footer">{t.legalFooter}</p>
      </div>
    </div>
  );
}

/**
 * Route comparison.
 *
 * The result, shown rather than described. Two lanes between the same two points: one hops
 * through a chain of correspondent banks, the other goes straight through the mark's aperture.
 * The difference is visible before anything is read — only the two durations are words.
 *
 * This replaced a written list of steps. Text explaining a difference is weaker than a picture
 * of it.
 */
function RouteCompare({ t }: { t: typeof es }) {
  return (
    <figure className="cmp" aria-labelledby="cmp-caption">
      <div className="cmp-head">
        <span>{t.cmpSent}</span>
        <span>{t.cmpArrived}</span>
      </div>

      <div className="cmp-lane cmp-lane--old">
        <span className="cmp-label">{t.cmpOld}</span>
        <svg viewBox="0 0 260 34" aria-hidden="true">
          <line x1="8" y1="17" x2="252" y2="17" className="cmp-track" />
          {[8, 69, 130, 191, 252].map((x) => (
            <circle key={x} cx={x} cy="17" r="5" className="cmp-hop" />
          ))}
        </svg>
        <div className="cmp-figures">
          <span className="cmp-amount">18,400</span>
          {/* The amount shrinks at each hop. This is the pain, drawn. */}
          <span className="cmp-amount cmp-amount--short">18,127</span>
        </div>
      </div>

      <div className="cmp-lane cmp-lane--new">
        <span className="cmp-label">{t.cmpNew}</span>
        <svg viewBox="0 0 260 34" aria-hidden="true">
          <line x1="8" y1="17" x2="252" y2="17" className="cmp-track cmp-track--direct" />
          <circle cx="8" cy="17" r="5" className="cmp-hop cmp-hop--end" />
          <circle cx="252" cy="17" r="5" className="cmp-hop cmp-hop--end" />
          {/* the aperture at the midpoint, and value passing through it */}
          <g className="cmp-aperture">
            <path d="M130 5 A 12 12 0 0 1 141.4 20.6" />
            <path d="M130 29 A 12 12 0 0 1 118.6 13.4" />
          </g>
          <circle cy="17" r="4" className="cmp-value" />
        </svg>
        <div className="cmp-figures">
          <span className="cmp-amount">18,400</span>
          <span className="cmp-amount cmp-amount--whole">18,400</span>
        </div>
      </div>

      <figcaption id="cmp-caption" className="sr-only">
        {t.cmpCaption}
      </figcaption>
    </figure>
  );
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const page = pageFromPath(location.pathname);
  const [language, setLanguage] = useState(initialLanguage);
  const t = language === "es" ? es : en;
  const [dark, setDark] = useState(initialThemeDark);
  const [network, setNetwork] = useState("HSK Testnet");
  const [account, setAccount] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<keyof typeof es | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    amount?: boolean;
    recipient?: boolean;
    reference?: boolean;
  }>({});
  const [reviewing, setReviewing] = useState(false);
  const [form, setForm] = useState({
    amount: "",
    recipient: "",
    reference: "",
    hs: "",
  });
  const [document, setDocument] = useState<{
    name: string;
    hash: string;
  } | null>(null);
  const uploadVersion = useRef(0);
  useEffect(() => {
    window.document.documentElement.lang = language;
    try {
      localStorage.setItem("zip0-language", language);
    } catch {
      /* Storage may be disabled. */
    }
  }, [language]);
  /*
   * Theme is driven by data-theme on the root element rather than a class, because that is
   * what tokens.css keys off. Setting it here means an explicit choice wins over the OS
   * preference in both directions. The landing stays on paper (light) so the first read is
   * always the institutional surface — dark is for the app after "Abrir la aplicación".
   */
  useEffect(() => {
    const landingPaper = page === "landing";
    window.document.documentElement.dataset.theme =
      landingPaper || !dark ? "light" : "dark";
    if (landingPaper) return;
    try {
      localStorage.setItem("zip0-theme", dark ? "dark" : "light");
    } catch {
      /* Storage may be disabled. */
    }
  }, [dark, page]);
  useEffect(() => {
    if (page !== "newPayment") {
      setReviewing(false);
      setFieldErrors({});
    }
  }, [page]);
  useEffect(() => {
    const wallet = provider();
    const changed = (accounts: unknown) =>
      setAccount(
        Array.isArray(accounts) &&
          typeof accounts[0] === "string" &&
          isAddress(accounts[0])
          ? accounts[0]
          : ""
      );
    wallet?.on?.("accountsChanged", changed);
    return () => wallet?.removeListener?.("accountsChanged", changed);
  }, []);
  async function connect() {
    setError(null);
    if (account) {
      setAccount("");
      return;
    }
    const wallet = provider();
    if (!wallet) {
      setError("walletMissing");
      return;
    }
    setConnecting(true);
    try {
      const accounts = await wallet.request({ method: "eth_requestAccounts" });
      if (!Array.isArray(accounts) || !isAddress(accounts[0]))
        throw new Error();
      setAccount(accounts[0]);
    } catch {
      setError("walletError");
    } finally {
      setConnecting(false);
    }
  }
  const go = (next: Page) => {
    navigate(pathForPage(next));
    setError(null);
  };
  const appNav = [
    { id: "overview" as const, icon: LayoutDashboard },
    { id: "newPayment" as const, icon: Send },
    { id: "activity" as const, icon: Clock3 },
  ];
  const edit = (key: keyof typeof form, value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  const empty = (
    <div className="empty">
      <div className="empty-art">
        <FileText size={30} />
        <span>
          <ArrowUpRight size={15} />
        </span>
      </div>
      <h3>{t.empty}</h3>
      <p>{t.emptyBody}</p>
      <button className="text-button" onClick={() => go("newPayment")}>
        {t.start}
        <ArrowRight size={16} />
      </button>
    </div>
  );

  if (!isKnownPath(location.pathname)) {
    return <Navigate to={PATHS.landing} replace />;
  }

  if (page === "landing") {
    return (
      <div className="app app--landing">
        <a className="skip-link" href="#main">
          {t.skipToContent}
        </a>
        <header className="landing-bar">
          <Link to={PATHS.landing} className="brand">
            <Mark />
            <b>
              ZIP<span>·0</span>
            </b>
          </Link>
          <div className="landing-bar-actions">
            <div className="language" aria-label={t.language}>
              <button
                aria-pressed={language === "es"}
                onClick={() => setLanguage("es")}
              >
                ES
              </button>
              <button
                aria-pressed={language === "en"}
                onClick={() => setLanguage("en")}
              >
                EN
              </button>
            </div>
            <Link to={PATHS.overview} className="primary landing-bar-cta">
              {t.landingCta}
              <ArrowRight size={16} />
            </Link>
          </div>
        </header>
        <main id="main" className="landing-main">
          <div className="landing">
            {/*
              Short landing: promise, one proof drawing, use-case cards, prototype notice.
              This shell is marketing-only — no wallet, no product tabs, no bottom nav.
            */}
            <section className="landing-hero">
              <div className="landing-hero-copy">
                <h1>{t.landingTitle}</h1>
                <p className="landing-lead">{t.landingLead}</p>
                <div className="landing-actions">
                  <Link to={PATHS.overview} className="primary">
                    {t.landingCta}
                    <ArrowRight size={17} />
                  </Link>
                </div>
              </div>
              <div className="landing-hero-visual">
                <RouteCompare t={t} />
              </div>
            </section>

            <section className="landing-uses">
              <h2 className="landing-section-title">{t.useTitle}</h2>
              <div className="landing-use-grid">
                {[
                  [t.use1Title, t.use1Body],
                  [t.use2Title, t.use2Body],
                  [t.use3Title, t.use3Body],
                  [t.use4Title, t.use4Body],
                ].map(([title, body]) => (
                  <article key={title} className="landing-use">
                    <span className="landing-use-mark" aria-hidden="true">
                      <Mark />
                    </span>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </article>
                ))}
              </div>
            </section>

            <aside className="landing-notice">
              <ShieldCheck size={18} />
              <div>
                <strong>{t.landingPrototype}</strong>
                <p>{t.landingPrototypeBody}</p>
                {/* The disclosure is reachable from the pitch, not buried in a footer. */}
                <button className="text-button" onClick={() => go("legal")}>
                  {t.landingLegal}
                  <ArrowRight size={15} />
                </button>
              </div>
            </aside>
          </div>
        </main>

        {/*
          Marketing footer. The landing shell had none — every landing has one, and it is the
          conventional place a visitor looks for legal and source links before trusting anything.
        */}
        <footer className="landing-footer">
          <div className="landing-footer-brand">
            <Mark />
            <div>
              <strong>ZIP·0</strong>
              <p>{t.footTagline}</p>
            </div>
          </div>

          <nav className="landing-footer-links" aria-label={t.navigation}>
            <div>
              <h3>{t.footProduct}</h3>
              <Link to={PATHS.overview}>{t.footOpenApp}</Link>
            </div>
            <div>
              <h3>{t.footLegalCol}</h3>
              <Link to={PATHS.legal}>{t.footDisclosure}</Link>
            </div>
            <div>
              <h3>{t.footCompany}</h3>
              <a
                href="https://github.com/Zer0-Knowledge-Hack/ZIP-0"
                target="_blank"
                rel="noreferrer"
              >
                {t.footRepo}
              </a>
            </div>
          </nav>

          <div className="landing-footer-base">
            <span>{t.footRights}</span>
            <span className="landing-footer-status">{t.footStatus}</span>
          </div>
        </footer>

      </div>
    );
  }

  return (
    <div className="app app--product">
      <a className="skip-link" href="#main">
        {t.skipToContent}
      </a>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-brand-group">
            <Link to={PATHS.landing} className="brand" aria-label={t.backToLanding}>
              <Mark />
              <b>
                ZIP<span>·0</span>
              </b>
            </Link>
            <Link to={PATHS.landing} className="back-to-landing">
              <ArrowLeft size={16} />
              {t.home}
            </Link>
          </div>
          <nav className="desktop-nav" aria-label={t.navigation}>
            {appNav.map(({ id, icon: Icon }) => (
              <NavLink
                key={id}
                to={pathForPage(id)}
                end={id === "overview"}
                aria-current={page === id ? "page" : undefined}
                className={({ isActive }) => (isActive ? "selected" : undefined)}
                onClick={() => setError(null)}
              >
                <Icon size={18} />
                {t[id]}
              </NavLink>
            ))}
          </nav>
          <div className="header-actions">
            <button
              className="wallet-button"
              disabled={connecting}
              onClick={connect}
              aria-label={account ? t.disconnect : t.connect}
            >
              <Wallet size={18} />
              <span className="wallet-button-label">
                {account
                  ? `${account.slice(0, 6)}…${account.slice(-4)}`
                  : t.connect}
              </span>
              {account && <X size={14} />}
            </button>
            <NavLink
              to={PATHS.profile}
              className={({ isActive }) =>
                `icon-button profile-entry${isActive ? " is-active" : ""}`
              }
              aria-label={t.profile}
              aria-current={page === "profile" ? "page" : undefined}
              onClick={() => setError(null)}
            >
              <User size={18} />
            </NavLink>
          </div>
        </header>
        <nav className="mobile-nav" aria-label={t.navigation}>
          {appNav.map(({ id, icon: Icon }) => (
            <NavLink
              key={id}
              to={pathForPage(id)}
              end={id === "overview"}
              aria-current={page === id ? "page" : undefined}
              className={({ isActive }) => (isActive ? "selected" : undefined)}
              onClick={() => setError(null)}
            >
              <Icon size={21} />
              <span>
                {id === "overview"
                  ? t.overview
                  : id === "newPayment"
                  ? t.pay
                  : t.activity}
              </span>
            </NavLink>
          ))}
        </nav>
        <main id="main">
          <div
            className={`page-heading${
              page === "profile" ? " page-heading--profile" : ""
            }`}
          >
            <div>
              <div className="eyebrow">ZIP-0 / {t.business}</div>
              <h1>
                {page === "overview"
                  ? t.greeting
                  : page === "newPayment"
                  ? t.formTitle
                  : page === "activity"
                  ? t.activity
                  : page === "profile"
                  ? t.profileTitle
                  : t.helpTitle}
              </h1>
              <p>
                {page === "overview"
                  ? t.subtitle
                  : page === "newPayment"
                  ? t.formBody
                  : page === "activity"
                  ? t.recentBody
                  : page === "profile"
                  ? t.profileBody
                  : t.helpBody}
              </p>
            </div>
            <label className="network">
              <span className="online-dot" />
              <select
                aria-label={t.network}
                value={network}
                onChange={(e) => setNetwork(e.target.value)}
              >
                <option>HSK Testnet</option>
                <option>Avalanche Fuji</option>
                <option>Hardhat local</option>
              </select>
              <ChevronDown size={15} />
            </label>
          </div>
          {error && (
            <div className="alert" role="alert">
              {t[error]}
              <button aria-label={t.back} onClick={() => setError(null)}>
                <X size={16} />
              </button>
            </div>
          )}
          {page === "overview" && (
            <>
              <section className="hero">
                <div className="hero-copy">
                  <span className="hero-label">
                    <span />
                    {t.intro}
                  </span>
                  <h2>{t.hero}</h2>
                  <p>{t.heroBody}</p>
                  <button type="button" onClick={() => go("newPayment")}>
                    {t.start}
                    <ArrowUpRight size={18} />
                  </button>
                </div>
                <figure className="payment-preview" aria-label={t.demoCard}>
                  <div className="payment-preview-float">
                    <div className="payment-preview-card">
                      <div className="payment-preview-top">
                        <strong>ZIP-0</strong>
                        <span>{t.demo}</span>
                      </div>
                      <p className="payment-preview-label">{t.amount}</p>
                      <div className="payment-preview-amount">
                        — <span>USDC</span>
                      </div>
                      <div className="payment-preview-route">
                        <div>
                          <small>{t.source}</small>
                          <strong>{network}</strong>
                        </div>
                        <ArrowRight size={20} aria-hidden="true" />
                        <div>
                          <small>{t.destination}</small>
                          <strong>Stellar</strong>
                        </div>
                      </div>
                      <div className="payment-preview-bottom">
                        <FileText size={16} aria-hidden="true" />
                        <span>{t.draft}</span>
                      </div>
                    </div>
                  </div>
                  <figcaption>{t.demoNote}</figcaption>
                </figure>
              </section>

              <aside className="overview-status" role="status">
                <Wallet size={22} aria-hidden="true" />
                <div>
                  <strong>{account ? t.noData : t.noWallet}</strong>
                  <p>
                    {account
                      ? t.overviewConnectedHint
                      : t.overviewConnectHint}
                  </p>
                </div>
                {!account && (
                  <button
                    type="button"
                    className="primary"
                    disabled={connecting}
                    onClick={connect}
                  >
                    {t.connect}
                  </button>
                )}
              </aside>

              <section className="journey">
                <div>
                  <h2>{t.quick}</h2>
                  <p>{t.quickBody}</p>
                </div>
                <div className="steps">
                  {[1, 2, 3].map((n) => (
                    <button
                      type="button"
                      className="step step-button"
                      key={n}
                      onClick={() => go("newPayment")}
                    >
                      <span>0{n}</span>
                      <div>
                        <strong>{t[`step${n}` as "step1"]}</strong>
                        <p>{t[`step${n}Body` as "step1Body"]}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>{t.recent}</h2>
                    <p>{t.recentBody}</p>
                  </div>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => go("activity")}
                  >
                    {t.viewAll}
                    <ArrowUpRight size={16} />
                  </button>
                </div>
                {empty}
              </section>
            </>
          )}
          {page === "activity" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>{t.activity}</h2>
                  <p>{t.recentBody}</p>
                </div>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => go("newPayment")}
                >
                  {t.start}
                  <ArrowUpRight size={16} />
                </button>
              </div>
              {empty}
            </section>
          )}
          {page === "newPayment" && (
            <div className="payment-layout">
              <section className="panel form-panel">
                {!reviewing ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const nextErrors = {
                        amount: !amountValue(form.amount),
                        recipient: !isStellarAddress(form.recipient),
                        reference: !form.reference.trim(),
                      };
                      setFieldErrors(nextErrors);
                      if (
                        nextErrors.amount ||
                        nextErrors.recipient ||
                        nextErrors.reference
                      ) {
                        setError("invalid");
                        return;
                      }
                      setError(null);
                      setReviewing(true);
                    }}
                    noValidate
                  >
                    <div className="form-steps" aria-hidden="true">
                      <span className="is-active">01 · {t.stepPrepare}</span>
                      <span>02 · {t.stepConfirm}</span>
                    </div>
                    <div className="form-heading">
                      <span className="form-number">01</span>
                      <h2>{t.step1}</h2>
                      <span className="draft-badge">{t.draft}</span>
                    </div>
                    <label className={fieldErrors.amount ? "is-invalid" : undefined}>
                      {t.amount}
                      <div className="amount-input">
                        <input
                          aria-label={t.amount}
                          aria-invalid={fieldErrors.amount || undefined}
                          value={form.amount}
                          onChange={(e) => {
                            edit("amount", e.target.value);
                            setFieldErrors((prev) => ({
                              ...prev,
                              amount: false,
                            }));
                          }}
                          inputMode="decimal"
                          placeholder="0.00"
                          required
                        />
                        <span>USDC</span>
                      </div>
                      {fieldErrors.amount && (
                        <span className="field-error">{t.fieldAmount}</span>
                      )}
                    </label>
                    <label
                      className={
                        fieldErrors.recipient ? "is-invalid" : undefined
                      }
                    >
                      {t.recipient}
                      <input
                        value={form.recipient}
                        aria-invalid={fieldErrors.recipient || undefined}
                        onChange={(e) => {
                          edit("recipient", e.target.value);
                          setFieldErrors((prev) => ({
                            ...prev,
                            recipient: false,
                          }));
                        }}
                        placeholder={t.recipientPlaceholder}
                        required
                        autoComplete="off"
                        spellCheck={false}
                      />
                      {fieldErrors.recipient && (
                        <span className="field-error">{t.fieldRecipient}</span>
                      )}
                    </label>
                    <div className="form-row">
                      <label
                        className={
                          fieldErrors.reference ? "is-invalid" : undefined
                        }
                      >
                        {t.reference}
                        <input
                          value={form.reference}
                          aria-invalid={fieldErrors.reference || undefined}
                          onChange={(e) => {
                            edit("reference", e.target.value);
                            setFieldErrors((prev) => ({
                              ...prev,
                              reference: false,
                            }));
                          }}
                          placeholder={t.referencePlaceholder}
                          maxLength={100}
                          required
                        />
                        {fieldErrors.reference && (
                          <span className="field-error">
                            {t.fieldReference}
                          </span>
                        )}
                      </label>
                      <label>
                        {t.hs} <small>({t.optional})</small>
                        <input
                          value={form.hs}
                          onChange={(e) => edit("hs", e.target.value)}
                          placeholder={t.hsPlaceholder}
                          maxLength={30}
                        />
                      </label>
                    </div>
                    <label>
                      {t.document} <small>({t.optional})</small>
                      <div className="upload">
                        <Upload size={24} />
                        <span>{document?.name || t.upload}</span>
                        <input
                          type="file"
                          accept="application/pdf,.pdf"
                          aria-label={t.upload}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            const version = ++uploadVersion.current;
                            setDocument(null);
                            if (!file) return;
                            if (
                              file.size > 10 * 1024 * 1024 ||
                              !file.name.toLowerCase().endsWith(".pdf")
                            ) {
                              setError("pdfError");
                              return;
                            }
                            try {
                              const bytes = new Uint8Array(
                                await file.arrayBuffer()
                              );
                              if (version !== uploadVersion.current) return;
                              if (
                                new TextDecoder().decode(bytes.slice(0, 5)) !==
                                "%PDF-"
                              ) {
                                setError("pdfError");
                                return;
                              }
                              setDocument({
                                name: file.name,
                                hash: keccak256(bytes),
                              });
                              setError(null);
                            } catch {
                              if (version === uploadVersion.current)
                                setError("pdfError");
                            }
                          }}
                        />
                      </div>
                    </label>
                    {document && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => {
                          uploadVersion.current++;
                          setDocument(null);
                        }}
                      >
                        {t.clear}
                        <X size={14} />
                      </button>
                    )}
                    <p className="form-hint">
                      <ShieldCheck size={15} />
                      {t.documentHint}
                    </p>
                    <button className="primary full" type="submit">
                      {t.review}
                      <ArrowRight size={17} />
                    </button>
                  </form>
                ) : (
                  <div className="review">
                    <div className="form-steps" aria-hidden="true">
                      <span>01 · {t.stepPrepare}</span>
                      <span className="is-active">02 · {t.stepConfirm}</span>
                    </div>
                    <span className="draft-badge">{t.draft}</span>
                    <h2>{t.summary}</h2>
                    <div className="review-amount zip-amount">
                      {form.amount} <small>USDC</small>
                    </div>
                    {[
                      [t.recipient, form.recipient],
                      [t.reference, form.reference],
                      [t.hs, form.hs || "—"],
                      ...(document
                        ? ([[t.documentAttached, document.name]] as const)
                        : []),
                    ].map(([label, value]) => (
                      <div className="review-row" key={label}>
                        <span>{label}</span>
                        <strong className={label === t.recipient ? "zip-hash" : undefined}>
                          {value}
                        </strong>
                      </div>
                    ))}
                    {document && (
                      <details>
                        <summary>{t.tech}</summary>
                        <p>{t.hash}</p>
                        <code className="zip-hash">{document.hash}</code>
                      </details>
                    )}
                    <p className="notice">{t.reviewHint}</p>
                    <div className="review-actions">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setReviewing(false)}
                      >
                        <ArrowLeft size={17} />
                        {t.edit}
                      </button>
                      <button
                        type="button"
                        className="primary"
                        disabled
                        aria-disabled="true"
                        title={t.reviewHint}
                      >
                        {t.sendSoon}
                      </button>
                    </div>
                  </div>
                )}
              </section>
              <aside className="payment-aside">
                <section className="panel route-card">
                  <Globe2 size={28} />
                  <h2>{t.route}</h2>
                  <div>
                    <small>{t.source}</small>
                    <strong>{network}</strong>
                  </div>
                  <span className="route-line" />
                  <div>
                    <small>{t.destination}</small>
                    <strong>Stellar</strong>
                  </div>
                  <span className="currency-pill">USDC → USDC</span>
                </section>
                <p className="notice">{t.previewNote}</p>
              </aside>
            </div>
          )}
          {page === "profile" && (
            <div className="profile profile--bento">
              <section
                className="profile-section profile-section--account"
                aria-labelledby="profile-account"
              >
                <div className="profile-section-head">
                  <Wallet size={20} aria-hidden="true" />
                  <div>
                    <h2 id="profile-account">{t.profileAccount}</h2>
                    <p>{t.profileAccountBody}</p>
                  </div>
                </div>
                <div className="profile-account-row">
                  {account ? (
                    <code className="zip-hash profile-address">{account}</code>
                  ) : (
                    <p className="profile-empty">{t.profileAccountEmpty}</p>
                  )}
                  <button
                    type="button"
                    className={account ? "secondary" : "primary"}
                    disabled={connecting}
                    onClick={connect}
                  >
                    {account ? t.disconnect : t.connect}
                  </button>
                </div>
              </section>

              <section
                className="profile-section profile-section--appearance"
                aria-labelledby="profile-appearance"
              >
                <div className="profile-section-head">
                  {dark ? (
                    <Moon size={20} aria-hidden="true" />
                  ) : (
                    <Sun size={20} aria-hidden="true" />
                  )}
                  <div>
                    <h2 id="profile-appearance">{t.profileAppearance}</h2>
                    <p>{t.profileAppearanceBody}</p>
                  </div>
                </div>
                <div
                  className="theme-switch"
                  role="group"
                  aria-label={t.theme}
                >
                  <button
                    type="button"
                    aria-pressed={!dark}
                    onClick={() => setDark(false)}
                  >
                    <Sun size={18} aria-hidden="true" />
                    {t.themeLight}
                  </button>
                  <button
                    type="button"
                    aria-pressed={dark}
                    onClick={() => setDark(true)}
                  >
                    <Moon size={18} aria-hidden="true" />
                    {t.themeDark}
                  </button>
                </div>
              </section>

              <section
                className="profile-section profile-section--language"
                aria-labelledby="profile-language"
              >
                <div className="profile-section-head">
                  <Globe2 size={20} aria-hidden="true" />
                  <div>
                    <h2 id="profile-language">{t.profileLanguage}</h2>
                    <p>{t.profileLanguageBody}</p>
                  </div>
                </div>
                <div className="language language--profile" aria-label={t.language}>
                  <button
                    type="button"
                    aria-pressed={language === "es"}
                    onClick={() => setLanguage("es")}
                  >
                    ES
                  </button>
                  <button
                    type="button"
                    aria-pressed={language === "en"}
                    onClick={() => setLanguage("en")}
                  >
                    EN
                  </button>
                </div>
              </section>

              <section
                className="profile-section profile-section--help"
                aria-labelledby="profile-help"
              >
                <div className="profile-section-head">
                  <CircleHelp size={20} aria-hidden="true" />
                  <div>
                    <h2 id="profile-help">{t.profileHelp}</h2>
                    <p>{t.profileHelpBody}</p>
                  </div>
                </div>
                <Link to={PATHS.help} className="secondary profile-help-link">
                  {t.profileHelpCta}
                  <ArrowRight size={16} />
                </Link>
              </section>
              {/*
                Legal lives here in the product shell rather than in a footer. Profile is where
                users look for account, terms and privacy — following that convention beats
                inventing a new location.
              */}
              <section className="profile-section" aria-labelledby="profile-legal">
                <div className="profile-section-head">
                  <ShieldCheck size={18} aria-hidden="true" />
                  <h2 id="profile-legal">{t.profileLegalTitle}</h2>
                </div>
                <p>{t.profileLegalBody}</p>
                <button className="text-button" onClick={() => go("legal")}>
                  {t.profileLegalCta}
                  <ArrowRight size={16} />
                </button>
              </section>
            </div>
          )}
          {page === "help" && (
            <section className="panel help-content">
              {[
                { title: t.helpWallet, body: t.helpWalletBody, icon: Wallet },
                { title: t.helpNetwork, body: t.helpNetworkBody, icon: Globe2 },
                {
                  title: t.helpSettlement,
                  body: t.helpSettlementBody,
                  icon: Check,
                },
              ].map(({ title, body, icon: Icon }) => (
                <article key={title}>
                  <Icon size={24} />
                  <div>
                    <h2>{title}</h2>
                    <p>{body}</p>
                  </div>
                </article>
              ))}
            </section>
          )}

          {page === "legal" && <LegalPage t={t} />}
          <section className="trust">
            <ShieldCheck size={22} />
            <div>
              <strong>{t.trust}</strong>
              <p>{t.trustBody}</p>
            </div>
          </section>
          {/*
            Global footer, so the disclosure is reachable from every page rather than only from
            the landing. Someone about to send a payment should not have to go back to the
            marketing shell to find out this is an unlicensed prototype.
          */}
          <footer>
            <span>
              ZIP-0 <span>·</span> {t.footer}
            </span>
            <button className="footer-legal" onClick={() => go("legal")}>
              {t.legal}
            </button>
            <span className="preview-tag">{t.beta}</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
createRoot(window.document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
