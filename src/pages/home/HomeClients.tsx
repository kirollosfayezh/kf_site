import { useI18n } from "../../lib/i18n";
import { pick, isConcept } from "../../lib/content-helpers";
import h from "../Home.module.css";
import type { ContentItem } from "../../services/api-types";

/**
 * Real clients, by name: the projects the studio delivered (never the concept
 * demos), set as plain wordmarks in a slow strip. No logos we don't own, no
 * invented ones.
 */
export function HomeClients({ projects }: { projects: ContentItem[] | null }) {
  const { t, lang } = useI18n();
  const names = [...new Set((projects ?? []).filter((p) => !isConcept(p.meta)).map((p) => pick(p.title, lang).split(/[:—–|]/)[0].trim()))].filter(Boolean);
  if (names.length < 3) return null;
  const row = [...names, ...names];
  return (
    <section className={h.clients} aria-label={t("Clients")}>
      <p className={h.clientsLabel}>{t("Built for teams in Egypt and the Gulf")}</p>
      <div className={h.clientsStrip}>
        <ul className={h.clientsTrack}>
          {row.map((n, i) => (
            <li key={i} aria-hidden={i >= names.length || undefined}>
              {n}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
