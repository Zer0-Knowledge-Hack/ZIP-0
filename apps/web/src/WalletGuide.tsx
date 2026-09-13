import { Smartphone, Wallet } from "lucide-react";
import type { es } from "./i18n/es";
import {
  METAMASK_DOWNLOAD,
  getProvider,
  isLocalPreview,
  isMobileDevice,
  metamaskDappLink,
  trustDappLink,
} from "./wallet";

type Copy = typeof es;

export function WalletGuide({
  t,
  open,
  connecting,
  onClose,
  onConnect,
}: {
  t: Copy;
  open: boolean;
  connecting: boolean;
  onClose: () => void;
  onConnect: () => void;
}) {
  if (!open) return null;

  const injected = Boolean(getProvider());
  const mobile = isMobileDevice();
  const local = isLocalPreview();

  return (
    <div className="sheet-root">
      <button type="button" className="sheet-backdrop" aria-label={t.closeSheet} onClick={onClose} />
      <div className="sheet sheet--wallet" role="dialog" aria-labelledby="wallet-guide-title">
        <header className="sheet-head">
          <strong id="wallet-guide-title">{t.walletGuideTitle}</strong>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t.closeSheet}>
            ×
          </button>
        </header>

        <p className="wallet-guide-lead">{t.walletGuideLead}</p>

        <ol className="wallet-steps">
          <li>
            <span>1</span>
            <div>
              <strong>{t.walletStep1Title}</strong>
              <p>{t.walletStep1Body}</p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <strong>{mobile ? t.walletStep2MobileTitle : t.walletStep2DesktopTitle}</strong>
              <p>{mobile ? t.walletStep2MobileBody : t.walletStep2DesktopBody}</p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>{t.walletStep3Title}</strong>
              <p>{t.walletStep3Body}</p>
            </div>
          </li>
        </ol>

        {mobile && local && <p className="wallet-local-hint">{t.walletLocalHint}</p>}

        <div className="wallet-guide-actions">
          {injected ? (
            <button type="button" className="primary full" disabled={connecting} onClick={onConnect}>
              {connecting ? t.connectingWallet : t.connect}
            </button>
          ) : mobile ? (
            <>
              <a className="primary full" href={metamaskDappLink()}>
                <Smartphone size={18} aria-hidden="true" />
                {t.openInMetamask}
              </a>
              <a className="secondary full" href={trustDappLink()}>
                {t.openInTrust}
              </a>
              <a className="text-button wallet-download" href={METAMASK_DOWNLOAD} target="_blank" rel="noreferrer">
                {t.installMetamask}
              </a>
            </>
          ) : (
            <>
              <a className="primary full" href={METAMASK_DOWNLOAD} target="_blank" rel="noreferrer">
                <Wallet size={18} aria-hidden="true" />
                {t.installMetamask}
              </a>
              <button type="button" className="secondary full" onClick={onConnect}>
                {t.walletRetry}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
