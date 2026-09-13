import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
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
  Globe2,
  FileText,
  Upload,
  Check,
  Moon,
  Sun,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
import { keccak256, isAddress } from "viem";
import { es } from "./i18n/es";
import { en } from "./i18n/en";
import { amountValue, initialLanguage } from "./model";
import "./style.css";

type Page = "landing" | "overview" | "newPayment" | "activity" | "help";
type Provider = {
  request(args: { method: string }): Promise<unknown>;
  on?: (event: string, callback: (accounts: unknown) => void) => void;
  removeListener?: (
    event: string,
    callback: (accounts: unknown) => void
  ) => void;
};
const VAULT = "0x14e59806054773fc341377aEC472C07e500BCc86";
const EXPLORER = "https://testnet-explorer.hsk.xyz";

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
 * Hero mark.
 *
 * The logo, scaled up and put to work. The zero draws itself, the rail runs through the
 * opening, and value crosses it — so the mark is not decoration beside the message, it is the
 * message: one opening, one direct crossing, nothing in between.
 *
 * Inline SVG with a CSS animation. No library and no video file, so it costs nothing to load
 * and stays sharp at any size. It settles into the static logo when the animation ends, and
 * renders as the plain logo when reduced motion is requested.
 */
function HeroMark() {
  return (
    <svg
      className="hero-mark"
      viewBox="0 0 240 120"
      role="img"
      aria-label="ZIP-0: a direct crossing with nothing in between"
    >
      <line className="hero-mark-rail" x1="12" y1="60" x2="228" y2="60" />
      <g className="hero-mark-zero">
        <path d="M 120 22 A 38 38 0 0 1 155.6 71" />
        <path d="M 120 98 A 38 38 0 0 1 84.4 49" />
      </g>
      <circle className="hero-mark-value" cy="60" r="7" />
    </svg>
  );
}

/**
 * Settlement receipt.
 *
 * Mirrors the structure a block explorer shows for a transaction — same fields, same
 * monospaced treatment — so the artefact reads as a record rather than a marketing card.
 * That is the point: the product's claim is verifiability, and the receipt is what
 * verifiability looks like.
 *
 * Marked as a sample. The data is illustrative and the label says so, because a receipt that
 * looks real while being invented is the same failure as a fabricated transaction hash.
 */
function Receipt({ t }: { t: typeof es }) {
  const rows: Array<[string, string, string?]> = [
    [t.receiptFrom, "HashKey Chain", "zip-mono"],
    [t.receiptTo, "Stellar", "zip-mono"],
    [t.receiptRef, "INV-2026-0914", "zip-mono"],
    [t.receiptTime, "4.2 s", "zip-mono"],
  ];

  return (
    <figure className="receipt" aria-label={t.receiptTitle}>
      <div className="receipt-body">
        {/*
          Watermark. The mark sits behind the record the way a security print sits behind a
          banknote — present, not competing. It is the same geometry as the logo, scaled up.
        */}
        <svg className="receipt-watermark" viewBox="0 0 64 64" aria-hidden="true">
          <g fill="none" stroke="currentColor" strokeWidth="5">
            <path d="M 32 7 A 25 25 0 0 1 55.4 39.2" />
            <path d="M 32 57 A 25 25 0 0 1 8.6 24.8" />
            <path d="M 2 32 H 62" />
          </g>
        </svg>

        <header className="receipt-head">
          <span className="receipt-brand">
            <Mark />
            ZIP·0
          </span>
          <span className="receipt-sample">{t.receiptSample}</span>
        </header>

        <p className="receipt-label">{t.receiptAmount}</p>
        <p className="receipt-amount">
          250,000.00 <span>USDC</span>
        </p>

        <dl className="receipt-rows">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        <div className="receipt-status">
          <span className="receipt-status-dot" />
          {t.receiptSettled}
        </div>

        <div className="receipt-hash">
          <span>{t.receiptHash}</span>
          <code>0x8f2a…41c7</code>
        </div>
      </div>

      {/* Torn edge. Pure CSS, no image — it is what makes the object read as a receipt. */}
      <div className="receipt-tear" aria-hidden="true" />

      <figcaption className="receipt-foot">{t.receiptFoot}</figcaption>
    </figure>
  );
}

