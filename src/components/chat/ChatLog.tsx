import type { RefObject } from "react";
import { useI18n } from "../../lib/i18n";
import type { ChatMessage } from "../../services/chat";
import { ChatAvatar } from "./ChatAvatar";
import { clock } from "./messages";
import styles from "./ChatWidget.module.css";

const GREETING = "Hi! You're through to KF Tech Solutions. What are you trying to build?";

/** The scrolling conversation: the (presentational) greeting, the thread, and the typing dots. */
export function ChatLog({
  logRef,
  messages,
  resumed,
  agentJoined,
  agentTyping,
}: {
  logRef: RefObject<HTMLDivElement | null>;
  messages: ChatMessage[];
  resumed: boolean;
  agentJoined: boolean;
  agentTyping: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className={styles.log} ref={logRef}>
      {/* The greeting is presentational only — it is never written to the thread. */}
      <div className={`${styles.row} ${styles.rowThem}`}>
        <ChatAvatar kind="bot" size={26} className={styles.rowAvatar} />
        <div className={styles.bub}>{t(GREETING)}</div>
      </div>
      {resumed && <div className={styles.resumed}>{t("Welcome back — here's your previous conversation.")}</div>}
      {messages.map((m) => (
        <div key={m.id} className={`${styles.row} ${m.from === "visitor" ? styles.rowMe : styles.rowThem}`}>
          {m.from !== "visitor" && (
            <ChatAvatar kind={agentJoined ? "agent" : "bot"} size={26} className={styles.rowAvatar} />
          )}
          <div className={styles.bub}>{m.text}</div>
          <span className={styles.ts}>{clock(m.ts)}</span>
        </div>
      ))}
      {agentTyping && (
        <div className={styles.typing}>
          <i />
          <i />
          <i />
        </div>
      )}
    </div>
  );
}
