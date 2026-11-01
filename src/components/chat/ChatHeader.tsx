import { useI18n } from "../../lib/i18n";
import { ChatAvatar } from "./ChatAvatar";
import styles from "./ChatWidget.module.css";

/** The panel's title bar: who the visitor is talking to, and the minimise button. */
export function ChatHeader({ agentJoined, onMinimise }: { agentJoined: boolean; onMinimise: () => void }) {
  const { t } = useI18n();
  return (
    <header className={styles.hd}>
      <ChatAvatar kind={agentJoined ? "agent" : "bot"} size={40} className={styles.hdAvatar} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2>{agentJoined ? "KF Tech Solutions" : t("KF Assistant")}</h2>
        <div className={styles.st}>
          <span className={styles.live} />{" "}
          {agentJoined ? t("A person is with you now") : t("Usually replies within minutes")}
        </div>
      </div>
      {/* Minimise, not close: the conversation stays exactly where it was
          and the launcher keeps the unread badge. */}
      <button className={styles.x} aria-label={t("Minimise chat")} onClick={onMinimise}>
        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="2.2" strokeLinecap="round">
          <path d="M6 14l6 6 6-6" />
        </svg>
      </button>
    </header>
  );
}
