import { useI18n } from "../../lib/i18n";
import { Reveal } from "../../components/Reveal";
import s from "../../styles/sections.module.css";
import h from "../Home.module.css";
import { INCLUDED } from "./data";

/** 24px stroke icons, drawn in currentColor so they follow the theme. */
const ICONS: Record<(typeof INCLUDED)[number]["icon"], string> = {
  dashboard: "M3 3h8v10H3zM13 3h8v6h-8zM13 11h8v10h-8zM3 15h8v6H3z",
  language: "M4 5h8M8 3v2m3 0c-1 5-4 9-7 11m3-6c1.5 2 3.5 3.5 6 4.5M13 21l4-10 4 10m-1.5-3.5h-5",
  devices: "M2 5h14v10H2zM6 19h6M9 15v4M18 9h4v12h-4z",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.5-4.5",
  shield: "M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6zM9 12l2 2 4-4",
  key: "M2.6 17.4A2 2 0 0 0 2 18.8V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.2a2 2 0 0 0 1.4-.6l.8-.8a6.5 6.5 0 1 0-4-4zM16.5 7.5h.01",
  training: "M3 8l9-4 9 4-9 4zM7 10v5c0 1.5 2.2 3 5 3s5-1.5 5-3v-5M21 8v6",
  support: "M4 13v-1a8 8 0 0 1 16 0v1M4 13h3v6H5a1 1 0 0 1-1-1zM20 13h-3v6h2a1 1 0 0 0 1-1zM17 19c0 1.5-2 2-5 2",
};

/**
 * Everything a client gets with a build, listed plainly: the questions that
 * otherwise come up one at a time on the first call.
 */
export function HomeIncluded() {
  const { t } = useI18n();
  return (
    <section className={s.section} id="included">
      <Reveal className={s.head}>
        <div className={s.headText}>
          <span className="kf-label">{t("What you get")}</span>
          <h2 className={s.h2}>{t("Everything your project needs, included.")}</h2>
        </div>
      </Reveal>
      <Reveal as="ul" className={h.included}>
        {INCLUDED.map((item, i) => (
          <li key={item.icon} className={h.includedItem} style={{ animationDelay: `${(i % 4) * 70}ms` }}>
            <span className={h.includedIcon} aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={ICONS[item.icon]} />
              </svg>
            </span>
            <h3 className={h.includedTitle}>{t(item.title)}</h3>
            <p className={h.includedDesc}>{t(item.desc)}</p>
          </li>
        ))}
      </Reveal>
    </section>
  );
}
