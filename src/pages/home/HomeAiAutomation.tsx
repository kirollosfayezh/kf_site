import { useState } from "react";
import { useI18n } from "../../lib/i18n";
import { Reveal } from "../../components/Reveal";
import s from "../../styles/sections.module.css";
import h from "../Home.module.css";

interface AiStep {
  kind: "TRIGGER" | "AI" | "ACTION" | "LOG" | "ALERT";
  title: string;
  detail: string;
}
interface AiRecipe {
  key: string;
  title: string;
  tag: string;
  steps: AiStep[];
  outcome: { v: string; l: string }[];
}

/** Tokens, not literals: a brand change is then one edit in `index.css`, and
 *  these keep working when the light theme redefines them. */
const KIND_COLOR: Record<AiStep["kind"], string> = {
  TRIGGER: "var(--warning)",
  AI: "var(--brand-pink)",
  ACTION: "var(--success)",
  LOG: "var(--info)",
  ALERT: "var(--danger)",
};

/** Tinted chip for a step kind. `color-mix`, because the colours are `var()`
 *  tokens now: appending a hex alpha (`var(--warning)1f`) is invalid CSS, so
 *  the chip's fill and border were silently dropped. 12% / 30% are the
 *  0x1f / 0x4d alphas the literals used to carry. */
function kindChip(color: string): React.CSSProperties {
  return {
    color,
    background: `color-mix(in srgb, ${color} 12%, transparent)`,
    border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
  };
}

/**
 * One mark per workflow. These boxes held a literal `&bull;` — a single dot in
 * a square — so all five read as empty placeholders and gave no clue which
 * workflow was which. Inline stroke SVG, like every other icon on the site.
 */
const RECIPE_ICON: Record<string, React.ReactNode> = {
  inbox: <path d="M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />,
  stock: <><path d="M21 8 12 3 3 8v8l9 5 9-5V8z" /><path d="m3 8 9 5 9-5M12 13v8" /></>,
  quote: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h4" /></>,
  report: <><path d="M3 3v18h18" /><path d="m7 15 4-4 3 3 5-6" /></>,
  support: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
};

function RecipeIcon({ name }: { name: string }) {
  return (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        {RECIPE_ICON[name] ?? <circle cx="12" cy="12" r="3" />}
      </svg>
  );
}

const AI_RECIPES: AiRecipe[] = [
  {
    key: "inbox",
    title: "Customer enquiry triage",
    tag: "WhatsApp, email and forms in one queue",
    steps: [
      { kind: "TRIGGER", title: "A message arrives", detail: "WhatsApp, the website form or your inbox — all land in one queue." },
      { kind: "AI", title: "Read and classify", detail: "The agent works out what they want, how urgent it is and which service it maps to." },
      { kind: "ACTION", title: "Reply or escalate", detail: "Common questions get an instant answer. Real leads are flagged and assigned to you." },
      { kind: "LOG", title: "Record the lead", detail: "Contact details, source and summary written straight into your CRM or sheet." },
    ],
    outcome: [{ v: "< 1 min", l: "first response time" }, { v: "70%", l: "handled without you" }, { v: "0", l: "enquiries lost" }],
  },
  {
    key: "stock",
    title: "Stock & reorder agent",
    tag: "Watches consumption, drafts the order",
    steps: [
      { kind: "TRIGGER", title: "Nightly sales sync", detail: "Every sale is matched against its recipe or bill of materials." },
      { kind: "AI", title: "Forecast demand", detail: "The agent compares real consumption to the week ahead, allowing for your busy days." },
      { kind: "ACTION", title: "Draft the purchase order", detail: "A ready-to-send order per supplier, waiting for a one-tap approval." },
      { kind: "ALERT", title: "Flag the outliers", detail: "Unusual waste or a line running short gets pushed to you immediately." },
    ],
    outcome: [{ v: "~30%", l: "less stock waste" }, { v: "6 hrs", l: "saved per month" }, { v: "Daily", l: "reorder accuracy" }],
  },
  {
    key: "quote",
    title: "Quote & proposal drafting",
    tag: "Brief in, priced proposal out",
    steps: [
      { kind: "TRIGGER", title: "Enquiry marked as qualified", detail: "You tag a lead as worth quoting — nothing goes out unreviewed." },
      { kind: "AI", title: "Scope the work", detail: "The brief is matched to your past projects and rate card to build a line-item estimate." },
      { kind: "ACTION", title: "Generate the document", detail: "A branded PDF with scope, timeline and price, ready in your drafts." },
      { kind: "LOG", title: "Track the outcome", detail: "Sent, viewed, accepted or lost — recorded against the lead automatically." },
    ],
    outcome: [{ v: "20 min", l: "to a first draft" }, { v: "3x", l: "more quotes sent" }, { v: "100%", l: "you approve first" }],
  },
  {
    key: "report",
    title: "Owner briefing bot",
    tag: "One clear summary every morning",
    steps: [
      { kind: "TRIGGER", title: "Every morning at 7am", detail: "Pulls the previous day from your POS, site analytics and ad accounts." },
      { kind: "AI", title: "Find what changed", detail: "Not a wall of numbers — the three things that actually moved and why." },
      { kind: "ACTION", title: "Send the briefing", detail: "A short WhatsApp or email summary you can read before you open the shop." },
      { kind: "ALERT", title: "Escalate anomalies", detail: "A sudden drop in sales or a spike in ad cost is called out, not buried." },
    ],
    outcome: [{ v: "7am", l: "daily briefing" }, { v: "3", l: "things that matter" }, { v: "No", l: "dashboard hunting" }],
  },
  {
    key: "support",
    title: "Website chat agent",
    tag: "Answers instantly, hands over cleanly",
    steps: [
      { kind: "TRIGGER", title: "Visitor opens the chat", detail: "Captures who they are and which page they came from." },
      { kind: "AI", title: "Answer from your content", detail: "Grounded in your real services, pricing bands and FAQ — it does not invent answers." },
      { kind: "ACTION", title: "Book or hand over", detail: "Offers a call slot, or pulls you in live the moment intent looks serious." },
      { kind: "LOG", title: "Save the transcript", detail: "Full conversation and contact details stored against the lead." },
    ],
    outcome: [{ v: "24/7", l: "coverage" }, { v: "Instant", l: "first reply" }, { v: "Live", l: "human handover" }],
  },
];

