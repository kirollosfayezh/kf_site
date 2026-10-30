import { useI18n } from "../../lib/i18n";
import styles from "./ChatWidget.module.css";

/** The message box once the chat has started. Enter sends; Shift+Enter is a new line. */
export function ChatComposer({
  draft,
  onDraftChange,
  onSend,
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className={styles.comp}>
      <textarea
        rows={1}
        value={draft}
        placeholder={t("Type a message…")}
        onChange={(e) => onDraftChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
      />
      <button className={styles.send} type="button" disabled={!draft.trim()} onClick={onSend} aria-label={t("Send message")}>
        <svg viewBox="0 0 24 24">
          <path d="M22 2L11 13" />
          <path d="M22 2l-7 20-4-9-9-4 20-7z" />
        </svg>
      </button>
    </div>
  );
}
