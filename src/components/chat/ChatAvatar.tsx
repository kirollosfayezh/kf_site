import { useId } from "react";

/**
 * Avatars for the chat widget, drawn as inline SVG with real lighting — a base
 * gradient, a specular highlight and a contact shadow — so they read as
 * dimensional rather than flat glyphs.
 *
 * Deliberately not a WebGL or glTF model. The hero already owns one GL context
 * and the whole point of the widget is that it costs nothing until someone
 * opens it; a second renderer (plus a model download) for a 40px avatar would
 * undo that. These are a few hundred bytes, scale to any size, theme with the
 * brand tokens and never wait on a network request.
 *
 * Gradient ids come from `useId()` because several avatars render at once — a
 * fixed id would make every instance reference the first one's gradients.
 */

export type AvatarKind = "bot" | "agent";

export function ChatAvatar({
  kind,
  size = 40,
  className,
  title,
}: {
  kind: AvatarKind;
  size?: number;
  className?: string;
  title?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const id = (name: string) => `${name}-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      style={{ display: "block", flexShrink: 0, overflow: "visible" }}
    >
      <defs>
        {/* Brand sphere the character sits in. */}
        <radialGradient id={id("disc")} cx="34%" cy="26%" r="78%">
          <stop offset="0%" stopColor="#FF9A4D" />
          <stop offset="52%" stopColor="#FF6A00" />
          <stop offset="100%" stopColor="#C4008F" />
        </radialGradient>
        {/* Top-left key light, the main cue that the surface is curved. */}
        <linearGradient id={id("sheen")} x1="0" y1="0" x2="0.55" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.42" />
          <stop offset="55%" stopColor="#fff" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={id("metal")} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#FDFDFF" />
          <stop offset="48%" stopColor="#E3E5EF" />
          <stop offset="100%" stopColor="#AFB4C6" />
        </linearGradient>
        <linearGradient id={id("skin")} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#F6C9A4" />
          <stop offset="55%" stopColor="#E2A87D" />
          <stop offset="100%" stopColor="#C4855C" />
        </linearGradient>
        <linearGradient id={id("hair")} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#4A3B33" />
          <stop offset="100%" stopColor="#2A211C" />
        </linearGradient>
        <linearGradient id={id("shirt")} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#2E3350" />
          <stop offset="100%" stopColor="#171A2B" />
        </linearGradient>
        <radialGradient id={id("eye")} cx="34%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#BFF4FF" />
          <stop offset="60%" stopColor="#35C8F0" />
          <stop offset="100%" stopColor="#0E7FB0" />
        </radialGradient>
      </defs>

      {/* Contact shadow — grounds the disc instead of letting it float. */}
      <ellipse cx="24" cy="44.5" rx="14" ry="3" fill="rgba(0,0,0,.45)" />

      <circle cx="24" cy="23" r="21" fill={`url(#${id("disc")})`} />
      <circle cx="24" cy="23" r="21" fill={`url(#${id("sheen")})`} />
      {/* Rim light on the shadow side — the cheapest way to read as a sphere. */}
      <circle
        cx="24"
        cy="23"
        r="20.2"
        fill="none"
        stroke="rgba(255,255,255,.34)"
        strokeWidth="1.2"
      />

      {kind === "bot" ? (
        <g>
          {/* antenna */}
          <path d="M24 9.6V6.4" stroke="#EAECF5" strokeWidth="1.7" strokeLinecap="round" />
          <circle cx="24" cy="5.2" r="2.1" fill="#FFE07A" />
          <circle cx="23.4" cy="4.6" r="0.8" fill="#fff" opacity=".85" />

          {/* head */}
          <rect x="11.5" y="13.5" width="25" height="20" rx="7.5" fill={`url(#${id("metal")})`} />
          <rect
            x="11.5"
            y="13.5"
            width="25"
            height="20"
            rx="7.5"
            fill="none"
            stroke="rgba(255,255,255,.75)"
            strokeWidth="0.9"
          />
          {/* visor */}
          <rect x="14.6" y="17.2" width="18.8" height="11.4" rx="5.7" fill="#171A2B" />
          <rect x="14.6" y="17.2" width="18.8" height="5" rx="2.5" fill="rgba(255,255,255,.14)" />

          {/* eyes */}
          <circle cx="20" cy="22.9" r="2.7" fill={`url(#${id("eye")})`} />
          <circle cx="28" cy="22.9" r="2.7" fill={`url(#${id("eye")})`} />
          <circle cx="19.2" cy="22" r="0.95" fill="#fff" opacity=".9" />
          <circle cx="27.2" cy="22" r="0.95" fill="#fff" opacity=".9" />

          {/* ears */}
          <rect x="8.7" y="20" width="2.9" height="7" rx="1.45" fill="#C9CDDC" />
          <rect x="36.4" y="20" width="2.9" height="7" rx="1.45" fill="#C9CDDC" />

          {/* shoulders */}
          <path
            d="M13 43.5c0-5.4 4.9-8.6 11-8.6s11 3.2 11 8.6z"
            fill={`url(#${id("shirt")})`}
          />
        </g>
      ) : (
        <g>
          {/* shoulders first, so the head overlaps them */}
          <path
            d="M11.5 44c0-6.2 5.6-9.9 12.5-9.9S36.5 37.8 36.5 44z"
            fill={`url(#${id("shirt")})`}
          />
          {/* collar */}
          <path d="M20.6 35.4 24 39.4l3.4-4a13 13 0 0 1 2.6.9L24 43.4l-6-7.1a13 13 0 0 1 2.6-.9z" fill="#F2F4FA" opacity=".9" />

          {/* neck */}
          <path d="M20.6 29.6h6.8v6.2a3.4 3.4 0 0 1-6.8 0z" fill="#C4855C" />

          {/* head */}
          <ellipse cx="24" cy="22.6" rx="8.6" ry="9.6" fill={`url(#${id("skin")})`} />
          {/* hair */}
          <path
            d="M15.4 21.6c-.4-6 3.6-9.8 8.6-9.8s9 3.8 8.6 9.8c-1.4-1-2.2-2.9-2.5-4.6-2 2.1-5.6 3.2-9.4 2.7-1.9-.2-3.4-.9-4-1.6-.2 1.3-.6 2.6-1.3 3.5z"
            fill={`url(#${id("hair")})`}
          />
          {/* eyes + smile */}
          <ellipse cx="20.8" cy="22.4" rx="1.15" ry="1.35" fill="#2A211C" />
          <ellipse cx="27.2" cy="22.4" rx="1.15" ry="1.35" fill="#2A211C" />
          <circle cx="20.45" cy="21.95" r="0.4" fill="#fff" opacity=".9" />
          <circle cx="26.85" cy="21.95" r="0.4" fill="#fff" opacity=".9" />
          <path
            d="M21.2 26.4a3.6 3.6 0 0 0 5.6 0"
            fill="none"
            stroke="#8A4F32"
            strokeWidth="1.25"
            strokeLinecap="round"
          />
          {/* headset — reads instantly as "support agent" */}
          <path
            d="M14.6 24.2v-2.6a9.4 9.4 0 0 1 18.8 0v2.6"
            fill="none"
            stroke="#2E3350"
            strokeWidth="2.1"
            strokeLinecap="round"
          />
          <rect x="12.8" y="22.6" width="3.6" height="5.6" rx="1.8" fill="#3A4066" />
          <rect x="31.6" y="22.6" width="3.6" height="5.6" rx="1.8" fill="#3A4066" />
          <path d="M33.4 28.2v2.4a2.6 2.6 0 0 1-2.6 2.6h-2.4" fill="none" stroke="#3A4066" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}
