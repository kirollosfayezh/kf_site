import { useState } from "react";
import { useI18n } from "../../lib/i18n";
import { Reveal } from "../../components/Reveal";
import s from "../../styles/sections.module.css";

/** The FAQ accordion. Every answer is in the DOM (hidden until opened) so crawlers read it. */
export function HomeFaq({ items }: { items: { q: string; a: string }[] }) {
  const { t } = useI18n();
  const [openFaq, setOpenFaq] = useState(-1);

  return (
    <section className={s.sectionNarrow}>
      <Reveal className={s.headCenter}>
        <span className={s.eyebrow}>{t("// FAQ")}</span>
        <h2 className={s.h2sm}>{t("Questions, answered.")}</h2>
      </Reveal>
      <div className={s.faqList}>
        {items.map((f, i) => (
          <Reveal key={f.q} className={s.faqItem}>
            {/* Every answer is in the DOM, hidden until opened: text that
                only exists while a visitor clicks is text a crawler never
                reads, and the FAQPage schema (useFaqSchema) is built from the
                same list, so the two can never disagree. */}
            <button
              type="button"
              className={s.faqQ}
              aria-expanded={openFaq === i}
              aria-controls={`faq-${i}`}
              onClick={() => setOpenFaq((cur) => (cur === i ? -1 : i))}
            >
              <span>{f.q}</span>
              <span className={`${s.faqChevron} ${openFaq === i ? s.faqChevronOpen : ""}`} aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--brand-orange)" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </button>
            <p id={`faq-${i}`} className={s.faqA} hidden={openFaq !== i}>{f.a}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
