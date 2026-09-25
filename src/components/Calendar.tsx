import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import css from "./Calendar.module.css";

/** "YYYY-MM-DD" in whatever zone the caller grouped by. */
export type DayKey = string;

interface Props {
  /** Intl locale for month, weekday and digit formatting ("ar-EG", "de"). */
  locale: string;
  lang: string;
  dir: "ltr" | "rtl";
  /** Days that can be picked, with how many free times each has. */
  available: Map<DayKey, number>;
  selected: DayKey | null;
  onSelect: (day: DayKey) => void;
  /** The first and last day the calendar may show as pickable (inclusive). */
  min: DayKey;
  max: DayKey;
  today: DayKey;
  t: (key: string) => string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
function parseKey(k: DayKey) {
  const [y, m, d] = k.split("-").map(Number);
  return { y, m: m - 1, d };
}
/** Days between two keys, ignoring time zones (both are calendar dates). */
function shift(k: DayKey, days: number): DayKey {
  const { y, m, d } = parseKey(k);
  const t = new Date(Date.UTC(y, m, d + days));
  return keyOf(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
}

/**
 * Which day the week starts on for this locale (0 = Sunday), from the
 * browser's own locale data where it has it — Saturday in Egypt, Monday in
 * Germany and France, Sunday for English.
 */
function firstWeekday(locale: string, lang: string): number {
  try {
    const loc = new Intl.Locale(locale) as Intl.Locale & { getWeekInfo?: () => { firstDay: number }; weekInfo?: { firstDay: number } };
    const info = loc.getWeekInfo?.() ?? loc.weekInfo;
    if (info?.firstDay) return info.firstDay % 7;
  } catch {
    /* fall through to the table */
  }
  return lang === "ar" ? 6 : lang === "en" ? 0 : 1;
}

/**
 * A month calendar for picking a day.
 *
 * Only days with free times are pickable; the rest are shown but inert, so
 * the shape of the month stays readable. Every label comes from `Intl` in the
 * visitor's language, the week starts where their locale starts it, and the
 * grid works from the keyboard: arrows move a day or a week, Home/End jump
 * to the first and last day, PageUp/PageDown change the month.
 */
export function Calendar({ locale, lang, dir, available, selected, onSelect, min, max, today, t }: Props) {
  const anchor = selected ?? ([...available.keys()].sort()[0] ?? min);
  const [view, setView] = useState(() => {
    const { y, m } = parseKey(anchor);
    return { y, m };
  });
  const [focus, setFocus] = useState<DayKey>(anchor);
  const gridRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef(false);

  // Follow a selection made elsewhere (the "first free day" default) into its month.
  useEffect(() => {
    if (!selected) return;
    const { y, m } = parseKey(selected);
    setView((v) => (v.y === y && v.m === m ? v : { y, m }));
    setFocus(selected);
  }, [selected]);

  useEffect(() => {
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${focus}"]`)?.focus();
  }, [focus, view]);

  const first = useMemo(() => firstWeekday(locale, lang), [locale, lang]);
  const monthFmt = useMemo(() => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }), [locale]);
  const weekdayFmt = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }), [locale]);
  // Arabic has no short weekday form ("الخميس" is the short form), which does
  // not fit a phone-width cell; the one-letter form is shown there instead.
  const weekdayNarrowFmt = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" }), [locale]);
  const longFmt = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }), [locale]);
  const num = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const cells = useMemo(() => {
    const lead = (new Date(Date.UTC(view.y, view.m, 1)).getUTCDay() - first + 7) % 7;
    const count = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
    const out: (DayKey | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= count; d++) out.push(keyOf(view.y, view.m, d));
    while (out.length % 7) out.push(null);
    return out;
  }, [view, first]);

  // 2023-01-01 was a Sunday: a fixed week to print the day names from.
  const weekdays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.UTC(2023, 0, 1 + ((first + i) % 7)));
    return { short: weekdayFmt.format(date), narrow: weekdayNarrowFmt.format(date) };
  });

  const monthKey = (y: number, m: number) => `${y}-${pad(m + 1)}`;
  const canPrev = monthKey(view.y, view.m) > min.slice(0, 7);
  const canNext = monthKey(view.y, view.m) < max.slice(0, 7);
  const go = (delta: number) => {
    setView((v) => {
      const t = new Date(Date.UTC(v.y, v.m + delta, 1));
      return { y: t.getUTCFullYear(), m: t.getUTCMonth() };
    });
  };

  const pickable = (k: DayKey) => available.has(k) && k >= min && k <= max;

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, number> = {
      ArrowLeft: dir === "rtl" ? 1 : -1,
      ArrowRight: dir === "rtl" ? -1 : 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    let next: DayKey | null = null;
    if (e.key in step) next = shift(focus, step[e.key]);
    else if (e.key === "Home") next = keyOf(view.y, view.m, 1);
    else if (e.key === "End") next = keyOf(view.y, view.m, new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate());
    else if (e.key === "PageUp" && canPrev) next = shift(keyOf(view.y, view.m, 1), -1);
    else if (e.key === "PageDown" && canNext) next = keyOf(view.m === 11 ? view.y + 1 : view.y, (view.m + 1) % 12, 1);
    else if ((e.key === "Enter" || e.key === " ") && pickable(focus)) {
      e.preventDefault();
      onSelect(focus);
      return;
    }
    if (!next) return;
    e.preventDefault();
    const { y, m } = parseKey(next);
    setView((v) => (v.y === y && v.m === m ? v : { y, m }));
    pendingFocus.current = true;
    setFocus(next);
  };

  // The one cell in the tab order: the selection, else the focused day, else
  // the first pickable day of the month.
  const focusable = cells.includes(focus) ? focus : (cells.find((c) => c && pickable(c)) ?? cells.find(Boolean) ?? "");

  return (
    <div className={css.cal}>
      <div className={css.head}>
        <button type="button" className={css.nav} onClick={() => go(-1)} disabled={!canPrev} aria-label={t("Previous month")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={css.chevron}>
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <div className={css.month} aria-live="polite">{monthFmt.format(new Date(Date.UTC(view.y, view.m, 1)))}</div>
        <button type="button" className={css.nav} onClick={() => go(1)} disabled={!canNext} aria-label={t("Next month")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`${css.chevron} ${css.chevronNext}`}>
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>

      <div className={css.weekdays} aria-hidden="true">
        {weekdays.map((w) => (
          <span key={w.short}>
            <span className={css.wdShort}>{w.short}</span>
            <span className={css.wdNarrow}>{w.narrow}</span>
          </span>
        ))}
      </div>

      <div ref={gridRef} className={css.grid} role="grid" aria-label={t("Calendar")} onKeyDown={onKey}>
        {cells.map((k, i) => {
          if (!k) return <span key={`blank-${i}`} className={css.blank} aria-hidden="true" />;
          const { d } = parseKey(k);
          const count = available.get(k) ?? 0;
          const ok = pickable(k);
          const label = `${longFmt.format(new Date(Date.UTC(view.y, view.m, d)))}${ok ? `, ${t("{n} free times").replace("{n}", num.format(count))}` : ""}`;
          return (
            <button
              key={k}
              type="button"
              role="gridcell"
              data-day={k}
              tabIndex={k === focusable ? 0 : -1}
              aria-selected={k === selected}
              aria-disabled={!ok}
              aria-label={label}
              className={`${css.day} ${ok ? css.dayOpen : ""} ${k === selected ? css.daySelected : ""} ${k === today ? css.dayToday : ""}`}
              onClick={() => {
                setFocus(k);
                if (ok) onSelect(k);
              }}
            >
              <span className={css.dayNum}>{num.format(d)}</span>
              {ok ? <span className={css.dot} aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
