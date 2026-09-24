import { Children, type CSSProperties, type ReactNode } from "react";
import { pickCols } from "../lib/balanced-cols";
import css from "./BalancedGrid.module.css";

type Range = readonly [max: number, min: number];
type Preset = { gap: number; xl: Range; lg: Range; md: Range };

/* Column ranges per breakpoint (xl ≥1180px, lg 960–1179, md 640–959; below
   640 is always one column). The ranges are what fits at a readable card
   width; pickCols chooses within them from the item count. */
const PRESETS = {
  // Image cards and short text cards: services, solutions, why-us, offers.
  cards: { gap: 16, xl: [4, 3], lg: [3, 2], md: [2, 2] },
  // Case-study cards: photo, title, summary and a link, so they need room.
  // Dropping to 2 across turns 4 featured projects into a 2×2 instead of 3+1.
  wide: { gap: 20, xl: [3, 2], lg: [3, 2], md: [2, 2] },
  // Service cards on /services also carry a bullet list.
  detail: { gap: 18, xl: [3, 3], lg: [2, 2], md: [2, 2] },
  // A process reads left to right: keep it on one line while it fits.
  steps: { gap: 20, xl: [5, 4], lg: [4, 3], md: [3, 2] },
} as const satisfies Record<string, Preset>;

type Props = {
  preset: keyof typeof PRESETS;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function BalancedGrid({ preset, children, className, style }: Props) {
  // toArray, not count: count includes null/false from conditional children.
  const n = Children.toArray(children).length;
  const p: Preset = PRESETS[preset];
  const vars = {
    "--gap": `${p.gap}px`,
    "--c-xl": pickCols(n, ...p.xl),
    "--c-lg": pickCols(n, ...p.lg),
    "--c-md": pickCols(n, ...p.md),
  } as CSSProperties;
  return (
    <div className={className ? `${css.grid} ${className}` : css.grid} style={{ ...vars, ...style }}>
      {children}
    </div>
  );
}