function App() {
  const [language, setLanguage] = useState(initialLanguage);
  const t = language === "es" ? es : en;
  const [page, setPage] = useState<Page>("landing");
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [network, setNetwork] = useState("HSK Testnet");
  const [account, setAccount] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<keyof typeof es | null>(null);
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
   * preference in both directions.
   */
  useEffect(() => {
    window.document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);
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
    setPage(next);
    setMenuOpen(false);
    setError(null);
  };
  const nav = [
    { id: "landing", icon: Globe2 },
    { id: "overview", icon: LayoutDashboard },
    { id: "newPayment", icon: Send },
    { id: "activity", icon: Clock3 },
    { id: "help", icon: CircleHelp },
  ] as const;
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
  return (
    <div className={`app ${dark ? "dark" : ""}`}>
      <div className="main-shell">
        <header className="topbar">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              go("overview");
            }}
          >
            <Mark />
            <b>
              ZIP<span>·0</span>
            </b>
          </a>
          <nav className="desktop-nav" aria-label={t.navigation}>
            {nav
              .filter((item) => item.id !== "help")
              .map(({ id, icon: Icon }) => (
                <button
                  key={id}
                  aria-current={page === id ? "page" : undefined}
                  className={page === id ? "selected" : ""}
                  onClick={() => go(id)}
                >
                  <Icon size={18} />
                  {t[id]}
                </button>
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
              <span>
                {account
                  ? `${account.slice(0, 6)}…${account.slice(-4)}`
                  : t.connect}
              </span>
              {account && <X size={14} />}
            </button>
            <div className="preferences">
              <button
                className="icon-button menu-toggle"
                aria-label={t.menu}
                aria-expanded={menuOpen}
                aria-controls="preferences-panel"
                onClick={() => setMenuOpen(!menuOpen)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setMenuOpen(false);
                }}
              >
                <Menu size={22} />
              </button>
              <div
                id="preferences-panel"
                className={`preferences-panel ${menuOpen ? "is-open" : ""}`}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setMenuOpen(false);
                    e.currentTarget.parentElement
                      ?.querySelector<HTMLButtonElement>(".menu-toggle")
                      ?.focus();
                  }
                }}
              >
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
                <button
                  className="icon-button"
                  aria-label={t.theme}
                  onClick={() => setDark(!dark)}
                >
                  {dark ? <Sun size={18} /> : <Moon size={18} />}
                  <span className="mobile-label">{t.theme}</span>
                </button>
                <button
                  className="icon-button"
                  aria-label={t.help}
                  onClick={() => go("help")}
                >
                  <CircleHelp size={18} />
                  <span className="mobile-label">{t.help}</span>
                </button>
              </div>
            </div>
          </div>
        </header>
        <nav className="mobile-nav" aria-label={t.navigation}>
          {nav
            .filter((item) => item.id !== "help")
            .map(({ id, icon: Icon }) => (
              <button
                key={id}
                aria-current={page === id ? "page" : undefined}
                className={page === id ? "selected" : ""}
                onClick={() => go(id)}
              >
                <Icon size={21} />
                <span>
                  {id === "overview"
                    ? t.home
                    : id === "newPayment"
                    ? t.pay
                    : t.activity}
                </span>
              </button>
            ))}
        </nav>
        <main>
          {page !== "landing" && (
          <div className="page-heading">
            <div>
              <div className="eyebrow">ZIP-0 / {t.business}</div>
              <h1>
                {page === "overview"
                  ? t.greeting
                  : page === "newPayment"
                  ? t.formTitle
                  : page === "activity"
                  ? t.activity
                  : t.helpTitle}
              </h1>
              <p>
                {page === "overview"
                  ? t.subtitle
                  : page === "newPayment"
                  ? t.formBody
                  : page === "activity"
                  ? t.recentBody
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
          )}
          {error && (
            <div className="alert" role="alert">
              {t[error]}
              <button aria-label={t.back} onClick={() => setError(null)}>
                <X size={16} />
              </button>
            </div>
          )}
          {page === "landing" && (
            <div className="landing">
              <section className="landing-hero">
                <div className="landing-hero-copy">
                  <h2>{t.landingTitle}</h2>
                  <p className="landing-lead">{t.landingLead}</p>
                  <div className="landing-actions">
                    <button className="primary" onClick={() => go("overview")}>
                      {t.landingCta}
                      <ArrowRight size={17} />
                    </button>
                  </div>
                </div>
                <Receipt t={t} />
              </section>

              {/*
                No section headings. A landing shows the product and lets the reader draw the
                conclusion; naming the problem is telling rather than showing.
              */}
              <HeroMark />

              <section className="landing-qualities">
                {[
                  [t.q1Title, t.q1Body],
                  [t.q2Title, t.q2Body],
                  [t.q3Title, t.q3Body],
                ].map(([title, body]) => (
                  <article key={title}>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </article>
                ))}
              </section>

              <section className="landing-proof">
                <dl>
                  <div>
                    <dt>{t.landingProofVault}</dt>
                    <dd>
                      <a
                        className="landing-hash"
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
                    <dt>{t.landingProofNetwork}</dt>
                    <dd className="landing-hash">HashKey Chain Testnet</dd>
                  </div>
                </dl>
              </section>

              <aside className="landing-notice">
                <ShieldCheck size={18} />
                <div>
                  <strong>{t.landingPrototype}</strong>
                  <p>{t.landingPrototypeBody}</p>
                </div>
              </aside>
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
                  <button onClick={() => go("newPayment")}>
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
              <section className="stats">
                {[
                  { label: t.available, icon: Wallet, unit: t.currency },
                  { label: t.liquidity, icon: Globe2, unit: t.currency },
                  { label: t.pending, icon: Clock3, unit: "" },
                ].map(({ label, icon: Icon, unit }) => (
                  <article className="stat" key={label}>
                    <div>
                      <span>{label}</span>
                      <Icon size={18} />
                    </div>
                    <strong>
                      — <small>{unit}</small>
                    </strong>
                    <p>{account ? t.noData : t.noWallet}</p>
                  </article>
                ))}
              </section>
              <section className="journey">
                <div>
                  <h2>{t.quick}</h2>
                  <p>{t.quickBody}</p>
                </div>
                <div className="steps">
                  {[1, 2, 3].map((n) => (
                    <div className="step" key={n}>
                      <span>0{n}</span>
                      <div>
                        <strong>{t[`step${n}` as "step1"]}</strong>
                        <p>{t[`step${n}Body` as "step1Body"]}</p>
                      </div>
                    </div>
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
          {page === "activity" && <section className="panel">{empty}</section>}
          {page === "newPayment" && (
            <div className="payment-layout">
              <section className="panel form-panel">
                {!reviewing ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (
                        !amountValue(form.amount) ||
                        !form.recipient.trim() ||
                        !form.reference.trim()
                      ) {
                        setError("invalid");
                        return;
                      }
                      setError(null);
                      setReviewing(true);
                    }}
                  >
                    <div className="form-heading">
                      <span className="form-number">01</span>
                      <h2>{t.step1}</h2>
                      <span className="draft-badge">{t.draft}</span>
                    </div>
                    <label>
                      {t.amount}
                      <div className="amount-input">
                        <input
                          aria-label={t.amount}
                          value={form.amount}
                          onChange={(e) => edit("amount", e.target.value)}
                          inputMode="decimal"
                          placeholder="0.00"
                          required
                        />
                        <span>USDC</span>
                      </div>
                    </label>
                    <label>
                      {t.recipient}
                      <input
                        value={form.recipient}
                        onChange={(e) => edit("recipient", e.target.value)}
                        placeholder={t.recipientPlaceholder}
                        required
                      />
                    </label>
                    <div className="form-row">
                      <label>
                        {t.reference}
                        <input
                          value={form.reference}
                          onChange={(e) => edit("reference", e.target.value)}
                          placeholder={t.referencePlaceholder}
                          maxLength={100}
                          required
                        />
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
                    <span className="draft-badge">{t.draft}</span>
                    <h2>{t.summary}</h2>
                    <div className="review-amount">
                      {form.amount} <small>USDC</small>
                    </div>
                    {[
                      [t.recipient, form.recipient],
                      [t.reference, form.reference],
                      [t.hs, form.hs || "—"],
                    ].map(([label, value]) => (
                      <div className="review-row" key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                    {document && (
                      <details>
                        <summary>{t.tech}</summary>
                        <p>{t.hash}</p>
                        <code>{document.hash}</code>
                      </details>
                    )}
                    <p className="notice">{t.reviewHint}</p>
                    <button
                      className="primary full"
                      onClick={() => setReviewing(false)}
                    >
                      <ArrowLeft size={17} />
                      {t.edit}
                    </button>
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
          <section className="trust">
            <ShieldCheck size={22} />
            <div>
              <strong>{t.trust}</strong>
              <p>{t.trustBody}</p>
            </div>
          </section>
          <footer>
            <span>
              ZIP-0 <span>·</span> {t.footer}
            </span>
            <span className="preview-tag">{t.beta}</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
createRoot(window.document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