/** The interactive workflow picker: one recipe's trigger → action chain at a time. */
export function HomeAiAutomation() {
  const { t } = useI18n();
  const [aiKey, setAiKey] = useState("inbox");
  const activeRecipe = AI_RECIPES.find((r) => r.key === aiKey) ?? AI_RECIPES[0];

  return (
    <section className={`${h.aiSection} ${s.sectionAlt}`}>
      <div className={h.aiGlow} aria-hidden="true" />
      <div className={h.aiGrid} aria-hidden="true" />
      <div className={h.aiInner}>
        <Reveal style={{ maxWidth: 720 }}>
          <div className={h.aiBadge}>
            <span className={h.aiBadgeDot} />// {t("AI AUTOMATION")}
          </div>
          <h2 className={s.h2}>{t("Put the repetitive work on autopilot.")}</h2>
          <p className={s.lede}>
            {t(
              "We build AI agents that sit inside your real operations — reading messages, updating records, answering customers and flagging what needs a human. Pick a workflow to see how it runs.",
            )}
          </p>
        </Reveal>

        <div className={h.aiBody}>
          <Reveal className={h.aiList}>
            {AI_RECIPES.map((r) => {
              const on = r.key === activeRecipe.key;
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setAiKey(r.key)}
                  aria-pressed={on}
                  className={`${h.aiRecipe} ${on ? h.aiRecipeOn : ""}`}
                >
                  <span className={`${h.aiRecipeIcon} ${on ? h.aiRecipeIconOn : ""}`}>
                    <RecipeIcon name={r.key} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className={h.aiRecipeTitle}>{t(r.title)}</span>
                    <div className={h.aiRecipeTag}>{t(r.tag)}</div>
                  </span>
                </button>
              );
            })}
          </Reveal>

          <Reveal className={h.aiFlow}>
            <h3 className={h.aiFlowTitle}>{t(activeRecipe.title)}</h3>
            <div style={{ marginTop: 20 }}>
              {activeRecipe.steps.map((step, i) => (
                <div key={step.title} className={h.aiStep}>
                  {i !== activeRecipe.steps.length - 1 && <span className={h.aiStepRail} />}
                  <span className={h.aiStepDot} />
                  <span className={h.aiStepBadge} style={kindChip(KIND_COLOR[step.kind])}>
                    {t(step.kind)}
                  </span>
                  <div className={h.aiStepTitle}>{t(step.title)}</div>
                  <p className={h.aiStepDetail}>{t(step.detail)}</p>
                </div>
              ))}
            </div>
            <div className={h.aiOutcomes}>
              {activeRecipe.outcome.map((o) => (
                <div key={o.l}>
                  <div className={h.aiOutcomeValue}>{t(o.v)}</div>
                  <div className={h.aiOutcomeLabel}>{t(o.l)}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
